#!/usr/bin/env python3
"""
check_queries.py — Vérifie que les requêtes réelles de l'application utilisent bien les index.

Sur un backend en requêtes HTTP Range, un `SCAN` de table n'est pas « une requête lente » :
c'est le téléchargement de la table entière chez le visiteur. Ce script rejoue les requêtes
extraites du code (src/lib/turso.ts, src/lib/searchService.ts) sous EXPLAIN QUERY PLAN et
signale tout parcours séquentiel.

Il sert aussi dans l'autre sens : un index que le planificateur n'emprunte jamais est un
index à supprimer de scripts/schema_spec.py.

Usage:
    python scripts/check_queries.py data/inducks.sqlite
"""
from __future__ import annotations

import re
import sys
import sqlite3

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Tables si petites qu'un parcours séquentiel est sans conséquence (quelques dizaines de Ko).
SMALL_TABLES = {
    "inducks_country", "inducks_language", "inducks_site", "inducks_universe",
    "inducks_currency", "inducks_team", "inducks_teammember", "inducks_studio",
    "inducks_publicationname", "inducks_storyheader", "inducks_characterdetail",
    "inducks_characterurl", "inducks_currencyname", "inducks_referencereasonname",
}

QUERIES: list[tuple[str, str, tuple]] = [
    # ---- Autocomplétions : exécutées à chaque frappe, les plus critiques ----------------
    ("autocompleteCharacter (FTS)", """
        SELECT c.charactercode, COALESCE(MAX(cn.charactername), c.charactername)
        FROM fts_character f
        JOIN inducks_character c ON c.charactercode = f.charactercode
        LEFT JOIN inducks_charactername cn
          ON cn.charactercode = c.charactercode AND cn.languagecode = ?
        WHERE fts_character MATCH ?
        GROUP BY c.charactercode
        ORDER BY MAX(COALESCE(cn.preferred, 0)) DESC, c.appearancecount DESC
        LIMIT 10
    """, ("fr", '"donald"')),

    ("autocompletePerson (FTS)", """
        SELECT p.personcode, p.fullname FROM fts_person f
        JOIN inducks_person p ON p.personcode = f.personcode
        WHERE fts_person MATCH ?
        ORDER BY p.numberofindexedissues DESC LIMIT 10
    """, ('"barks"',)),

    ("autocompleteStorycode", """
        SELECT storycode, storyheadercode, title
        FROM inducks_story
        WHERE storycode >= ? AND storycode < ?
        ORDER BY storycode ASC
        LIMIT 15
    """, ("W OS", "W OT")),

    ("autocompletePublisher (FTS)", """
        SELECT publisherid, publishername FROM fts_publisher
        WHERE fts_publisher MATCH ? LIMIT 10
    """, ('"egmont"',)),

    ("autocompletePublicationTitle", """
        SELECT DISTINCT p.publicationcode, pn.publicationname
        FROM inducks_publication p
        JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
        WHERE pn.publicationname LIKE ? OR p.publicationcode LIKE ?
        ORDER BY pn.publicationname LIMIT 10
    """, ("%picsou%", "%picsou%")),

    # ---- Page Histoire -----------------------------------------------------------------
    ("getStoryDetail.core", """
        SELECT s.storycode, s.firstpublicationdate, s.storyheadercode, s.storycomment, s.title
        FROM inducks_story s WHERE s.storycode = ?
    """, ("W OS  178-02",)),

    ("getStoryDetail.version", """
        SELECT sv.storyversioncode, sv.kind, sv.entirepages, sv.plotsummary
        FROM inducks_storyversion sv WHERE sv.storycode = ?
        ORDER BY sv.storyversioncode ASC LIMIT 1
    """, ("W OS  178-02",)),

    ("getStoryDetail.creators", """
        SELECT DISTINCT sj.plotwritartink, p.personcode, p.fullname
        FROM inducks_storyjob sj JOIN inducks_person p ON sj.personcode = p.personcode
        WHERE sj.storyversioncode IN (SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
    """, ("W OS  178-02",)),

    ("getStoryDetail.characters", """
        SELECT sc.charactercode, COALESCE(cn.charactername, sc.charactername)
        FROM story_characters sc
        LEFT JOIN inducks_charactername cn
          ON cn.charactercode = sc.charactercode AND cn.languagecode = ?
        WHERE sc.storycode = ? ORDER BY sc.number ASC
    """, ("fr", "W OS  178-02")),

    ("getStoryDetail.descriptions", """
        SELECT sd.languagecode, sd.desctext FROM inducks_storydescription sd
        WHERE sd.storyversioncode IN (SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
    """, ("W OS  178-02",)),

    ("getStoryDetail.publications", """
        SELECT sp.entrycode, sp.issuecode, sp.issuenumber, sp.publicationcode, sp.countrycode
        FROM story_publications sp
        LEFT JOIN inducks_publication p ON sp.publicationcode = p.publicationcode
        WHERE sp.storycode = ?
        ORDER BY sp.countrycode ASC, sp.oldestdate ASC, sp.issuecode ASC
    """, ("W OS  178-02",)),

    # ---- Page Numéro -------------------------------------------------------------------
    ("getIssueDetail.core", """
        SELECT i.issuecode, i.issuenumber, i.oldestdate, i.pages, p.title, p.countrycode
        FROM inducks_issue i JOIN inducks_publication p ON i.publicationcode = p.publicationcode
        WHERE i.issuecode = ?
    """, ("fr/303  33",)),

    ("getIssueDetail.stories", """
        SELECT e.entrycode, e.position, sv.entirepages, e.title, s.storycode
        FROM inducks_entry e
        LEFT JOIN inducks_storyversion sv ON e.storyversioncode = sv.storyversioncode
        LEFT JOIN inducks_story s ON sv.storycode = s.storycode
        WHERE e.issuecode = ? ORDER BY e.position ASC
    """, ("fr/303  33",)),

    ("issue.thumbnail", """
        SELECT sitecode, url FROM issue_thumb WHERE issuecode = ?
    """, ("fr/303  33",)),

    ("story.thumbnail", """
        SELECT sitecode, url FROM story_thumb WHERE storycode = ?
    """, ("W OS  178-02",)),

    ("search.byStorycode (packed)", """
        SELECT storycode FROM inducks_story WHERE storycode_packed LIKE ? LIMIT 15
    """, ("wos178%",)),

    ("search.byTitle (FTS)", """
        SELECT storycode FROM fts_story WHERE fts_story MATCH ? LIMIT 24
    """, ("treasure",)),

    # ---- Recherches --------------------------------------------------------------------
    ("search.byCharacter", """
        SELECT s.storycode FROM inducks_story s
        WHERE EXISTS (SELECT 1 FROM inducks_storyversion sv
                      JOIN inducks_appearance a ON a.storyversioncode = sv.storyversioncode
                      WHERE sv.storycode = s.storycode AND a.charactercode = ?)
        LIMIT 24
    """, ("DD",)),

    ("search.byAuthor", """
        SELECT s.storycode FROM inducks_story s
        WHERE EXISTS (SELECT 1 FROM inducks_storyversion sv
                      JOIN inducks_storyjob sj ON sj.storyversioncode = sv.storyversioncode
                      WHERE sv.storycode = s.storycode AND sj.personcode = ?)
        LIMIT 24
    """, ("Carl Barks",)),

    ("search.byTitle_LIKE", """
        SELECT s.storycode FROM inducks_story s
        WHERE EXISTS (SELECT 1 FROM inducks_storyheader sh
                      WHERE sh.storyheadercode = s.storyheadercode AND sh.title LIKE ?)
        LIMIT 24
    """, ("%treasure%",)),

    ("publications.byCountry", """
        SELECT i.issuecode FROM inducks_issue i
        JOIN inducks_publication p ON i.publicationcode = p.publicationcode
        WHERE p.countrycode = ? ORDER BY p.countrycode ASC, i.issuecode ASC LIMIT 24
    """, ("fr",)),

    ("publications.byDate", """
        SELECT i.issuecode FROM inducks_issue i
        JOIN inducks_publication p ON i.publicationcode = p.publicationcode
        WHERE i.oldestdate >= ? ORDER BY i.oldestdate DESC, i.issuecode ASC LIMIT 24
    """, ("1990-01",)),

    ("publications.byPublisher", """
        SELECT i.issuecode FROM inducks_issue i
        WHERE EXISTS (SELECT 1 FROM inducks_publishingjob pj
                      WHERE pj.issuecode = i.issuecode AND pj.publisherid = ?)
        LIMIT 24
    """, ("egmont",)),
]

