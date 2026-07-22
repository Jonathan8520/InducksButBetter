#!/usr/bin/env python3
"""
build_db.py — Construit la base SQLite statique d'InducksButBetter depuis les fichiers ISV.

Entrée  : un dossier de fichiers `.isv` (format Inducks : séparateur `^`, en-têtes en
          première ligne, `^` terminal en fin de chaque ligne, UTF-8).
Sortie  : un fichier SQLite unique — typé, regroupé, dénormalisé sur les chemins chauds,
          indexé, avec tables FTS5, ANALYZE + VACUUM.

Ce que fait la construction, dans l'ordre :
  1. charge les ISV (hors tables écartées), en typant les colonnes automatiquement
  2. regroupe physiquement les tables déclarées WITHOUT ROWID sur leur clé naturelle
  3. calcule les colonnes dérivées (storycode_packed, compteurs matérialisés)
  4. construit les tables dénormalisées (story_publications, *_thumb)
  5. supprime les tables d'échafaudage devenues inutiles (inducks_entryurl : 203,8 Mo)
  6. crée les index puis les tables FTS5
  7. ANALYZE + VACUUM

Toute la configuration vit dans schema_spec.py, avec la justification de chaque décision.

Usage:
    python scripts/build_db.py data/isv data/inducks.sqlite
    python scripts/build_db.py data/isv data/inducks.sqlite --no-fts
"""
from __future__ import annotations

import os
import re
import sys
import time
import sqlite3
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from schema_spec import (  # noqa: E402
    DROP_TABLES, STAGING_TABLES, DROP_COLUMNS, PRIMARY_KEYS,
    DERIVED_COLUMNS, MATERIALIZED, INDEXES, FTS_TABLES,
)

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BATCH = 20_000
INT_RE = re.compile(r"^-?[0-9]+$")

#: (table, lignes perdues, lignes lues) — récapitulé en fin de construction.
LOSSES: list[tuple[str, int, int]] = []


def human(n: float) -> str:
    for unit in ("o", "Ko", "Mo", "Go"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} To"


# --------------------------------------------------------------------------------------
# Lecture ISV
# --------------------------------------------------------------------------------------

def read_header(path: str) -> list[str]:
    with open(path, encoding="utf-8", errors="replace") as fh:
        header = fh.readline().rstrip("\r\n").split("^")
    if header and header[-1] == "":
        header.pop()
    return header


def iter_rows(path: str, ncols: int, quiet: bool = False):
    """Parcourt un ISV en flux, en normalisant chaque ligne à `ncols` champs.

    Le format Inducks place un `^` terminal : le split produit donc un champ vide
    surnuméraire qu'il faut retirer, sinon toutes les colonnes sont décalées.
    Il tronque aussi la ligne quand les dernières colonnes sont vides — cas bénin,
    puisque les champs manquants sont ceux de fin : compléter par NULL préserve
    l'alignement.
    """
    short = over = 0
    with open(path, encoding="utf-8", errors="replace", newline="") as fh:
        fh.readline()
        for line in fh:
            row = line.rstrip("\r\n").split("^")
            if row and row[-1] == "":
                row.pop()
            if len(row) != ncols:
                if len(row) < ncols:
                    short += 1
                    row += [""] * (ncols - len(row))
                else:
                    over += 1
                    row = row[:ncols]
            yield row
    if over and not quiet:
        print(f"      [!] {over:,} ligne(s) avec PLUS de champs que d'en-têtes (tronquées)")
    if short and not quiet:
        print(f"      .. {short:,} ligne(s) tronquées en fin (colonnes finales vides)")


def infer_types(path: str, header: list[str]) -> tuple[list[str], list[int]]:
    """Affinité SQLite de chaque colonne, et nombre de valeurs vides par colonne.

    Prudence volontaire sur les entiers : sous affinité INTEGER, SQLite convertirait '007'
    en 7 et corromprait des codes comme issuenumber (qui contient bien des valeurs telles
    que '01-01'). Toute valeur à zéro non significatif force donc la colonne en TEXT.

    Le décompte des vides sert à décider si une clé primaire est utilisable.
    """
    n = len(header)
    is_flag = [True] * n
    is_int = [True] * n
    seen = [False] * n
    empties = [0] * n

    for row in iter_rows(path, n, quiet=True):
        for c in range(n):
            v = row[c]
            if not v:
                empties[c] += 1
                continue
            seen[c] = True
            if is_flag[c] and v not in ("Y", "N"):
                is_flag[c] = False
            if is_int[c]:
                if not INT_RE.match(v):
                    is_int[c] = False
                elif len(v) > 1 and (v[0] == "0" or v.startswith("-0")):
                    is_int[c] = False
                elif not (-(2**63) <= int(v) < 2**63):
                    is_int[c] = False

    types = []
    for c in range(n):
        types.append("INTEGER" if seen[c] and (is_flag[c] or is_int[c]) else "TEXT")
    return types, empties


