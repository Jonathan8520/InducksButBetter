#!/usr/bin/env python3
"""
build_db.py — Construit la base SQLite statique d'InducksButBetter depuis les fichiers ISV.

Entrée  : un dossier de fichiers `.isv` (format Inducks : séparateur `^`, en-têtes en
          première ligne, `^` terminal en fin de chaque ligne, UTF-8).
Sortie  : un fichier SQLite unique, typé, indexé, avec tables FTS5, VACUUM + ANALYZE.

Usage:
    python scripts/build_db.py data/isv data/inducks.sqlite
    python scripts/build_db.py data/isv data/inducks.sqlite --no-fts   # diagnostic
"""
from __future__ import annotations

import os
import re
import sys
import time
import sqlite3
import argparse

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# --------------------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------------------

#: Tables purement techniques (journal des modifications Inducks) : aucun écran ne les lit.
DROP_TABLES = {
    "inducks_log",
    "inducks_logdata",
}

#: Priorité des `sitecode` dans inducks_entryurl. L'application fait toujours
#: `ORDER BY CASE WHEN sitecode='webusers' THEN 0 ELSE 1 END LIMIT 1`, donc ne garder
#: que la ligne de plus forte priorité par (entrycode, pagenumber) reproduit exactement
#: son choix — tout en supprimant ~70 % des lignes (2,71 M -> 802 k).
ENTRYURL_PRIORITY = {"webusers": 0, "thumbnails": 1, "thumbnails2": 2, "thumbnails3": 3}
ENTRYURL_FALLBACK = 9

BATCH = 20_000
SAMPLE_LIMIT = 0  # 0 = inspecter toutes les lignes (2 passes). >0 = n premières lignes.

INT_RE = re.compile(r"^-?[0-9]+$")


# --------------------------------------------------------------------------------------
# Utilitaires
# --------------------------------------------------------------------------------------

def human(n: float) -> str:
    for unit in ("o", "Ko", "Mo", "Go"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} To"


def read_header(path: str) -> list[str]:
    with open(path, encoding="utf-8", errors="replace") as fh:
        header = fh.readline().rstrip("\r\n").split("^")
    if header and header[-1] == "":
        header.pop()
    return header


def iter_rows(path: str, ncols: int):
    """Parcourt un ISV en flux. Normalise chaque ligne à `ncols` champs.

    Le format Inducks place un `^` terminal en fin de ligne : le split produit donc un
    champ vide surnuméraire qu'il faut retirer, sinon toutes les colonnes sont décalées.
    """
    short = 0
    over = 0
    with open(path, encoding="utf-8", errors="replace", newline="") as fh:
        fh.readline()  # en-têtes
        for line in fh:
            row = line.rstrip("\r\n").split("^")
            if row and row[-1] == "":
                row.pop()
            if len(row) != ncols:
                if len(row) < ncols:
                    # Cas courant et bénin : Inducks tronque la ligne quand les dernières
                    # colonnes sont vides. On complète par NULL — les colonnes manquantes
                    # sont bien celles de fin, donc l'alignement est préservé.
                    short += 1
                    row += [""] * (ncols - len(row))
                else:
                    # Anormal : plus de champs que d'en-têtes. Signalé, jamais silencieux.
                    over += 1
                    row = row[:ncols]
            yield row
    if over:
        print(f"      [!] {over:,} ligne(s) avec PLUS de champs que d'en-têtes (tronquées)")
    if short and short > 0:
        print(f"      .. {short:,} ligne(s) tronquées en fin (colonnes finales vides)")