SCAN_RE = re.compile(r"^SCAN (\w+)", re.I)


def main() -> int:
    db_path = sys.argv[1] if len(sys.argv) > 1 else "data/inducks.sqlite"
    db = sqlite3.connect(db_path)

    tables = {r[0] for r in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    all_indexes = {r[0] for r in db.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'ix_%'").fetchall()}
    used_indexes: set[str] = set()

    problems, okc = [], 0
    print(f"[check] {len(QUERIES)} requêtes sur {db_path}\n")

    for name, sql, params in QUERIES:
        try:
            plan = db.execute("EXPLAIN QUERY PLAN " + sql, params).fetchall()
        except sqlite3.Error as exc:
            print(f"  ?? {name:<32} erreur SQL : {exc}")
            continue

        detail = [row[3] for row in plan]
        scans = []
        for line in detail:
            m = SCAN_RE.match(line.strip())
            if m and m.group(1) not in SMALL_TABLES:
                scans.append(m.group(1))
            for ix in re.findall(r"USING (?:COVERING )?INDEX (\w+)", line):
                used_indexes.add(ix)

        if scans:
            problems.append((name, scans, detail))
            print(f"  !! {name:<32} SCAN : {', '.join(sorted(set(scans)))}")
        else:
            okc += 1
            print(f"  ok {name:<32}")

    print(f"\n[check] {okc}/{len(QUERIES)} requêtes entièrement indexées")

    if problems:
        print("\n=== Détail des parcours séquentiels ===")
        for name, scans, detail in problems:
            print(f"\n  {name}  (scan de {', '.join(sorted(set(scans)))})")
            for line in detail:
                print(f"      {line}")

    unused = sorted(all_indexes - used_indexes)
    if unused:
        print(f"\n=== {len(unused)} index non empruntés par ce jeu de requêtes ===")
        print("    (à confirmer : soit la requête manque ici, soit l'index est à supprimer)")
        for ix in unused:
            print(f"      {ix}")

    missing = [t for t in SMALL_TABLES if t not in tables]
    if missing:
        print(f"\n[note] tables absentes de la base : {', '.join(sorted(missing))}")

    db.close()
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