def convert(value: str, typ: str):
    if value == "":
        return None
    if typ == "INTEGER":
        if value == "Y":
            return 1
        if value == "N":
            return 0
        try:
            return int(value)
        except ValueError:
            return value  # on préfère stocker tel quel plutôt que perdre l'information
    return value


# --------------------------------------------------------------------------------------
# Chargement d'une table
# --------------------------------------------------------------------------------------

def load_table(db: sqlite3.Connection, path: str, table: str) -> int:
    header = read_header(path)
    if not header:
        print(f"  -- {table:<34} en-tête vide, ignorée")
        return 0

    types, empties = infer_types(path, header)

    dropped = DROP_COLUMNS.get(table, set())
    keep = [i for i, c in enumerate(header) if c not in dropped]
    cols = [header[i] for i in keep]
    coltypes = [types[i] for i in keep]

    # Une clé primaire n'est utilisable que si toutes ses colonnes existent. Les rares
    # lignes dont une colonne de clé est vide sont ÉCARTÉES plutôt que de faire renoncer
    # au regroupement de toute la table : sans clé naturelle, une telle ligne est de toute
    # façon inatteignable par la moindre requête. Mesuré sur le dump du 05/07/2026 :
    # 2 lignes sur 2 023 594 pour inducks_entry, 1 sur 1 726 623 pour inducks_appearance,
    # 1 sur 16 821 pour inducks_character.
    pk = PRIMARY_KEYS.get(table)
    pk_usable = bool(pk) and all(c in cols for c in pk)
    if pk and not pk_usable:
        print(f"  [!] {table}: PK {pk} inutilisable (colonne absente) — table ordinaire + index")
    pk_idx = [header.index(c) for c in pk] if pk_usable else []
    if pk_usable:
        blanks = sum(empties[i] for i in pk_idx)
        if blanks:
            print(f"      .. clé incomplète sur au plus {blanks} ligne(s) — écartées")

    parts = [f'"{c}" {t}' for c, t in zip(cols, coltypes)]
    suffix = ""
    if pk_usable:
        parts.append(f'PRIMARY KEY ({", ".join(chr(34)+c+chr(34) for c in pk)})')
        suffix = " WITHOUT ROWID"

    db.execute(f'DROP TABLE IF EXISTS "{table}"')
    db.execute(f'CREATE TABLE "{table}" ({", ".join(parts)}){suffix}')

    placeholders = ", ".join("?" * len(cols))
    verb = "INSERT OR REPLACE" if pk_usable else "INSERT"
    stmt = f'{verb} INTO "{table}" VALUES ({placeholders})'

    read = 0
    skipped_blank_key = 0
    batch = []
    for row in iter_rows(path, len(header)):
        if pk_idx and any(row[i] == "" for i in pk_idx):
            skipped_blank_key += 1
            continue
        batch.append([convert(row[i], types[i]) for i in keep])
        read += 1
        if len(batch) >= BATCH:
            db.executemany(stmt, batch)
            batch.clear()
    if batch:
        db.executemany(stmt, batch)

    stored = db.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    tag = " [WITHOUT ROWID]" if pk_usable else ""
    n_int = sum(1 for t in coltypes if t == "INTEGER")
    print(f"  ok {table:<34} {stored:>9,} lignes  ({n_int}/{len(cols)} INTEGER){tag}")
    if skipped_blank_key:
        print(f"      .. {skipped_blank_key:,} ligne(s) sans clé écartées "
              f"(inatteignables par requête)")

    # Toute perte est enregistrée pour le récapitulatif final : une clé mal choisie peut
    # faire disparaître une part énorme d'une table sans que rien n'échoue. Mesuré :
    # une clé (personcode, surname, givenname) écartait 68 % d'inducks_personalias.
    lost = skipped_blank_key + max(read - stored, 0)
    if lost:
        LOSSES.append((table, lost, read + skipped_blank_key))

    # Un écart signifie que des doublons de clé ont écrasé des lignes : jamais silencieux.
    if pk_usable and stored != read:
        print(f"      [!] {read - stored:,} ligne(s) absorbées par des doublons de clé "
              f"{pk} — à vérifier si le chiffre est élevé")

    if pk and not pk_usable:
        name = ("ix_" + table.replace("inducks_", "") + "_pk")[:60]
        db.execute(f'CREATE INDEX IF NOT EXISTS "{name}" ON "{table}" '
                   f'({", ".join(chr(34)+c+chr(34) for c in pk)})')
    return stored