def infer_types(path: str, header: list[str]) -> list[str]:
    """Détermine l'affinité SQLite de chaque colonne.

    Prudence volontaire sur les entiers : SQLite convertit '007' en 7 sous affinité
    INTEGER, ce qui corromprait des codes comme `issuenumber`. Toute valeur à zéro
    non significatif force donc la colonne en TEXT.
    """
    n = len(header)
    is_flag = [True] * n     # uniquement 'Y'/'N'/vide
    is_int = [True] * n      # entier sans zéro de tête
    seen = [False] * n       # au moins une valeur non vide

    for i, row in enumerate(iter_rows(path, n)):
        if SAMPLE_LIMIT and i >= SAMPLE_LIMIT:
            break
        for c in range(n):
            v = row[c]
            if not v:
                continue
            seen[c] = True
            if is_flag[c] and v not in ("Y", "N"):
                is_flag[c] = False
            if is_int[c]:
                if not INT_RE.match(v):
                    is_int[c] = False
                elif len(v) > 1 and (v[0] == "0" or v.startswith("-0")):
                    is_int[c] = False  # zéro de tête significatif
                elif not (-(2**63) <= int(v) < 2**63):
                    is_int[c] = False
            if not is_flag[c] and not is_int[c]:
                continue

    types = []
    for c in range(n):
        if not seen[c]:
            types.append("TEXT")          # colonne vide : rien à gagner
        elif is_flag[c] or is_int[c]:
            types.append("INTEGER")
        else:
            types.append("TEXT")
    return types


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
            return value  # sécurité : on préfère stocker tel quel que perdre l'info
    return value


# --------------------------------------------------------------------------------------
# Réducteurs spécifiques
# --------------------------------------------------------------------------------------

def reduce_entryurl(rows, header: list[str]):
    """Ne conserve qu'une ligne par (entrycode, pagenumber), celle de meilleure priorité.

    Réduit ~2,71 M lignes à ~802 k sans changer le résultat des requêtes de l'appli.
    """
    i_entry = header.index("entrycode")
    i_site = header.index("sitecode")
    i_page = header.index("pagenumber")

    best: dict[tuple[str, str], tuple[int, list[str]]] = {}
    for row in rows:
        key = (row[i_entry], row[i_page])
        prio = ENTRYURL_PRIORITY.get(row[i_site], ENTRYURL_FALLBACK)
        cur = best.get(key)
        if cur is None or prio < cur[0]:
            best[key] = (prio, row)
    for _, row in best.values():
        yield row


REDUCERS = {"inducks_entryurl": reduce_entryurl}


# --------------------------------------------------------------------------------------
# Chargement
# --------------------------------------------------------------------------------------

def load_table(db: sqlite3.Connection, path: str, table: str) -> tuple[int, list[str]]:
    header = read_header(path)
    if not header:
        print(f"  -- {table:<34} en-tête vide, ignorée")
        return 0, []

    types = infer_types(path, header)
    cols_sql = ", ".join(f'"{c}" {t}' for c, t in zip(header, types))
    db.execute(f'DROP TABLE IF EXISTS "{table}"')
    db.execute(f'CREATE TABLE "{table}" ({cols_sql})')

    placeholders = ", ".join("?" * len(header))
    insert = f'INSERT INTO "{table}" VALUES ({placeholders})'

    source = iter_rows(path, len(header))
    reducer = REDUCERS.get(table)
    if reducer:
        source = reducer(source, header)

    batch, total = [], 0
    for row in source:
        batch.append([convert(v, t) for v, t in zip(row, types)])
        if len(batch) >= BATCH:
            db.executemany(insert, batch)
            total += len(batch)
            batch.clear()
    if batch:
        db.executemany(insert, batch)
        total += len(batch)

    n_int = sum(1 for t in types if t == "INTEGER")
    print(f"  ok {table:<34} {total:>9,} lignes  ({n_int}/{len(header)} col. INTEGER)")
    return total, header


# --------------------------------------------------------------------------------------
# Index et FTS5 — voir docs/schema_spec.md pour la justification de chaque entrée
# --------------------------------------------------------------------------------------

from schema_spec import INDEXES, FTS_TABLES  # noqa: E402  (même dossier)


def check_redundant_indexes() -> list[str]:
    """Signale les index dont les colonnes sont un préfixe strict d'un autre index.

    SQLite peut utiliser un index (a, b, c) partout où (a) conviendrait : le second est
    alors du poids mort. Sur une base servie par requêtes HTTP Range, chaque mégaoctet
    inutile est un mégaoctet à ne jamais télécharger — autant ne pas le construire.
    """
    by_table: dict[str, list[list[str]]] = {}
    for table, cols in INDEXES:
        by_table.setdefault(table, []).append(cols)

    warnings = []
    for table, specs in by_table.items():
        for a in specs:
            for b in specs:
                if a is not b and len(a) < len(b) and b[: len(a)] == a:
                    warnings.append(
                        f"{table}({', '.join(a)}) est un préfixe de "
                        f"{table}({', '.join(b)}) — redondant"
                    )
    return warnings


