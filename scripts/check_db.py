#!/usr/bin/env python3
"""
check_db.py — Contrôles de la base construite, avant publication.

Deux familles de contrôles :
  1. Contenu : des entités connues existent et sont complètes (une base tronquée ne doit
     jamais remplacer la base en ligne).
  2. Plans : les requêtes chaudes de l'application passent par un index ou une clé. Un
     parcours complet d'une grande table coûterait des centaines de requêtes réseau au
     visiteur ; il fait échouer la construction.

Usage :
    python scripts/check_db.py data/inducks.sqlite
"""
from __future__ import annotations

import re
import sqlite3
import sys

FAILURES: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok' if ok else 'ÉCHEC'}  {label}{(' — ' + detail) if detail else ''}")
    if not ok:
        FAILURES.append(label)


#: Tables assez grosses pour qu'un parcours complet soit inacceptable.
BIG = {
    "story", "story_title", "story_search", "story_pub", "story_country", "story_job",
    "story_char", "story_desc", "story_version", "toc", "issue", "character_story",
    "person_story", "person_issue", "story_code",
}

#: Requêtes chaudes (forme identique à celles de src/data/*.ts).
HOT = {
    "fiche histoire": ("SELECT doc FROM story_doc WHERE storycode = ?", ["W OS  386-02"]),
    "fiches compactes": ("SELECT * FROM story WHERE sid IN (1, 2, 3)", []),
    "parutions d'une histoire": ("SELECT * FROM story_pub WHERE sid = ?", [1]),
    "sommaire d'un numéro": ("SELECT * FROM toc WHERE issuecode = ? ORDER BY pos, entry", ["fr/PM  272"]),
    "numéro par publication et numéro": (
        "SELECT * FROM issue WHERE publicationcode = ? AND number = ?", ["fr/PM", "272"]),
    "numéros d'une publication": (
        "SELECT * FROM issue WHERE issuecode >= ? AND issuecode < ? AND publicationcode = ?",
        ["fr/PM ", "fr/PM!", "fr/PM"]),
    "histoires d'un auteur": (
        "SELECT sid FROM person_story WHERE code = ? ORDER BY date LIMIT 30", ["CB"]),
    "histoires d'un personnage": (
        "SELECT sid FROM character_story WHERE code = ? ORDER BY date LIMIT 30", ["US"]),
    "titres (FTS, par popularité)": (
        "SELECT r.sid FROM (SELECT rowid FROM fts_story WHERE fts_story MATCH ? ORDER BY rowid "
        "LIMIT 6) t JOIN story_rank r ON r.rank = t.rowid", ['"picsou"*']),
    "code d'histoire": (
        "SELECT sid FROM story_code WHERE code >= ? AND code < ? LIMIT 6", ["wos386", "wos386￿"]),
    "parutions récentes d'un pays": (
        "SELECT * FROM issue WHERE countrycode = ? AND date <= ? ORDER BY date DESC LIMIT 36",
        ["fr", "2100"]),
    "recherche sans critère": (
        "SELECT s.sid FROM story_search s WHERE s.kind = 'n' AND s.date < ':' "
        "ORDER BY s.date DESC, s.sid LIMIT 30", []),
    "inédits d'un pays": (
        "SELECT s.sid FROM story_search s WHERE s.sid IN (SELECT sid FROM person_story WHERE code = 'CB') "
        "AND NOT EXISTS (SELECT 1 FROM story_country x WHERE x.countrycode = 'fr' AND x.sid = s.sid) "
        "ORDER BY s.pubs DESC LIMIT 30", []),
    "numéros indexés par une personne": (
        "SELECT * FROM person_issue WHERE code = ? AND job = 'i' ORDER BY date DESC LIMIT 48", ["CB"]),
}


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    db = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
    one = lambda sql, *a: db.execute(sql, a).fetchone()

    print("[check] contenu")
    stats = one("SELECT value FROM meta WHERE key = 'stats'")
    check("métadonnées présentes", bool(stats))
    n = one("SELECT COUNT(*) FROM story")[0]
    check("histoires", n > 300_000, f"{n:,}")
    n = one("SELECT COUNT(*) FROM issue")[0]
    check("numéros", n > 200_000, f"{n:,}")
    n = one("SELECT COUNT(*) FROM toc")[0]
    check("entrées de sommaire", n > 1_500_000, f"{n:,}")
    row = one("SELECT title, pubs, creators FROM story WHERE storycode = 'W OS  386-02'")
    check("Only A Poor Old Man", bool(row) and row[1] > 100 and "CB" in (row[2] or ""), str(row))
    doc = one("SELECT doc FROM story_doc WHERE storycode = 'W OS  386-02'")
    import json
    d = json.loads(doc[0]) if doc else {}
    check("document de fiche", len(d.get("titles") or {}) > 10 and len(d.get("chars") or []) >= 3,
          f"{len(d.get('titles') or {})} titres, {len(d.get('chars') or [])} personnages")
    row = one("SELECT name, stories FROM person WHERE code = 'CB'")
    check("Carl Barks", bool(row) and row[1] > 1000, str(row))
    row = one("SELECT COUNT(*) FROM toc WHERE issuecode = 'fr/PM  272'")
    check("sommaire de Picsou Magazine 272", row[0] > 3, str(row[0]))
    hits = db.execute(
        "SELECT COUNT(*) FROM fts_story WHERE fts_story MATCH '\"poor\" \"old\" \"man\"'").fetchone()[0]
    check("recherche plein texte", hits > 0, f"{hits} résultats")
    hits = db.execute("SELECT COUNT(*) FROM fts_person WHERE fts_person MATCH '\"rosa\"'").fetchone()[0]
    check("recherche d'auteur (trigrammes)", hits > 0, f"{hits} résultats")
    imgs = one("SELECT COUNT(*) FROM issue WHERE img IS NOT NULL")[0]
    check("couvertures", imgs > 100_000, f"{imgs:,}")

    print("\n[check] plans des requêtes chaudes")
    for label, (sql, params) in HOT.items():
        plan = db.execute("EXPLAIN QUERY PLAN " + sql, params).fetchall()
        text = " | ".join(r[3] for r in plan)
        scans = [t for t in re.findall(r"SCAN (\w+)", text) if t in BIG]
        # Un parcours d'index couvrant est un parcours d'intervalle, pas de table.
        bad = [s for s in scans if f"SCAN {s} USING COVERING INDEX" not in text]
        check(label, not bad, text[:160] if bad else "")

    db.close()
    if FAILURES:
        print(f"\n[check] {len(FAILURES)} échec(s) : {', '.join(FAILURES)}")
        return 1
    print("\n[check] tout est bon")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