# --------------------------------------------------------------------------------------
# Index
# --------------------------------------------------------------------------------------

def check_redundant_indexes() -> list[str]:
    """Signale les index dont les colonnes sont un préfixe strict d'un autre index.

    SQLite utilise un index (a, b, c) partout où (a) conviendrait : le second est du poids
    mort. On vérifie aussi contre les clés primaires déclarées, qui sont déjà l'ordre
    physique de leur table.
    """
    by_table: dict[str, list[list[str]]] = {}
    for table, cols in INDEXES:
        by_table.setdefault(table, []).append(cols)

    warnings = []
    for table, specs in by_table.items():
        candidates = list(specs)
        pk = PRIMARY_KEYS.get(table)
        for a in specs:
            for b in candidates:
                if a is not b and len(a) < len(b) and b[: len(a)] == a:
                    warnings.append(f"{table}({', '.join(a)}) préfixe de "
                                    f"{table}({', '.join(b)})")
            if pk and len(a) <= len(pk) and pk[: len(a)] == a:
                warnings.append(f"{table}({', '.join(a)}) déjà couvert par la PK "
                                f"({', '.join(pk)})")
    return warnings


def create_indexes(db: sqlite3.Connection, existing: set[str]) -> int:
    for w in check_redundant_indexes():
        print(f"  [!] index redondant : {w}")
    made = 0
    for table, cols in INDEXES:
        if table not in existing:
            continue
        name = ("ix_" + table.replace("inducks_", "") + "_" + "_".join(cols))[:60]
        try:
            db.execute(f'CREATE INDEX IF NOT EXISTS "{name}" ON "{table}" '
                       f'({", ".join(chr(34)+c+chr(34) for c in cols)})')
            made += 1
        except sqlite3.OperationalError as exc:
            print(f"  [!] index {name} ignoré : {exc}")
    return made


def create_fts(db: sqlite3.Connection, existing: set[str]) -> int:
    """Crée les tables FTS5 autonomes.

    Volontairement pas de `content=` : le mode index-externe exige un rowid sur la table
    source, ce qu'une table WITHOUT ROWID n'a pas. On duplique donc le texte indexé, au
    profit d'un schéma qui fonctionne partout et se lit sans jointure sur rowid.
    """
    made = 0
    for name, source, key, cols, tokenize in FTS_TABLES:
        if source not in existing:
            continue
        try:
            cols_sql = ", ".join([f'"{key}" UNINDEXED'] + [f'"{c}"' for c in cols])
            select_cols = ", ".join(f'"{c}"' for c in [key] + cols)
            # Une ligne dont toutes les colonnes indexées sont vides n'apporte rien.
            not_empty = " OR ".join(f'("{c}" IS NOT NULL AND "{c}" <> \'\')' for c in cols)

            db.execute(f'DROP TABLE IF EXISTS "{name}"')
            db.execute(f'CREATE VIRTUAL TABLE "{name}" USING fts5({cols_sql}, '
                       f"tokenize=\"{tokenize}\")")
            db.execute(f'INSERT INTO "{name}" SELECT {select_cols} FROM "{source}" '
                       f'WHERE {not_empty}')
            db.execute(f"INSERT INTO \"{name}\"(\"{name}\") VALUES('optimize')")
            n = db.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
            print(f"  ok {name:<24} {n:>9,} lignes  [{tokenize.split()[0]}]")
            made += 1
        except sqlite3.OperationalError as exc:
            print(f"  [!] FTS {name} ignorée : {exc}")
    return made