def create_indexes(db: sqlite3.Connection, existing: set[str]) -> int:
    for warning in check_redundant_indexes():
        print(f"  [!] index redondant : {warning}")

    made = 0
    for table, cols in INDEXES:
        if table not in existing:
            continue
        name = "ix_" + table.replace("inducks_", "") + "_" + "_".join(cols)
        name = name[:60]
        try:
            db.execute(f'CREATE INDEX IF NOT EXISTS "{name}" ON "{table}" ({", ".join(chr(34)+c+chr(34) for c in cols)})')
            made += 1
        except sqlite3.OperationalError as exc:
            print(f"  [!] index {name} ignoré : {exc}")
    return made


def create_fts(db: sqlite3.Connection, existing: set[str]) -> int:
    made = 0
    for name, source, cols in FTS_TABLES:
        if source not in existing:
            continue
        try:
            collist = ", ".join(f'"{c}"' for c in cols)
            db.execute(f'DROP TABLE IF EXISTS "{name}"')
            db.execute(
                f'CREATE VIRTUAL TABLE "{name}" USING fts5({collist}, '
                f'content="{source}", tokenize="unicode61 remove_diacritics 2")'
            )
            db.execute(f"INSERT INTO \"{name}\"(\"{name}\") VALUES('rebuild')")
            db.execute(f"INSERT INTO \"{name}\"(\"{name}\") VALUES('optimize')")
            made += 1
        except sqlite3.OperationalError as exc:
            print(f"  [!] FTS {name} ignorée : {exc}")
    return made


def table_sizes(db: sqlite3.Connection):
    try:
        rows = db.execute(
            "SELECT name, SUM(pgsize) AS bytes FROM dbstat GROUP BY name ORDER BY bytes DESC"
        ).fetchall()
        return rows
    except sqlite3.OperationalError:
        return None


# --------------------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("isv_dir")
    ap.add_argument("out_db")
    ap.add_argument("--no-fts", action="store_true", help="sauter les tables FTS5")
    ap.add_argument("--no-index", action="store_true", help="sauter les index")
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
    os.makedirs(os.path.dirname(os.path.abspath(args.out_db)), exist_ok=True)

    db = sqlite3.connect(args.out_db)
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("PRAGMA cache_size=-200000")  # 200 Mo de cache pendant la construction

    t0 = time.time()
    loaded: set[str] = set()
    rows_total = 0
    skipped = []

    for fname in files:
        table = fname[:-4]
        if table in DROP_TABLES:
            skipped.append(table)
            continue
        n, header = load_table(db, os.path.join(args.isv_dir, fname), table)
        if header:
            loaded.add(table)
            rows_total += n
    db.commit()
    t_load = time.time() - t0

    if skipped:
        print(f"\n  -- ignorées volontairement : {', '.join(skipped)}")
    print(f"\n[build] {rows_total:,} lignes dans {len(loaded)} tables en {t_load:.1f}s")
    size_raw = os.path.getsize(args.out_db)
    print(f"[build] taille sans index : {human(size_raw)}")

    if not args.no_index:
        t1 = time.time()
        n = create_indexes(db, loaded)
        db.commit()
        size_idx = os.path.getsize(args.out_db)
        print(f"[build] {n} index créés en {time.time()-t1:.1f}s — "
              f"{human(size_idx)} (+{human(size_idx - size_raw)})")
    else:
        size_idx = size_raw

    if not args.no_fts:
        t2 = time.time()
        n = create_fts(db, loaded)
        db.commit()
        size_fts = os.path.getsize(args.out_db)
        print(f"[build] {n} tables FTS5 créées en {time.time()-t2:.1f}s — "
              f"{human(size_fts)} (+{human(size_fts - size_idx)})")

    print("\n[build] ANALYZE + VACUUM...")
    db.execute("ANALYZE")
    db.commit()
    db.execute("VACUUM")
    db.commit()

    final = os.path.getsize(args.out_db)
    print(f"\n[build] TAILLE FINALE : {human(final)}  (ratio ISV x{final/raw:.2f})")
    print(f"[build] durée totale : {time.time()-t0:.1f}s")

    sizes = table_sizes(db)
    if sizes:
        print("\n  Top 15 par occupation :")
        for name, nbytes in sizes[:15]:
            print(f"    {name:<44} {human(nbytes):>10}  {100*nbytes/final:5.1f}%")

    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
