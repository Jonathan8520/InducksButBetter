#!/usr/bin/env python3
"""
measure_io.py — Mesure ce qu'un visiteur téléchargerait réellement par requête.

La base fait ~1,1 Go, mais personne ne la télécharge : le VFS HTTP ne demande que les pages
SQLite dont la requête a besoin. Ce script instrumente un VFS apsw pour compter exactement
ces pages, et simule le comportement du navigateur :

  - pages distinctes touchées   -> octets réellement transférés
  - requêtes HTTP Range         -> après fusion des pages contiguës
  - tranches de 20 Mio touchées -> combien de fichiers différents sont sollicités
  - effet du cache              -> seconde exécution de la même requête

Nécessite apsw (pip install apsw), qui expose l'API VFS de SQLite à Python.

Usage:
    python scripts/measure_io.py data/inducks.sqlite
"""
from __future__ import annotations

import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

try:
    import apsw
except ImportError:
    print("apsw requis : pip install apsw", file=sys.stderr)
    raise SystemExit(2)

_VFS = None
PAGE = 4096
CHUNK = 20 * 1024 * 1024

# Pages lues depuis le début du process, tous fichiers confondus.
READS: list[tuple[int, int]] = []      # (offset, longueur)
CACHE: set[int] = set()                # pages déjà transférées (cache navigateur)


class TracingFile(apsw.VFSFile):
    def __init__(self, inherit, filename, flags):
        super().__init__(inherit, filename, flags)

    def xRead(self, amount, offset):
        READS.append((offset, amount))
        return super().xRead(amount, offset)


class TracingVFS(apsw.VFS):
    def __init__(self):
        super().__init__("tracing", "")

    def xOpen(self, name, flags):
        return TracingFile("", name, flags)


def pages_of(reads: list[tuple[int, int]]) -> set[int]:
    out = set()
    for off, length in reads:
        first = off // PAGE
        last = (off + max(length, 1) - 1) // PAGE
        out.update(range(first, last + 1))
    return out


def merge_ranges(pages: set[int]) -> int:
    """Nombre de requêtes HTTP après fusion des pages contiguës."""
    if not pages:
        return 0
    ordered = sorted(pages)
    requests = 1
    for prev, cur in zip(ordered, ordered[1:]):
        if cur != prev + 1:
            requests += 1
    return requests


def human(n: float) -> str:
    for unit in ("o", "Ko", "Mo", "Go"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} To"


QUERIES: list[tuple[str, str, tuple]] = [
    ("Détail d'une histoire", """
        SELECT s.storycode, s.title, sv.plotsummary
        FROM inducks_story s
        JOIN inducks_storyversion sv ON sv.storycode = s.storycode
        WHERE s.storycode = ? LIMIT 1
    """, ("W OS  178-02",)),

    ("Personnages d'une histoire", """
        SELECT a.charactercode, c.charactername
        FROM inducks_appearance a
        JOIN inducks_character c ON a.charactercode = c.charactercode
        WHERE a.storyversioncode IN (
            SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
        ORDER BY a.number
    """, ("W OS  178-02",)),

    ("Parutions d'une histoire", """
        SELECT e.entrycode, i.issuecode, p.countrycode
        FROM inducks_entry e
        JOIN inducks_issue i ON e.issuecode = i.issuecode
        JOIN inducks_publication p ON i.publicationcode = p.publicationcode
        WHERE e.storyversioncode IN (
            SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
    """, ("W OS  178-02",)),

    ("Sommaire d'un numéro", """
        SELECT e.entrycode, e.position, e.title, s.storycode
        FROM inducks_entry e
        LEFT JOIN inducks_storyversion sv ON e.storyversioncode = sv.storyversioncode
        LEFT JOIN inducks_story s ON sv.storycode = s.storycode
        WHERE e.issuecode = ? ORDER BY e.position
    """, ("fr/303  33",)),

    ("Autocomplétion storycode (préfixe)", """
        SELECT storycode, title FROM inducks_story
        WHERE storycode >= ? AND storycode < ? ORDER BY storycode LIMIT 15
    """, ("W OS", "W OT")),

    ("Recherche par personnage (BIEN orientée)", """
        SELECT DISTINCT sv.storycode
        FROM inducks_appearance a
        JOIN inducks_storyversion sv ON sv.storyversioncode = a.storyversioncode
        WHERE a.charactercode = ? LIMIT 24
    """, ("DD",)),

    ("Recherche par personnage (MAL orientée, code actuel)", """
        SELECT s.storycode FROM inducks_story s
        WHERE EXISTS (SELECT 1 FROM inducks_storyversion sv
                      JOIN inducks_appearance a ON a.storyversioncode = sv.storyversioncode
                      WHERE sv.storycode = s.storycode AND a.charactercode = ?)
        LIMIT 24
    """, ("DD",)),

    ("Numéros d'un pays", """
        SELECT i.issuecode, i.oldestdate FROM inducks_issue i
        JOIN inducks_publication p ON i.publicationcode = p.publicationcode
        WHERE p.countrycode = ? ORDER BY p.countrycode, i.issuecode LIMIT 24
    """, ("fr",)),
]


def run(db, label: str, sql: str, params: tuple, warm: bool):
    READS.clear()
    cur = db.cursor()
    rows = 0
    try:
        for _ in cur.execute(sql, params):
            rows += 1
    except apsw.SQLError as exc:
        print(f"  ?? {label}: {exc}")
        return

    pages = pages_of(READS)
    fresh = pages - CACHE if warm else pages
    CACHE.update(pages)

    chunks = {p * PAGE // CHUNK for p in fresh}
    print(f"  {label}")
    print(f"      {rows:>6} lignes | {len(pages):>6} pages touchées | "
          f"{len(fresh):>6} à télécharger = {human(len(fresh)*PAGE):>9} | "
          f"{merge_ranges(fresh):>4} requêtes HTTP | {len(chunks)} tranche(s)")


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "data/inducks.sqlite"
    total = os.path.getsize(path)
    # La VFS se désenregistre si elle est ramassée : garder la référence vivante.
    global _VFS
    _VFS = TracingVFS()

    print(f"[io] base : {path} — {human(total)} ({total // PAGE:,} pages de {PAGE} o)\n")
    print("=== Première visite (cache vide) ===\n")

    db = apsw.Connection(path, vfs="tracing", flags=apsw.SQLITE_OPEN_READONLY)
    # Cache SQLite minimal : on veut compter les lectures réelles, pas celles évitées
    # par un cache mémoire généreux qui fausserait la mesure vers le bas.
    db.cursor().execute("PRAGMA cache_size=-2000")

    for label, sql, params in QUERIES:
        run(db, label, sql, params, warm=False)
        CACHE.clear()

    print(f"\n=== Session réaliste (cache partagé, ordre naturel) ===\n")
    CACHE.clear()
    for label, sql, params in QUERIES:
        run(db, label, sql, params, warm=True)

    print(f"\n  Total transféré sur la session : {human(len(CACHE) * PAGE)} "
          f"({len(CACHE):,} pages sur {total // PAGE:,} — "
          f"{100 * len(CACHE) / (total // PAGE):.3f} % de la base)")

    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