# --------------------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("isv_dir")
    ap.add_argument("out_db")
    ap.add_argument("--no-fts", action="store_true")
    ap.add_argument("--no-index", action="store_true")
    ap.add_argument("--keep-staging", action="store_true",
                    help="conserver inducks_entryurl et cie (diagnostic)")
    args = ap.parse_args()

    files = sorted(f for f in os.listdir(args.isv_dir) if f.endswith(".isv"))
    if not files:
        print(f"Aucun .isv dans {args.isv_dir}", file=sys.stderr)
        return 1

    raw = sum(os.path.getsize(os.path.join(args.isv_dir, f)) for f in files)
    print(f"[build] {len(files)} fichiers ISV — {human(raw)}")
    print(f"[build] sortie : {args.out_db}\n")

    if os.path.exists(args.out_db):
        os.remove(args.out_db)
    os.makedirs(os.path.dirname(os.path.abspath(args.out_db)) or ".", exist_ok=True)

    db = sqlite3.connect(args.out_db)
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("PRAGMA cache_size=-400000")

    t0 = time.time()
    loaded: set[str] = set()
    rows_total = 0
    skipped = []

    for fname in files:
        table = fname[:-4]
        if table in DROP_TABLES:
            skipped.append(table)
            continue
        n = load_table(db, os.path.join(args.isv_dir, fname), table)
        if n or table in STAGING_TABLES:
            loaded.add(table)
            rows_total += n
    db.commit()

    print(f"\n  -- {len(skipped)} tables écartées (aucune requête ne les touche)")
    print(f"\n[build] {rows_total:,} lignes dans {len(loaded)} tables en {time.time()-t0:.1f}s")
    print(f"[build] brut : {human(os.path.getsize(args.out_db))}\n")

    # --- Colonnes dérivées ne dépendant pas des tables matérialisées ------------------
    mat_names = {m[0] for m in MATERIALIZED}

    def needs_materialized(stmts: list[str]) -> bool:
        return any(m in s for s in stmts for m in mat_names)

    early = [d for d in DERIVED_COLUMNS if not needs_materialized(d[3])]
    late = [d for d in DERIVED_COLUMNS if needs_materialized(d[3])]

    def apply_derived(specs, label):
        for table, col, typ, stmts in specs:
            if table not in loaded:
                continue
            t = time.time()
            try:
                db.execute(f'ALTER TABLE "{table}" ADD COLUMN "{col}" {typ}')
                for stmt in stmts:
                    db.execute(stmt)
                db.commit()
                print(f"  ok {table}.{col:<24} {label} en {time.time()-t:.1f}s")
            except sqlite3.OperationalError as exc:
                print(f"  [!] {table}.{col} : {exc}")

    print("[build] colonnes dérivées")
    apply_derived(early, "calculée")

    # --- Tables dénormalisées et regroupées -------------------------------------------
    print("\n[build] tables regroupées")
    for name, ddl, insert, _deps in MATERIALIZED:
        t = time.time()
        before = os.path.getsize(args.out_db)
        try:
            db.execute(f'DROP TABLE IF EXISTS "{name}"')
            db.execute(ddl)
            db.execute(insert)
            db.commit()
            n = db.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
            loaded.add(name)
            grow = os.path.getsize(args.out_db) - before
            print(f"  ok {name:<24} {n:>9,} lignes en {time.time()-t:.1f}s "
                  f"(+{human(max(grow, 0))})")
        except sqlite3.OperationalError as exc:
            print(f"  [!] {name} : {exc}")

    if late:
        apply_derived(late, "calculée (post-regroupement)")

    # --- Échafaudage ------------------------------------------------------------------
    if not args.keep_staging:
        for table in sorted(STAGING_TABLES):
            if table in loaded:
                db.execute(f'DROP TABLE IF EXISTS "{table}"')
                loaded.discard(table)
                print(f"  -- {table} supprimée (n'a servi qu'à construire les tables dérivées)")
        db.commit()

    size_tables = os.path.getsize(args.out_db)
    print(f"\n[build] après dénormalisation : {human(size_tables)}")

    if not args.no_index:
        t = time.time()
        n = create_indexes(db, loaded)
        db.commit()
        size_idx = os.path.getsize(args.out_db)
        print(f"[build] {n} index en {time.time()-t:.1f}s — {human(size_idx)} "
              f"(+{human(max(size_idx - size_tables, 0))})")
    else:
        size_idx = size_tables

    if not args.no_fts:
        t = time.time()
        n = create_fts(db, loaded)
        db.commit()
        size_fts = os.path.getsize(args.out_db)
        print(f"[build] {n} tables FTS5 en {time.time()-t:.1f}s — {human(size_fts)} "
              f"(+{human(max(size_fts - size_idx, 0))})")

    print("\n[build] ANALYZE + VACUUM...")
    db.execute("ANALYZE")
    db.commit()
    db.execute("VACUUM")
    db.commit()

    final = os.path.getsize(args.out_db)
    print(f"\n[build] TAILLE FINALE : {human(final)}  (ratio ISV x{final/raw:.2f})")
    print(f"[build] durée totale : {time.time()-t0:.1f}s")
    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
