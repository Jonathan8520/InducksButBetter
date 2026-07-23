#!/usr/bin/env python3
"""
perf_test.py — Rejoue chaque requête de l'application et vérifie son budget de requêtes HTTP.

Chaque requête de `perf_budget.py` est exécutée sous une VFS SQLite instrumentée qui compte
les pages lues, puis converties en requêtes HTTP Range après fusion des pages contiguës —
exactement ce que fera le navigateur. Une requête dont le coût dépasse son budget FAIT
ÉCHOUER le test : c'est le filet qui attrape une refonte de schéma qui réintroduit un
parcours de table (10 requêtes -> 1 000, sans erreur, juste un écran qui rame).

Cache SQLite volontairement minimal (2 Mo) : on mesure le coût À FROID, celui de la
première visite, pas celui d'une requête déjà en cache.

Usage :
    python scripts/perf_test.py data/inducks.sqlite
    python scripts/perf_test.py data/inducks.sqlite --verbose

Nécessite apsw (pip install apsw), qui expose la couche VFS de SQLite à Python.
Code de sortie non nul si un budget est dépassé — utilisable en CI.
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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from perf_budget import QUERIES  # noqa: E402

PAGE = 4096
READS: list[tuple[int, int]] = []
_VFS = None  # garder la référence vivante, sinon la VFS se désenregistre


class _File(apsw.VFSFile):
    def xRead(self, amount, offset):
        READS.append((offset, amount))
        return super().xRead(amount, offset)


class _VFSClass(apsw.VFS):
    def __init__(self):
        super().__init__("perf-tracing", "")

    def xOpen(self, name, flags):
        return _File("", name, flags)


def pages_touched(reads):
    out = set()
    for off, length in reads:
        first = off // PAGE
        last = (off + max(length, 1) - 1) // PAGE
        out.update(range(first, last + 1))
    return out


def http_requests(pages):
    """Requêtes HTTP après fusion des pages contiguës — le vrai coût réseau."""
    if not pages:
        return 0
    ordered = sorted(pages)
    n = 1
    for a, b in zip(ordered, ordered[1:]):
        if b != a + 1:
            n += 1
    return n


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    verbose = "--verbose" in sys.argv
    db_path = args[0] if args else "data/inducks.sqlite"
    if not os.path.exists(db_path):
        print(f"Base introuvable : {db_path}", file=sys.stderr)
        return 2

    global _VFS
    _VFS = _VFSClass()
    db = apsw.Connection(db_path, vfs="perf-tracing", flags=apsw.SQLITE_OPEN_READONLY)
    db.cursor().execute("PRAGMA cache_size=-2000")  # ~2 Mo : coût à froid

    total = os.path.getsize(db_path)
    print(f"[perf] {db_path} — {total/1024/1024/1024:.2f} Go, {total//PAGE:,} pages")
    print(f"[perf] {len(QUERIES)} requêtes, budget de requêtes HTTP par requête\n")

    failures = []
    worst = []
    for name, sql, params, budget in QUERIES:
        READS.clear()
        try:
            rows = sum(1 for _ in db.cursor().execute(sql, params))
        except apsw.Error as exc:
            print(f"  ERREUR  {name}\n          {exc}")
            failures.append((name, "erreur SQL", 0, budget))
            continue

        pages = pages_touched(READS)
        req = http_requests(pages)
        worst.append((req, budget, name))
        over = req > budget
        flag = "FAIL" if over else " ok "
        line = (f"  [{flag}] {name:<52} {req:>5} req / {budget:<5} budget"
                f"   {len(pages)*PAGE/1024:>7.0f} Ko   {rows} lignes")
        if over or verbose:
            print(line)
        if over:
            failures.append((name, f"{req} > {budget}", req, budget))

    print("\n" + "─" * 78)
    if failures:
        print(f"  {len(failures)} requête(s) HORS BUDGET :")
        for name, why, req, budget in failures:
            print(f"    - {name}: {why}")
        print("\n  Un dépassement signale presque toujours un parcours de table réintroduit :")
        print("  vérifier le plan avec `EXPLAIN QUERY PLAN` et l'index correspondant.")
        return 1

    worst.sort(reverse=True)
    print(f"  Les {len(QUERIES)} requêtes sont dans les clous.")
    print("  Les plus coûteuses (marge = budget - mesuré) :")
    for req, budget, name in worst[:5]:
        print(f"    {req:>5} req  (budget {budget}, marge {budget-req:+d})  {name}")
    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
