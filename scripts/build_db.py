#!/usr/bin/env python3
"""
build_db.py — Construit la base SQLite publiée par InducksButBetter, à partir du dump ISV.

La base n'est jamais téléchargée en entier par le visiteur : elle est découpée en tranches
statiques et le navigateur ne lit que les pages SQLite dont une requête a besoin. Le coût
d'une page du site n'est donc pas le CPU mais le nombre d'allers-retours réseau, et le
schéma ci-dessous est entièrement dessiné pour le réduire :

  1. Chaque écran lit des tables REGROUPÉES sur sa clé d'accès (WITHOUT ROWID) : la liste des
     histoires d'un auteur, le sommaire d'un numéro, les parutions d'une histoire sont des
     lignes contiguës, lues en une ou deux requêtes au lieu d'une par ligne.
  2. Les histoires ont un identifiant entier `sid` (ordre des codes). Les listes stockent ce
     `sid` (1 à 3 octets) plutôt que le code texte, et les fiches compactes se lisent par
     rowid.
  3. Les textes longs (commentaires, résumés, descriptions) vivent dans des tables à part,
     pour que les fiches compactes restent denses (plus de lignes par page lue).
  4. Les recherches plein texte sont des tables FTS5 SANS CONTENU (rowid = sid) : l'index
     sans le texte dupliqué.

Deux étapes :
  - staging : chargement brut des ISV utiles dans une base de travail (texte, sans clé),
  - final   : construction des tables publiées par requêtes sur la base de travail.

Usage :
    python scripts/build_db.py data/isv data/inducks.sqlite
    python scripts/build_db.py data/isv data/inducks.sqlite --staging /tmp/staging.sqlite
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sqlite3
import sys
import time
import unicodedata

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# --------------------------------------------------------------------------------------
# Tables ISV chargées en staging. Tout le reste du dump est ignoré.
# --------------------------------------------------------------------------------------
ISV_TABLES = [
    "inducks_story", "inducks_storyversion", "inducks_entry", "inducks_issue",
    "inducks_publication", "inducks_publicationname", "inducks_person",
    "inducks_personalias", "inducks_personurl", "inducks_character",
    "inducks_charactername", "inducks_characteralias", "inducks_appearance",
    "inducks_storyjob", "inducks_storydescription", "inducks_storyheader",
    "inducks_storysubseries", "inducks_subseries", "inducks_subseriesname",
    "inducks_universe", "inducks_universename", "inducks_ucrelation", "inducks_country",
    "inducks_countryname", "inducks_publisher", "inducks_publishingjob",
    "inducks_issuejob", "inducks_issuecollecting", "inducks_entryurl",
    "inducks_storycodes", "inducks_substory", "inducks_storyreference",
    "inducks_referencereason", "inducks_referencereasonname",
    "inducks_statpersoncharacter", "inducks_statcharactercharacter",
    "inducks_statpersonperson", "inducks_herocharacter", "inducks_storyurl", "inducks_site",
]

#: Index de travail sur la base de staging (accélèrent la construction, non publiés).
STAGING_INDEXES = [
    ("inducks_story", ["storycode"]),
    ("inducks_storyversion", ["storyversioncode"]),
    ("inducks_storyversion", ["storycode"]),
    ("inducks_entry", ["storyversioncode"]),
    ("inducks_entry", ["issuecode"]),
    ("inducks_entry", ["entrycode"]),
    ("inducks_issue", ["issuecode"]),
    ("inducks_publication", ["publicationcode"]),
    ("inducks_person", ["personcode"]),
    ("inducks_character", ["charactercode"]),
    ("inducks_appearance", ["storyversioncode"]),
    ("inducks_storyjob", ["storyversioncode"]),
    ("inducks_entryurl", ["entrycode"]),
    ("inducks_storydescription", ["storyversioncode"]),
    ("inducks_publishingjob", ["issuecode"]),
    ("inducks_herocharacter", ["storycode"]),
]

BATCH = 50_000


def human(n: float) -> str:
    for unit in ("o", "Ko", "Mo", "Go"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} To"


def norm(text):
    """Minuscules sans accents — la même transformation que src/lib/text.ts côté client."""
    if text is None:
        return None
    return "".join(
        c for c in unicodedata.normalize("NFD", str(text).casefold())
        if not unicodedata.combining(c)
    )


def pack(code):
    """Code d'histoire compacté pour la recherche : minuscules, sans espaces."""
    if code is None:
        return None
    return "".join(str(code).lower().split())


# --------------------------------------------------------------------------------------
# Étape 1 : staging
# --------------------------------------------------------------------------------------

def read_header(path: str) -> list[str]:
    with open(path, encoding="utf-8", errors="replace") as fh:
        header = fh.readline().rstrip("\r\n").split("^")
    if header and header[-1] == "":
        header.pop()
    return header


def iter_rows(path: str, ncols: int):
    """Le format ISV termine chaque ligne par `^` et tronque les colonnes finales vides."""
    with open(path, encoding="utf-8", errors="replace", newline="") as fh:
        fh.readline()
        for line in fh:
            row = line.rstrip("\r\n").split("^")
            if row and row[-1] == "":
                row.pop()
            if len(row) < ncols:
                row += [""] * (ncols - len(row))
            elif len(row) > ncols:
                row = row[:ncols]
            yield [v if v != "" else None for v in row]


def build_staging(isv_dir: str, path: str) -> None:
    if os.path.exists(path):
        os.remove(path)
    db = sqlite3.connect(path)
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("PRAGMA cache_size=-600000")
    t0 = time.time()
    for table in ISV_TABLES:
        fpath = os.path.join(isv_dir, table + ".isv")
        if not os.path.exists(fpath):
            print(f"  [!] {table}.isv absent — table vide")
            continue
        header = read_header(fpath)
        cols = ", ".join(f'"{c}"' for c in header)
        db.execute(f'CREATE TABLE "{table}" ({cols})')
        stmt = f'INSERT INTO "{table}" VALUES ({", ".join("?" * len(header))})'
        batch, n = [], 0
        for row in iter_rows(fpath, len(header)):
            batch.append(row)
            if len(batch) >= BATCH:
                db.executemany(stmt, batch)
                n += len(batch)
                batch.clear()
        if batch:
            db.executemany(stmt, batch)
            n += len(batch)
        print(f"  ok {table:<34} {n:>10,} lignes")
    db.commit()
    for table, cols in STAGING_INDEXES:
        name = "sx_" + table.replace("inducks_", "") + "_" + "_".join(cols)
        db.execute(f'CREATE INDEX "{name}" ON "{table}" ({", ".join(cols)})')
    db.commit()
    db.execute("ANALYZE")
    db.close()
    print(f"[staging] {human(os.path.getsize(path))} en {time.time() - t0:.0f}s\n")


# --------------------------------------------------------------------------------------
# Étape 2 : base publiée
# --------------------------------------------------------------------------------------
# Chaque entrée : (nom, DDL, [requêtes de remplissage]). Les requêtes lisent la base de
# staging attachée sous le nom `s`. L'ordre compte : une table peut dépendre des précédentes.

STEPS: list[tuple[str, str, list[str]]] = []


def step(name: str, ddl: str, *fill: str) -> None:
    STEPS.append((name, ddl, list(fill)))


# --- Tables de travail temporaires (dans la base finale, supprimées à la fin) -----------

step("_ver", """
    CREATE TABLE _ver (
        svc TEXT PRIMARY KEY, storycode TEXT, kind TEXT, entirepages INTEGER,
        num INTEGER, den INTEGER, rows INTEGER, cols INTEGER, what TEXT, plot TEXT
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO _ver
    SELECT storyversioncode, storycode, kind, CAST(entirepages AS INTEGER),
           CAST(brokenpagenumerator AS INTEGER), CAST(brokenpagedenominator AS INTEGER),
           CAST(rowsperpage AS INTEGER), CAST(columnsperpage AS INTEGER), what, plotsummary
    FROM s.inducks_storyversion WHERE storyversioncode IS NOT NULL""",
    "CREATE INDEX _ver_story ON _ver(storycode)")

# Version de référence : celle désignée par l'histoire, sinon la plus petite.
step("_ref", """
    CREATE TABLE _ref (storycode TEXT PRIMARY KEY, svc TEXT) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO _ref
    SELECT st.storycode, COALESCE(
        (SELECT v.svc FROM _ver v WHERE v.svc = st.originalstoryversioncode),
        (SELECT MIN(v.svc) FROM _ver v WHERE v.storycode = st.storycode))
    FROM s.inducks_story st WHERE st.storycode IS NOT NULL""")

# Toutes les entrées, avec la date et la langue de leur numéro. Base de presque tout.
step("_entry", """
    CREATE TABLE _entry (
        entrycode TEXT PRIMARY KEY, issuecode TEXT, storycode TEXT, svc TEXT,
        position TEXT, title TEXT, lang TEXT, date TEXT, countrycode TEXT,
        publicationcode TEXT, part TEXT, printedcode TEXT, changes TEXT, cut TEXT,
        minorchanges TEXT, missingpanels TEXT, mirrored TEXT, sideways TEXT,
        uncertain TEXT, comment TEXT, includedin TEXT, printedhero TEXT, reallytitle TEXT
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO _entry
    SELECT e.entrycode, e.issuecode, v.storycode, e.storyversioncode, e.position,
           NULLIF(TRIM(e.title), ''), COALESCE(e.languagecode, p.languagecode),
           i.oldestdate, p.countrycode, i.publicationcode, e.part, e.printedcode,
           e.changes, e.cut, e.minorchanges, e.missingpanels, e.mirrored, e.sideways,
           e.identificationuncertain, e.entrycomment, e.includedinentrycode, e.printedhero,
           e.reallytitle
    FROM s.inducks_entry e
    LEFT JOIN _ver v ON v.svc = e.storyversioncode
    LEFT JOIN s.inducks_issue i ON i.issuecode = e.issuecode
    LEFT JOIN s.inducks_publication p ON p.publicationcode = i.publicationcode
    WHERE e.entrycode IS NOT NULL AND e.issuecode IS NOT NULL""",
    "CREATE INDEX _entry_story ON _entry(storycode, date)",
    "CREATE INDEX _entry_issue ON _entry(issuecode, position)")

# Première image de chaque entrée (vignette) : priorité au site webusers, puis page 1.
step("_thumb", """
    CREATE TABLE _thumb (entrycode TEXT PRIMARY KEY, img TEXT) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO _thumb
    SELECT entrycode, CASE WHEN sitecode = 'webusers' THEN url ELSE sitecode || '|' || url END
    FROM (
        SELECT entrycode, sitecode, url, ROW_NUMBER() OVER (
            PARTITION BY entrycode
            ORDER BY CASE WHEN sitecode = 'webusers' THEN 0
                          WHEN sitecode LIKE 'thumbnails%' THEN 2 ELSE 1 END,
                     CAST(pagenumber AS INTEGER)) AS rn
        FROM s.inducks_entryurl
        WHERE entrycode IS NOT NULL AND url IS NOT NULL AND sitecode IS NOT NULL
    ) WHERE rn = 1""")

# Crédits par version, au format compact « rôle:code » séparés par « ; ».
step("_cred", """
    CREATE TABLE _cred (svc TEXT PRIMARY KEY, creators TEXT) WITHOUT ROWID""", """
    INSERT INTO _cred
    SELECT svc, GROUP_CONCAT(role || ':' || personcode, ';') FROM (
        SELECT DISTINCT sj.storyversioncode AS svc, sj.plotwritartink AS role, sj.personcode
        FROM s.inducks_storyjob sj
        WHERE sj.storyversioncode IS NOT NULL AND sj.personcode IS NOT NULL
          AND sj.plotwritartink IS NOT NULL
        ORDER BY 1, CASE sj.plotwritartink WHEN 'p' THEN 0 WHEN 'w' THEN 1 WHEN 'a' THEN 2
                     WHEN 'i' THEN 3 ELSE 4 END
    ) GROUP BY svc""")

# --- Histoires --------------------------------------------------------------------------

step("story", """
    CREATE TABLE story (
        sid        INTEGER PRIMARY KEY,
        storycode  TEXT NOT NULL,
        title      TEXT,     -- titre de l'histoire, ou à défaut le premier titre publié
        date       TEXT,     -- première publication (AAAA, AAAA-MM ou AAAA-MM-JJ)
        kind       TEXT,     -- n histoire, g gag, c couverture, i illustration, a article…
        pages      INTEGER,
        num        INTEGER,  -- fraction de page : num/den
        den        INTEGER,
        rows       INTEGER,  -- strips par page
        hero       TEXT,     -- code du héros principal
        creators   TEXT,     -- « rôle:code;… » de la version de référence
        img        TEXT,     -- vignette de la première page
        pubs       INTEGER,  -- nombre de parutions
        countries  INTEGER,  -- nombre de pays
        header     TEXT,     -- code d'en-tête de série (storyheader)
        parts      INTEGER   -- nombre de parties si histoire à épisodes
    )""", """
    INSERT INTO story (storycode, title, date, kind, pages, num, den, rows, hero)
    SELECT st.storycode,
           COALESCE(NULLIF(NULLIF(TRIM(st.title), ''), 'Untitled'),
                    (SELECT e.title FROM _entry e
                     WHERE e.storycode = st.storycode AND e.title IS NOT NULL
                     ORDER BY e.date, e.entrycode LIMIT 1)),
           st.firstpublicationdate, v.kind, v.entirepages, v.num, v.den, v.rows,
           (SELECT h.charactercode FROM s.inducks_herocharacter h
            WHERE h.storycode = st.storycode
            ORDER BY CAST(h.number AS INTEGER) LIMIT 1)
    FROM s.inducks_story st
    LEFT JOIN _ref r ON r.storycode = st.storycode
    LEFT JOIN _ver v ON v.svc = r.svc
    WHERE st.storycode IS NOT NULL
    ORDER BY st.storycode""",
    "CREATE UNIQUE INDEX story_by_code ON story(storycode)",
    "UPDATE story SET header = (SELECT NULLIF(storyheadercode, '') FROM s.inducks_story st "
    "WHERE st.storycode = story.storycode)",
    "UPDATE story SET creators = (SELECT c.creators FROM _ref r JOIN _cred c ON c.svc = r.svc "
    "WHERE r.storycode = story.storycode)",
    # Une histoire sans crédit sur sa version de référence (cas des couvertures redessinées)
    # reprend ceux de n'importe quelle autre version.
    "UPDATE story SET creators = (SELECT c.creators FROM _ver v JOIN _cred c ON c.svc = v.svc "
    "WHERE v.storycode = story.storycode LIMIT 1) WHERE creators IS NULL",
)

# Parutions = numéros distincts : une histoire publiée en douze morceaux dans un même
# album n'y compte qu'une fois.
step("_pubcount", """
    CREATE TABLE _pubcount (storycode TEXT PRIMARY KEY, pubs INTEGER, countries INTEGER)
    WITHOUT ROWID""", """
    INSERT INTO _pubcount
    SELECT storycode, COUNT(DISTINCT issuecode), COUNT(DISTINCT countrycode) FROM _entry
    WHERE storycode IS NOT NULL GROUP BY storycode""",
    """UPDATE story SET pubs = COALESCE((SELECT pubs FROM _pubcount p
       WHERE p.storycode = story.storycode), 0),
       countries = COALESCE((SELECT countries FROM _pubcount p
       WHERE p.storycode = story.storycode), 0)""")

# Vignette : image rattachée à l'histoire elle-même, sinon première page de sa plus ancienne
# parution illustrée.
step("_simg", """
    CREATE TABLE _simg (storycode TEXT PRIMARY KEY, img TEXT) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO _simg
    SELECT storycode, CASE WHEN sitecode = 'webusers' THEN url ELSE sitecode || '|' || url END
    FROM (
        SELECT storycode, sitecode, url, ROW_NUMBER() OVER (
            PARTITION BY storycode
            ORDER BY CASE WHEN sitecode = 'webusers' THEN 0
                          WHEN sitecode LIKE 'thumbnails%' THEN 2 ELSE 1 END,
                     CAST(pagenumber AS INTEGER)) AS rn
        FROM s.inducks_entryurl
        WHERE storycode IS NOT NULL AND url IS NOT NULL AND sitecode IS NOT NULL
    ) WHERE rn = 1""", """
    INSERT OR IGNORE INTO _simg
    SELECT storycode, img FROM (
        SELECT e.storycode, t.img, ROW_NUMBER() OVER (
            PARTITION BY e.storycode ORDER BY e.date, e.entrycode) AS rn
        FROM _entry e JOIN _thumb t ON t.entrycode = e.entrycode
        WHERE e.storycode IS NOT NULL
    ) WHERE rn = 1""",
    "UPDATE story SET img = (SELECT img FROM _simg i WHERE i.storycode = story.storycode)")

# Textes longs, à part pour que `story` reste dense.
step("story_text", """
    CREATE TABLE story_text (
        sid INTEGER PRIMARY KEY, comment TEXT, plot TEXT, appsummary TEXT
    )""", """
    INSERT INTO story_text
    SELECT s2.sid, NULLIF(st.storycomment, ''), NULLIF(v.plot, ''), NULL
    FROM story s2
    JOIN s.inducks_story st ON st.storycode = s2.storycode
    LEFT JOIN _ref r ON r.storycode = s2.storycode
    LEFT JOIN _ver v ON v.svc = r.svc
    WHERE NULLIF(st.storycomment, '') IS NOT NULL OR NULLIF(v.plot, '') IS NOT NULL""")

# Titre par langue : le titre de la plus ancienne parution dans cette langue.
step("story_title", """
    CREATE TABLE story_title (
        sid INTEGER, lang TEXT, title TEXT, PRIMARY KEY (sid, lang)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO story_title
    SELECT sid, lang, title FROM (
        SELECT st.sid, e.lang, e.title, ROW_NUMBER() OVER (
            PARTITION BY st.sid, e.lang ORDER BY e.date, e.entrycode) AS rn
        FROM _entry e JOIN story st ON st.storycode = e.storycode
        WHERE e.title IS NOT NULL AND e.lang IS NOT NULL AND e.reallytitle IS NOT 'N'
    ) WHERE rn = 1""")

# Filtrage et tri de la recherche : une table étroite, lisible en balayage si besoin.
step("story_search", """
    CREATE TABLE story_search (
        sid   INTEGER PRIMARY KEY,
        date  TEXT,
        kind  TEXT,
        pages REAL,
        pubs  INTEGER,
        hero  TEXT
    )""", """
    INSERT INTO story_search
    SELECT sid, date, kind,
           COALESCE(pages, 0) + CASE WHEN den > 0 THEN 1.0 * num / den ELSE 0 END,
           pubs, hero
    FROM story""",
    # Index couvrant (sid est la clé) : « parues tel mois, les plus publiées » sans lire la table.
    "CREATE INDEX story_search_date ON story_search(date, kind, pubs)",
    # (pubs, kind) : « les plus publiées » sans critère se lit dans l'index seul.
    "CREATE INDEX story_search_pubs ON story_search(pubs, kind)")

# Rang de popularité : l'index plein texte des titres est numéroté dans cet ordre, si bien
# que les N premiers résultats d'une recherche sont les N histoires les plus publiées, lus
# sans parcourir tous les résultats (FTS5 rend ses rowid dans l'ordre croissant).
step("story_rank", """
    CREATE TABLE story_rank (rank INTEGER PRIMARY KEY, sid INTEGER NOT NULL)""", """
    INSERT INTO story_rank (sid)
    SELECT sid FROM story ORDER BY pubs DESC, countries DESC, sid""")

# Codes alternatifs et compactés : « wos386-02 », « idmr3-1 »… pour l'autocomplétion.
step("story_code", """
    CREATE TABLE story_code (code TEXT, sid INTEGER, PRIMARY KEY (code, sid)) WITHOUT ROWID""",
    "INSERT OR IGNORE INTO story_code SELECT pack(storycode), sid FROM story",
    """INSERT OR IGNORE INTO story_code
       SELECT pack(c.alternativecode), st.sid FROM s.inducks_storycodes c
       JOIN story st ON st.storycode = c.storycode
       WHERE c.alternativecode IS NOT NULL""")

# Versions d'une histoire.
step("story_version", """
    CREATE TABLE story_version (
        sid INTEGER, svc TEXT, kind TEXT, pages INTEGER, num INTEGER, den INTEGER,
        rows INTEGER, cols INTEGER, what TEXT, plot TEXT, creators TEXT,
        PRIMARY KEY (sid, svc)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO story_version
    SELECT st.sid, v.svc, v.kind, v.entirepages, v.num, v.den, v.rows, v.cols,
           NULLIF(v.what, ''), NULLIF(v.plot, ''), c.creators
    FROM _ver v JOIN story st ON st.storycode = v.storycode
    LEFT JOIN _cred c ON c.svc = v.svc""")

# Parutions d'une histoire, groupées par histoire puis par date.
step("story_pub", """
    CREATE TABLE story_pub (
        sid INTEGER, date TEXT, issuecode TEXT, pos TEXT, pub TEXT, title TEXT, lang TEXT,
        part TEXT, PRIMARY KEY (sid, date, issuecode, pos)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO story_pub
    SELECT st.sid, COALESCE(e.date, ''), e.issuecode, COALESCE(e.position, ''),
           e.publicationcode, e.title, e.lang, e.part
    FROM _entry e JOIN story st ON st.storycode = e.storycode""",
    )

# Pays de parution (pour « publiée / jamais publiée en … »).
step("story_country", """
    CREATE TABLE story_country (
        countrycode TEXT, sid INTEGER, first TEXT, PRIMARY KEY (countrycode, sid)
    ) WITHOUT ROWID""", """
    INSERT INTO story_country
    SELECT e.countrycode, st.sid, MIN(e.date) FROM _entry e
    JOIN story st ON st.storycode = e.storycode
    WHERE e.countrycode IS NOT NULL GROUP BY e.countrycode, st.sid""")

# Crédits complets (toutes versions confondues).
step("story_job", """
    CREATE TABLE story_job (
        sid INTEGER, personcode TEXT, role TEXT, PRIMARY KEY (sid, personcode, role)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO story_job
    SELECT st.sid, sj.personcode, sj.plotwritartink
    FROM s.inducks_storyjob sj
    JOIN _ver v ON v.svc = sj.storyversioncode
    JOIN story st ON st.storycode = v.storycode
    WHERE sj.personcode IS NOT NULL AND sj.plotwritartink IS NOT NULL""")

# Personnages d'une histoire.
step("story_char", """
    CREATE TABLE story_char (
        sid INTEGER, charactercode TEXT, n INTEGER, comment TEXT,
        PRIMARY KEY (sid, charactercode)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO story_char
    SELECT st.sid, a.charactercode, MIN(CAST(a.number AS INTEGER)),
           MAX(NULLIF(a.appearancecomment, ''))
    FROM s.inducks_appearance a
    JOIN _ver v ON v.svc = a.storyversioncode
    JOIN story st ON st.storycode = v.storycode
    WHERE a.charactercode IS NOT NULL
    GROUP BY st.sid, a.charactercode""")

# Descriptions par langue (toutes versions confondues, la référence d'abord).
step("story_desc", """
    CREATE TABLE story_desc (
        sid INTEGER, lang TEXT, text TEXT, PRIMARY KEY (sid, lang)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO story_desc
    SELECT st.sid, d.languagecode, d.desctext
    FROM s.inducks_storydescription d
    JOIN _ver v ON v.svc = d.storyversioncode
    JOIN story st ON st.storycode = v.storycode
    LEFT JOIN _ref r ON r.storycode = v.storycode
    WHERE d.languagecode IS NOT NULL AND NULLIF(d.desctext, '') IS NOT NULL
    ORDER BY CASE WHEN r.svc = v.svc THEN 0 ELSE 1 END""")

# Histoires à épisodes : partie -> tout, et tout -> parties.
step("story_part", """
    CREATE TABLE story_part (
        super INTEGER, part TEXT, sid INTEGER, title TEXT, date TEXT,
        PRIMARY KEY (super, sid)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO story_part
    SELECT sup.sid, ss.part, sub.sid, NULLIF(ss.title, ''), ss.firstpublicationdate
    FROM s.inducks_substory ss
    JOIN story sup ON sup.storycode = ss.superstorycode
    JOIN story sub ON sub.storycode = ss.storycode""",
    "CREATE INDEX story_part_sid ON story_part(sid)",
    """UPDATE story SET parts = (SELECT COUNT(*) FROM story_part p WHERE p.super = story.sid)
       WHERE sid IN (SELECT super FROM story_part)""")

# Références croisées entre histoires, dans les deux sens.
step("story_ref", """
    CREATE TABLE story_ref (
        sid INTEGER, other INTEGER, dir TEXT, reason INTEGER,
        PRIMARY KEY (sid, dir, other, reason)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO story_ref
    SELECT a.sid, b.sid, 'out', CAST(r.referencereasonid AS INTEGER)
    FROM s.inducks_storyreference r
    JOIN story a ON a.storycode = r.fromstorycode
    JOIN story b ON b.storycode = r.tostorycode""", """
    INSERT OR IGNORE INTO story_ref
    SELECT b.sid, a.sid, 'in', CAST(r.referencereasonid AS INTEGER)
    FROM s.inducks_storyreference r
    JOIN story a ON a.storycode = r.fromstorycode
    JOIN story b ON b.storycode = r.tostorycode""")

step("ref_reason", """
    CREATE TABLE ref_reason (
        id INTEGER, lang TEXT, text TEXT, PRIMARY KEY (id, lang)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO ref_reason
    SELECT CAST(referencereasonid AS INTEGER), 'en', referencereasontext
    FROM s.inducks_referencereason WHERE referencereasontext IS NOT NULL""", """
    INSERT OR IGNORE INTO ref_reason
    SELECT CAST(referencereasonid AS INTEGER), languagecode, referencereasontranslation
    FROM s.inducks_referencereasonname
    WHERE languagecode IS NOT NULL AND referencereasontranslation IS NOT NULL""")

# Liens externes d'une histoire (guides, sites spécialisés).
step("story_url", """
    CREATE TABLE story_url (
        sid INTEGER, site TEXT, url TEXT, PRIMARY KEY (sid, site, url)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO story_url
    SELECT st.sid, u.sitecode, COALESCE(si.urlbase, '') || u.url
    FROM s.inducks_storyurl u
    JOIN story st ON st.storycode = u.storycode
    LEFT JOIN s.inducks_site si ON si.sitecode = u.sitecode
    WHERE u.url IS NOT NULL""")

step("site", """
    CREATE TABLE site (sitecode TEXT PRIMARY KEY, name TEXT, urlbase TEXT) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO site SELECT sitecode, sitename, urlbase FROM s.inducks_site
    WHERE sitecode IS NOT NULL""")

# --- Séries ------------------------------------------------------------------------------

step("storyheader", """
    CREATE TABLE storyheader (
        code TEXT PRIMARY KEY, title TEXT, countrycode TEXT, comment TEXT
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO storyheader
    SELECT storyheadercode, title, countrycode, NULLIF(storyheadercomment, '')
    FROM s.inducks_storyheader WHERE storyheadercode IS NOT NULL""")

step("subseries", """
    CREATE TABLE subseries (
        code TEXT PRIMARY KEY, name TEXT, official INTEGER, comment TEXT, category TEXT,
        stories INTEGER, first TEXT, last TEXT, img TEXT
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO subseries (code, name, official, comment, category)
    SELECT subseriescode, subseriesname, official = 'Y', NULLIF(subseriescomment, ''),
           NULLIF(subseriescategory, '')
    FROM s.inducks_subseries WHERE subseriescode IS NOT NULL""")

step("subseries_name", """
    CREATE TABLE subseries_name (
        code TEXT, lang TEXT, name TEXT, preferred INTEGER, PRIMARY KEY (code, lang, name)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO subseries_name
    SELECT subseriescode, languagecode, subseriesname, preferred = 'Y'
    FROM s.inducks_subseriesname
    WHERE subseriescode IS NOT NULL AND languagecode IS NOT NULL AND subseriesname IS NOT NULL""")

step("subseries_story", """
    CREATE TABLE subseries_story (
        code TEXT, date TEXT, sid INTEGER, kind TEXT, PRIMARY KEY (code, date, sid)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO subseries_story
    SELECT ss.subseriescode, COALESCE(st.date, ''), st.sid, st.kind
    FROM s.inducks_storysubseries ss JOIN story st ON st.storycode = ss.storycode
    WHERE ss.subseriescode IS NOT NULL""",
    "CREATE INDEX subseries_story_sid ON subseries_story(sid)",
    """UPDATE subseries SET
         stories = (SELECT COUNT(*) FROM subseries_story x WHERE x.code = subseries.code),
         first = (SELECT MIN(CASE WHEN date GLOB '[0-9][0-9][0-9][0-9]*' THEN date END) FROM subseries_story x WHERE x.code = subseries.code),
         last = (SELECT MAX(CASE WHEN date GLOB '[0-9][0-9][0-9][0-9]*' THEN date END) FROM subseries_story x WHERE x.code = subseries.code),
         img = (SELECT st.img FROM subseries_story x JOIN story st ON st.sid = x.sid
                WHERE x.code = subseries.code AND st.img IS NOT NULL
                ORDER BY st.pubs DESC LIMIT 1)""")

# --- Fiche histoire en un seul document --------------------------------------------------
# La page d'une histoire lisait une vingtaine de tables (titres, résumés, crédits,
# personnages, versions, épisodes, références, liens…), chacune au prix d'une descente de
# B-arbre, soit 70 requêtes réseau à froid. Tout est ici réuni en un document JSON par
# histoire, regroupé par code : une seule descente (3 ou 4 requêtes) pour toute la fiche.
# Seuls les noms (auteurs, personnages, séries) restent résolus à part, sur de petites
# tables vite en cache.
step("story_doc", """
    CREATE TABLE story_doc (storycode TEXT PRIMARY KEY, sid INTEGER, doc TEXT) WITHOUT ROWID""", """
    INSERT INTO story_doc
    SELECT s.storycode, s.sid, json_patch('{}', json_object(
      'sid', s.sid, 'code', s.storycode, 'title', s.title, 'date', s.date, 'kind', s.kind,
      'pages', s.pages, 'num', s.num, 'den', s.den, 'rows', s.rows, 'hero', s.hero,
      'creators', s.creators, 'img', s.img, 'pubs', s.pubs, 'countries', s.countries,
      'header', (SELECT json_array(h.code, h.title) FROM storyheader h WHERE h.code = s.header),
      -- Numéro de première parution (le plus petit code parmi ceux de la même date).
      'first', json((SELECT json_array(e.issuecode, e.publicationcode) FROM _entry e
                     WHERE e.storycode = s.storycode AND e.date = s.date
                     ORDER BY e.issuecode LIMIT 1)),
      'comment', t.comment,
      'titles', json((SELECT json_group_object(lang, title) FROM story_title x WHERE x.sid = s.sid)),
      'desc', json((SELECT json_group_object(lang, text) FROM story_desc x WHERE x.sid = s.sid)),
      'jobs', json((SELECT json_group_array(json_array(personcode, role)) FROM story_job x
                    WHERE x.sid = s.sid)),
      'chars', json((SELECT json_group_array(json_array(charactercode, n, comment)) FROM (
                       SELECT * FROM story_char x WHERE x.sid = s.sid ORDER BY n, charactercode))),
      'versions', json((SELECT json_group_array(json_array(svc, kind, pages, num, den, rows, what))
                        FROM story_version x WHERE x.sid = s.sid)),
      'parts', json((SELECT json_group_array(json_array(st.storycode, p.part,
                                                          COALESCE(p.title, st.title), p.date))
                     FROM (SELECT * FROM story_part p WHERE p.super = s.sid
                           ORDER BY CAST(p.part AS INTEGER), p.part) p
                     JOIN story st ON st.sid = p.sid)),
      'partOf', json((SELECT json_array(st.storycode, st.title, p.part) FROM story_part p
                      JOIN story st ON st.sid = p.super WHERE p.sid = s.sid LIMIT 1)),
      'series', json((SELECT json_group_array(code) FROM subseries_story x WHERE x.sid = s.sid)),
      'refs', json((SELECT json_group_array(json_array(st.storycode, st.title, st.kind, r.dir, r.reason))
                    FROM (SELECT * FROM story_ref r WHERE r.sid = s.sid LIMIT 80) r
                    JOIN story st ON st.sid = r.other)),
      'refCount', (SELECT COUNT(*) FROM story_ref r WHERE r.sid = s.sid),
      'links', json((SELECT json_group_array(json_array(u.site, si.name, u.url)) FROM story_url u
                     LEFT JOIN site si ON si.sitecode = u.site WHERE u.sid = s.sid))
    ))
    FROM story s LEFT JOIN story_text t ON t.sid = s.sid""")

#: Nombre d'histoires par année de première parution, en texte « 1947:3,1948:12 ».
YEARS_SQL = """UPDATE {table} SET years = (
    SELECT GROUP_CONCAT(y || ':' || n, ',') FROM (
        SELECT substr(x.date, 1, 4) AS y, COUNT(*) AS n FROM {rel} x
        WHERE x.code = {table}.code AND x.date GLOB '[0-9][0-9][0-9][0-9]*' {extra}
        GROUP BY y ORDER BY y))"""

# --- Personnages et univers -----------------------------------------------------------

step("character", """
    CREATE TABLE character (
        code TEXT PRIMARY KEY, name TEXT, official INTEGER, onetime INTEGER,
        heroonly INTEGER, comment TEXT, stories INTEGER, first TEXT, last TEXT,
        first_sid INTEGER, img TEXT, years TEXT
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO character (code, name, official, onetime, heroonly, comment)
    SELECT charactercode, charactername, official = 'Y', onetime = 'Y', heroonly = 'Y',
           NULLIF(charactercomment, '')
    FROM s.inducks_character WHERE charactercode IS NOT NULL""")

step("character_story", """
    CREATE TABLE character_story (
        code TEXT, date TEXT, sid INTEGER, kind TEXT, PRIMARY KEY (code, date, sid)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO character_story
    SELECT sc.charactercode, COALESCE(st.date, ''), st.sid, st.kind
    FROM story_char sc JOIN story st ON st.sid = sc.sid""",
    """UPDATE character SET
         stories = (SELECT COUNT(*) FROM character_story x WHERE x.code = character.code),
         first = (SELECT MIN(CASE WHEN date GLOB '[0-9][0-9][0-9][0-9]*' THEN date END) FROM character_story x WHERE x.code = character.code),
         last = (SELECT MAX(CASE WHEN date GLOB '[0-9][0-9][0-9][0-9]*' THEN date END) FROM character_story x WHERE x.code = character.code)""",
    YEARS_SQL.format(table="character", rel="character_story", extra=""),
    # Première apparition : la plus ancienne vraie histoire, pas une couverture ou une
    # illustration datée d'avant (sinon, la plus ancienne entrée tout court).
    """UPDATE character SET first_sid = COALESCE(
         (SELECT x.sid FROM character_story x JOIN story s ON s.sid = x.sid
          WHERE x.code = character.code AND x.date GLOB '[0-9][0-9][0-9][0-9]*' AND s.kind = 'n'
          ORDER BY x.date LIMIT 1),
         (SELECT x.sid FROM character_story x
          WHERE x.code = character.code AND x.date = character.first LIMIT 1))""")

step("character_name", """
    CREATE TABLE character_name (
        code TEXT, lang TEXT, name TEXT, preferred INTEGER, comment TEXT,
        PRIMARY KEY (code, lang, name)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO character_name
    SELECT charactercode, languagecode, charactername, preferred = 'Y',
           NULLIF(characternamecomment, '')
    FROM s.inducks_charactername
    WHERE charactercode IS NOT NULL AND languagecode IS NOT NULL AND charactername IS NOT NULL""")

step("character_alias", """
    CREATE TABLE character_alias (code TEXT, name TEXT, PRIMARY KEY (code, name)) WITHOUT ROWID""",
    """INSERT OR IGNORE INTO character_alias SELECT charactercode, charactername
       FROM s.inducks_characteralias WHERE charactercode IS NOT NULL AND charactername IS NOT NULL""")

step("universe", """
    CREATE TABLE universe (code TEXT PRIMARY KEY, comment TEXT, characters INTEGER) WITHOUT ROWID""",
    """INSERT OR IGNORE INTO universe SELECT universecode, NULLIF(universecomment, ''), 0
       FROM s.inducks_universe WHERE universecode IS NOT NULL""")

step("universe_name", """
    CREATE TABLE universe_name (code TEXT, lang TEXT, name TEXT, PRIMARY KEY (code, lang))
    WITHOUT ROWID""", """
    INSERT OR IGNORE INTO universe_name SELECT universecode, languagecode, universename
    FROM s.inducks_universename
    WHERE universecode IS NOT NULL AND languagecode IS NOT NULL AND universename IS NOT NULL""")

step("universe_character", """
    CREATE TABLE universe_character (
        universe TEXT, stories INTEGER, code TEXT, PRIMARY KEY (universe, stories, code)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO universe_character
    SELECT r.universecode, COALESCE(c.stories, 0), r.charactercode
    FROM s.inducks_ucrelation r LEFT JOIN character c ON c.code = r.charactercode
    WHERE r.universecode IS NOT NULL AND r.charactercode IS NOT NULL""",
    "CREATE INDEX universe_character_code ON universe_character(code)",
    """UPDATE universe SET characters = (SELECT COUNT(*) FROM universe_character u
       WHERE u.universe = universe.code)""")

# Classements précalculés : 12 premiers co-personnages et auteurs de chaque personnage.
step("character_top", """
    CREATE TABLE character_top (
        code TEXT, kind TEXT, rank INTEGER, other TEXT, total INTEGER,
        PRIMARY KEY (code, kind, rank)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO character_top
    SELECT code, 'co', rn, other, total FROM (
        SELECT charactercode AS code, cocharactercode AS other, CAST(total AS INTEGER) AS total,
               ROW_NUMBER() OVER (PARTITION BY charactercode
                                  ORDER BY CAST(total AS INTEGER) DESC) AS rn
        FROM s.inducks_statcharactercharacter
        WHERE charactercode IS NOT NULL AND cocharactercode IS NOT NULL
          AND charactercode <> cocharactercode
    ) WHERE rn <= 12""", """
    INSERT OR IGNORE INTO character_top
    SELECT code, 'creator', rn, other, total FROM (
        SELECT charactercode AS code, personcode AS other, CAST(total AS INTEGER) AS total,
               ROW_NUMBER() OVER (PARTITION BY charactercode
                                  ORDER BY CAST(total AS INTEGER) DESC) AS rn
        FROM s.inducks_statpersoncharacter
        WHERE charactercode IS NOT NULL AND personcode IS NOT NULL
    ) WHERE rn <= 12""")

# --- Auteurs ------------------------------------------------------------------------------

step("person", """
    CREATE TABLE person (
        code TEXT PRIMARY KEY, name TEXT, nationality TEXT, official INTEGER,
        birthname TEXT, born TEXT, bornplace TEXT, died TEXT, diedplace TEXT,
        comment TEXT, fake INTEGER, stories INTEGER, first TEXT, last TEXT,
        roles TEXT, indexed INTEGER, img TEXT, years TEXT
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO person (code, name, nationality, official, birthname, born,
        bornplace, died, diedplace, comment, fake)
    SELECT personcode, fullname, NULLIF(nationalitycountrycode, ''), official = 'Y',
           NULLIF(birthname, ''), NULLIF(borndate, ''), NULLIF(bornplace, ''),
           NULLIF(deceaseddate, ''), NULLIF(deceasedplace, ''), NULLIF(personcomment, ''),
           isfake = 'Y'
    FROM s.inducks_person WHERE personcode IS NOT NULL""",
    "CREATE INDEX person_nationality ON person(nationality, stories)")

step("person_story", """
    CREATE TABLE person_story (
        code TEXT, date TEXT, sid INTEGER, roles TEXT, kind TEXT, PRIMARY KEY (code, date, sid)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO person_story
    SELECT j.personcode, COALESCE(st.date, ''), j.sid, GROUP_CONCAT(j.role, ''), st.kind
    FROM (SELECT sid, personcode, role FROM story_job
          ORDER BY sid, personcode, CASE role WHEN 'p' THEN 0 WHEN 'w' THEN 1 WHEN 'a' THEN 2
                                     WHEN 'i' THEN 3 ELSE 4 END) j
    JOIN story st ON st.sid = j.sid
    GROUP BY j.personcode, j.sid""",
    # Le rôle « r » signale une histoire qui cite l'auteur sans qu'il y ait travaillé : il
    # ne compte ni dans le nombre d'histoires, ni dans les années d'activité.
    """UPDATE person SET
         stories = (SELECT COUNT(*) FROM person_story x WHERE x.code = person.code
                    AND x.roles GLOB '*[pwai]*'),
         first = (SELECT MIN(CASE WHEN date GLOB '[0-9][0-9][0-9][0-9]*' THEN date END)
                  FROM person_story x WHERE x.code = person.code AND x.roles GLOB '*[pwai]*'),
         last = (SELECT MAX(CASE WHEN date GLOB '[0-9][0-9][0-9][0-9]*' THEN date END)
                 FROM person_story x WHERE x.code = person.code AND x.roles GLOB '*[pwai]*')""",
    # Histogramme compact « année:nombre,… » pour le graphique de la fiche auteur.
    YEARS_SQL.format(table="person", rel="person_story", extra="AND x.roles GLOB '*[pwai]*'"))

step("_roles", """
    CREATE TABLE _roles (code TEXT PRIMARY KEY, roles TEXT) WITHOUT ROWID""", """
    INSERT INTO _roles
    SELECT personcode, GROUP_CONCAT(role || ':' || n, ';') FROM (
        SELECT personcode, role, COUNT(*) AS n FROM story_job GROUP BY personcode, role
        ORDER BY personcode, n DESC
    ) GROUP BY personcode""",
    "UPDATE person SET roles = (SELECT roles FROM _roles r WHERE r.code = person.code)")

step("person_alias", """
    CREATE TABLE person_alias (code TEXT, name TEXT, official INTEGER, PRIMARY KEY (code, name))
    WITHOUT ROWID""", """
    INSERT OR IGNORE INTO person_alias
    SELECT personcode, TRIM(COALESCE(givenname, '') || ' ' || COALESCE(surname, '')),
           official = 'Y'
    FROM s.inducks_personalias
    WHERE personcode IS NOT NULL AND TRIM(COALESCE(givenname, '') || COALESCE(surname, '')) <> ''""")

step("person_url", """
    CREATE TABLE person_url (code TEXT, site TEXT, url TEXT, PRIMARY KEY (code, site, url))
    WITHOUT ROWID""", """
    INSERT OR IGNORE INTO person_url
    SELECT u.personcode, u.sitecode, COALESCE(si.urlbase, '') || u.url
    FROM s.inducks_personurl u LEFT JOIN s.inducks_site si ON si.sitecode = u.sitecode
    WHERE u.personcode IS NOT NULL AND u.url IS NOT NULL""")

step("person_top", """
    CREATE TABLE person_top (
        code TEXT, kind TEXT, rank INTEGER, other TEXT, total INTEGER,
        PRIMARY KEY (code, kind, rank)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO person_top
    SELECT code, 'character', rn, other, total FROM (
        SELECT personcode AS code, charactercode AS other, CAST(total AS INTEGER) AS total,
               ROW_NUMBER() OVER (PARTITION BY personcode
                                  ORDER BY CAST(total AS INTEGER) DESC) AS rn
        FROM s.inducks_statpersoncharacter
        WHERE charactercode IS NOT NULL AND personcode IS NOT NULL
    ) WHERE rn <= 12""", """
    INSERT OR IGNORE INTO person_top
    SELECT code, 'co', rn, other, total FROM (
        SELECT personcode AS code, copersoncode AS other, CAST(total AS INTEGER) AS total,
               ROW_NUMBER() OVER (PARTITION BY personcode
                                  ORDER BY CAST(total AS INTEGER) DESC) AS rn
        FROM s.inducks_statpersonperson
        WHERE personcode IS NOT NULL AND copersoncode IS NOT NULL
          AND personcode <> copersoncode
    ) WHERE rn <= 12""")

# --- Pays, éditeurs, publications, numéros ------------------------------------------------

step("country", """
    CREATE TABLE country (
        code TEXT PRIMARY KEY, name TEXT, lang TEXT, publications INTEGER, issues INTEGER,
        stories INTEGER
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO country (code, name, lang)
    SELECT countrycode, countryname, defaultlanguage FROM s.inducks_country
    WHERE countrycode IS NOT NULL""")

step("country_name", """
    CREATE TABLE country_name (code TEXT, lang TEXT, name TEXT, PRIMARY KEY (code, lang))
    WITHOUT ROWID""", """
    INSERT OR IGNORE INTO country_name SELECT countrycode, languagecode, countryname
    FROM s.inducks_countryname
    WHERE countrycode IS NOT NULL AND languagecode IS NOT NULL AND countryname IS NOT NULL""")

step("_issuepub", """
    CREATE TABLE _issuepub (issuecode TEXT PRIMARY KEY, publisherid TEXT) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO _issuepub SELECT issuecode, publisherid FROM s.inducks_publishingjob
    WHERE issuecode IS NOT NULL AND publisherid IS NOT NULL""")

step("_toccount", """
    CREATE TABLE _toccount (issuecode TEXT PRIMARY KEY, entries INTEGER, stories INTEGER)
    WITHOUT ROWID""", """
    INSERT INTO _toccount SELECT issuecode, COUNT(*), COUNT(DISTINCT storycode) FROM _entry
    GROUP BY issuecode""")

step("_cover", """
    CREATE TABLE _cover (issuecode TEXT PRIMARY KEY, img TEXT) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO _cover
    SELECT issuecode, img FROM (
        SELECT e.issuecode, t.img, ROW_NUMBER() OVER (
            PARTITION BY e.issuecode ORDER BY e.position, e.entrycode) AS rn
        FROM _entry e JOIN _thumb t ON t.entrycode = e.entrycode
    ) WHERE rn = 1""")

step("issue", """
    CREATE TABLE issue (
        issuecode TEXT PRIMARY KEY, publicationcode TEXT, countrycode TEXT, number TEXT,
        title TEXT, size TEXT, pages INTEGER, price TEXT, printrun TEXT, attached TEXT,
        date TEXT, indexed INTEGER, comment TEXT, entries INTEGER, stories INTEGER,
        publisherid TEXT, img TEXT
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO issue
    SELECT i.issuecode, i.publicationcode, p.countrycode, i.issuenumber, NULLIF(i.title, ''),
           NULLIF(i.size, ''), CAST(NULLIF(i.pages, '') AS INTEGER), NULLIF(i.price, ''),
           NULLIF(i.printrun, ''), NULLIF(i.attached, ''), NULLIF(i.oldestdate, ''),
           i.fullyindexed = 'Y', NULLIF(i.issuecomment, ''), COALESCE(tc.entries, 0),
           COALESCE(tc.stories, 0), ip.publisherid, cv.img
    FROM s.inducks_issue i
    LEFT JOIN s.inducks_publication p ON p.publicationcode = i.publicationcode
    LEFT JOIN _toccount tc ON tc.issuecode = i.issuecode
    LEFT JOIN _issuepub ip ON ip.issuecode = i.issuecode
    LEFT JOIN _cover cv ON cv.issuecode = i.issuecode
    WHERE i.issuecode IS NOT NULL""",
    "CREATE INDEX issue_pubnum ON issue(publicationcode, number)",
    "CREATE INDEX issue_country_date ON issue(countrycode, date)",
    "CREATE INDEX issue_date ON issue(date)")

step("publication", """
    CREATE TABLE publication (
        code TEXT PRIMARY KEY, countrycode TEXT, lang TEXT, title TEXT, size TEXT,
        comment TEXT, circulation TEXT, fake INTEGER, issues INTEGER, first TEXT,
        last TEXT, img TEXT, title_norm TEXT
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO publication
    SELECT p.publicationcode, p.countrycode, p.languagecode, p.title, NULLIF(p.size, ''),
           NULLIF(p.publicationcomment, ''), NULLIF(p.circulation, ''),
           p.numbersarefake = 'Y', 0, NULL, NULL, NULL, norm(p.title)
    FROM s.inducks_publication p WHERE p.publicationcode IS NOT NULL""",
    """UPDATE publication SET
         issues = (SELECT COUNT(*) FROM issue i WHERE i.publicationcode = publication.code),
         first = (SELECT MIN(date) FROM issue i WHERE i.publicationcode = publication.code),
         last = (SELECT MAX(date) FROM issue i WHERE i.publicationcode = publication.code
                 AND date <= strftime('%Y-%m-%d', 'now', '+1 year'))""",
    """UPDATE publication SET img = (SELECT i.img FROM issue i
       WHERE i.publicationcode = publication.code AND i.img IS NOT NULL
       ORDER BY i.date DESC LIMIT 1)""",
    "CREATE INDEX publication_country ON publication(countrycode, issues)",
    """UPDATE country SET
         publications = (SELECT COUNT(*) FROM publication p WHERE p.countrycode = country.code),
         issues = (SELECT COUNT(*) FROM issue i WHERE i.countrycode = country.code),
         stories = (SELECT COUNT(*) FROM story_country s WHERE s.countrycode = country.code)""")

step("publication_name", """
    CREATE TABLE publication_name (code TEXT, name TEXT, PRIMARY KEY (code, name)) WITHOUT ROWID""",
    """INSERT OR IGNORE INTO publication_name SELECT publicationcode, publicationname
       FROM s.inducks_publicationname
       WHERE publicationcode IS NOT NULL AND publicationname IS NOT NULL""")

step("publisher", """
    CREATE TABLE publisher (id TEXT PRIMARY KEY, name TEXT, issues INTEGER, publications INTEGER)
    WITHOUT ROWID""", """
    INSERT OR IGNORE INTO publisher (id, name) SELECT publisherid, publishername
    FROM s.inducks_publisher WHERE publisherid IS NOT NULL""")

step("publisher_publication", """
    CREATE TABLE publisher_publication (
        publisherid TEXT, code TEXT, issues INTEGER, first TEXT, last TEXT,
        PRIMARY KEY (publisherid, code)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO publisher_publication
    SELECT pj.publisherid, i.publicationcode, COUNT(*), MIN(i.date), MAX(i.date)
    FROM s.inducks_publishingjob pj JOIN issue i ON i.issuecode = pj.issuecode
    WHERE pj.publisherid IS NOT NULL AND i.publicationcode IS NOT NULL
    GROUP BY pj.publisherid, i.publicationcode""",
    "CREATE INDEX publisher_publication_code ON publisher_publication(code)",
    """UPDATE publisher SET
         issues = (SELECT SUM(issues) FROM publisher_publication x WHERE x.publisherid = publisher.id),
         publications = (SELECT COUNT(*) FROM publisher_publication x WHERE x.publisherid = publisher.id)""")

# Sommaire d'un numéro, regroupé par numéro puis position.
step("toc", """
    CREATE TABLE toc (
        issuecode TEXT, pos TEXT, entry TEXT, sid INTEGER, storycode TEXT, title TEXT,
        otitle TEXT, kind TEXT, pages INTEGER, num INTEGER, den INTEGER, part TEXT,
        creators TEXT, img TEXT, notes TEXT, first INTEGER, PRIMARY KEY (issuecode, pos, entry)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO toc
    SELECT e.issuecode, COALESCE(e.position, ''),
           CASE WHEN substr(e.entrycode, 1, length(e.issuecode)) = e.issuecode
                THEN substr(e.entrycode, length(e.issuecode) + 1) ELSE e.entrycode END,
           st.sid, st.storycode, e.title,
           CASE WHEN st.title IS NOT e.title THEN st.title END,
           v.kind, v.entirepages, v.num, v.den, e.part, c.creators, COALESCE(t.img, st.img),
           NULLIF(json_patch('{}', json_object(
               'changes', e.changes, 'cut', e.cut, 'minor', e.minorchanges,
               'missing', e.missingpanels,
               'mirrored', CASE WHEN e.mirrored = 'Y' THEN 1 END,
               'sideways', CASE WHEN e.sideways = 'Y' THEN 1 END,
               'uncertain', CASE WHEN e.uncertain = 'Y' THEN 1 END,
               'printedcode', e.printedcode, 'comment', e.comment,
               'hero', e.printedhero, 'in', e.includedin)), '{}'),
           -- Première parution : le numéro a la date de première publication de l'histoire.
           CASE WHEN st.date GLOB '[0-9][0-9][0-9][0-9]*' AND st.date = e.date THEN 1 END
    FROM _entry e
    LEFT JOIN story st ON st.storycode = e.storycode
    LEFT JOIN _ver v ON v.svc = e.svc
    LEFT JOIN _cred c ON c.svc = e.svc
    LEFT JOIN _thumb t ON t.entrycode = e.entrycode""")

# Travaux sur un numéro : indexation, traduction, lettrage, couleur.
step("issue_job", """
    CREATE TABLE issue_job (
        issuecode TEXT, personcode TEXT, job TEXT, PRIMARY KEY (issuecode, personcode, job)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO issue_job SELECT issuecode, personcode, inxtransletcol
    FROM s.inducks_issuejob
    WHERE issuecode IS NOT NULL AND personcode IS NOT NULL AND inxtransletcol IS NOT NULL""")

step("person_issue", """
    CREATE TABLE person_issue (
        code TEXT, job TEXT, date TEXT, issuecode TEXT, PRIMARY KEY (code, job, date, issuecode)
    ) WITHOUT ROWID""", """
    INSERT OR IGNORE INTO person_issue
    SELECT j.personcode, j.job, COALESCE(i.date, ''), j.issuecode
    FROM issue_job j JOIN issue i ON i.issuecode = j.issuecode""",
    """UPDATE person SET indexed = (SELECT COUNT(*) FROM person_issue x
       WHERE x.code = person.code AND x.job = 'i')""")

step("issue_collecting", """
    CREATE TABLE issue_collecting (a TEXT, b TEXT, dir TEXT, PRIMARY KEY (a, dir, b)) WITHOUT ROWID""",
    """INSERT OR IGNORE INTO issue_collecting SELECT collectingissuecode, collectedissuecode, 'collects'
       FROM s.inducks_issuecollecting
       WHERE collectingissuecode IS NOT NULL AND collectedissuecode IS NOT NULL""",
    """INSERT OR IGNORE INTO issue_collecting SELECT collectedissuecode, collectingissuecode, 'collected'
       FROM s.inducks_issuecollecting
       WHERE collectingissuecode IS NOT NULL AND collectedissuecode IS NOT NULL""")


# --- Étiquettes ---------------------------------------------------------------------------
# Noms seuls, sans commentaires ni compteurs : quelques centaines de Ko en tout, vite mis en
# cache par le navigateur. Chaque page qui affiche des auteurs, des personnages ou des
# publications y résout ses noms au lieu de descendre dans les grosses tables.

# Histoire du jour : les 3 000 vraies histoires illustrées les plus publiées, numérotées.
step("story_pick", """
    CREATE TABLE story_pick (n INTEGER PRIMARY KEY, storycode TEXT)""", """
    INSERT INTO story_pick (n, storycode)
    SELECT ROW_NUMBER() OVER (ORDER BY pubs DESC, sid), storycode FROM story
    WHERE kind = 'n' AND img IS NOT NULL AND pages >= 4
    ORDER BY pubs DESC, sid LIMIT 3000""")

# Derniers numéros parus de chaque pays (accueil, page pays) : 80 par pays, prêts à
# afficher, au lieu de piocher dans la grande table des numéros.
step("issue_latest", """
    CREATE TABLE issue_latest (
        countrycode TEXT, date TEXT, issuecode TEXT, publicationcode TEXT, number TEXT,
        title TEXT, img TEXT, stories INTEGER, ptitle TEXT,
        PRIMARY KEY (countrycode, date, issuecode)
    ) WITHOUT ROWID""", """
    INSERT INTO issue_latest
    SELECT countrycode, date, issuecode, publicationcode, number, title, img, stories, ptitle FROM (
        SELECT i.countrycode, i.date, i.issuecode, i.publicationcode, i.number, i.title, i.img,
               i.stories, p.title AS ptitle,
               ROW_NUMBER() OVER (PARTITION BY i.countrycode ORDER BY i.date DESC, i.issuecode) AS rn
        FROM issue i LEFT JOIN publication p ON p.code = i.publicationcode
        WHERE i.countrycode IS NOT NULL AND i.date GLOB '[12][0-9][0-9][0-9]*'
          AND i.date <= date('now'))
    WHERE rn <= 80""")

UI_LANGS = "('fr', 'en', 'de', 'it', 'es', 'pt', 'nl')"

step("person_label", """
    CREATE TABLE person_label (code TEXT PRIMARY KEY, name TEXT) WITHOUT ROWID""",
    "INSERT INTO person_label SELECT code, COALESCE(name, code) FROM person")

step("character_label", """
    CREATE TABLE character_label (code TEXT, lang TEXT, name TEXT, PRIMARY KEY (code, lang))
    WITHOUT ROWID""",
    # Langue vide : le nom de base, utilisé quand la langue demandée n'a pas de nom propre.
    "INSERT INTO character_label SELECT code, '', COALESCE(name, code) FROM character",
    f"""INSERT OR IGNORE INTO character_label
    SELECT code, lang, name FROM (
        SELECT code, lang, name, ROW_NUMBER() OVER (PARTITION BY code, lang
                                                    ORDER BY preferred DESC, name) AS rn
        FROM character_name WHERE lang IN {UI_LANGS})
    WHERE rn = 1""")

step("publication_label", """
    CREATE TABLE publication_label (
        code TEXT PRIMARY KEY, title TEXT, countrycode TEXT, issues INTEGER
    ) WITHOUT ROWID""",
    """INSERT INTO publication_label
       SELECT code, COALESCE(title, code), countrycode, issues FROM publication""")


# --- Recherche plein texte ---------------------------------------------------------------
# Index sans contenu : rowid = sid (ou rowid de la table source). Le texte n'est pas
# dupliqué, seul l'index l'est. Le tokenizer unicode61 replie casse et accents.

FTS = [
    # Tous les titres connus d'une histoire, toutes langues, plus le code et l'en-tête.
    ("fts_story", "unicode61 remove_diacritics 2", """
        SELECT rk.rank, st.storycode || ' ' || COALESCE(st.title, '') || ' ' ||
               COALESCE((SELECT GROUP_CONCAT(t, ' ') FROM (
                   SELECT DISTINCT title AS t FROM story_title x WHERE x.sid = st.sid)), '') ||
               ' ' || COALESCE((SELECT GROUP_CONCAT(t, ' ') FROM (
                   SELECT DISTINCT p.title AS t FROM story_pub p
                   WHERE p.sid = st.sid AND p.title IS NOT NULL)), '') || ' ' ||
               COALESCE((SELECT title FROM storyheader h WHERE h.code = st.header), '')
        FROM story_rank rk JOIN story st ON st.sid = rk.sid"""),
    # Descriptions et résumés.
    ("fts_desc", "unicode61 remove_diacritics 2", """
        SELECT st.sid, (SELECT GROUP_CONCAT(text, ' ') FROM story_desc d WHERE d.sid = st.sid)
        FROM story st
        WHERE EXISTS (SELECT 1 FROM story_desc d WHERE d.sid = st.sid)"""),
]

#: Petites tables de noms : FTS trigram AVEC une colonne clé (pas de rowid stable à exploiter).
NAME_FTS = [
    ("fts_person", """
        SELECT code, norm(code || ' ' || COALESCE(name, '') || ' ' ||
               COALESCE((SELECT GROUP_CONCAT(name, ' ') FROM person_alias a WHERE a.code = p.code), '')
               || ' ' || COALESCE(birthname, ''))
        FROM person p"""),
    ("fts_character", """
        SELECT code, norm(code || ' ' || COALESCE(name, '') || ' ' ||
               COALESCE((SELECT GROUP_CONCAT(name, ' ') FROM (
                   SELECT DISTINCT name FROM character_name n WHERE n.code = c.code
                   UNION SELECT name FROM character_alias a WHERE a.code = c.code)), ''))
        FROM character c"""),
    ("fts_publication", """
        SELECT code, norm(code || ' ' || COALESCE(title, '') || ' ' ||
               COALESCE((SELECT GROUP_CONCAT(name, ' ') FROM publication_name n
                         WHERE n.code = p.code), ''))
        FROM publication p"""),
    ("fts_publisher", "SELECT id, norm(COALESCE(name, '') || ' ' || id) FROM publisher"),
    ("fts_subseries", """
        SELECT code, norm(code || ' ' || COALESCE(name, '') || ' ' ||
               COALESCE((SELECT GROUP_CONCAT(name, ' ') FROM subseries_name n
                         WHERE n.code = s.code), ''))
        FROM subseries s"""),
    ("fts_universe", """
        SELECT code, norm(code || ' ' || COALESCE((SELECT GROUP_CONCAT(name, ' ')
               FROM universe_name n WHERE n.code = u.code), ''))
        FROM universe u"""),
]


#: Supprimées une fois story_doc et les index plein texte construits.
DROP_AFTER_FTS = ["story_text", "story_version", "story_ref", "story_url", "story_part"]


def build_final(staging: str, out: str) -> dict:
    if os.path.exists(out):
        os.remove(out)
    db = sqlite3.connect(out)
    db.execute("PRAGMA page_size=4096")
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("PRAGMA cache_size=-800000")
    db.execute("PRAGMA temp_store=MEMORY")
    db.create_function("norm", 1, norm, deterministic=True)
    db.create_function("pack", 1, pack, deterministic=True)
    db.execute(f"ATTACH DATABASE '{staging}' AS s")

    t0 = time.time()
    for name, ddl, fill in STEPS:
        t = time.time()
        db.execute(f'DROP TABLE IF EXISTS "{name}"')
        db.execute(ddl)
        for stmt in fill:
            db.execute(stmt)
        db.commit()
        n = db.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
        print(f"  ok {name:<24} {n:>10,} lignes  {time.time() - t:6.1f}s")

    print("\n[final] recherche plein texte")
    for name, tok, select in FTS:
        t = time.time()
        db.execute(f"CREATE VIRTUAL TABLE {name} USING fts5(text, content='', "
                   f"tokenize=\"{tok}\", columnsize=0)")
        db.execute(f"INSERT INTO {name}(rowid, text) {select}")
        db.execute(f"INSERT INTO {name}({name}) VALUES('optimize')")
        db.commit()
        print(f"  ok {name:<24} {time.time() - t:6.1f}s")
    for name, select in NAME_FTS:
        t = time.time()
        db.execute(f"CREATE VIRTUAL TABLE {name} USING fts5(key UNINDEXED, text, "
                   f"tokenize='trigram')")
        db.execute(f"INSERT INTO {name}(key, text) {select}")
        db.execute(f"INSERT INTO {name}({name}) VALUES('optimize')")
        db.commit()
        n = db.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
        print(f"  ok {name:<24} {n:>10,} lignes  {time.time() - t:6.1f}s")

    # Tables dont le contenu vit désormais dans story_doc (et dans l'index fts_desc).
    for name in DROP_AFTER_FTS:
        db.execute(f'DROP TABLE IF EXISTS "{name}"')
    db.commit()

    # Nettoyage des tables de travail.
    for (name,) in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '\\_%' ESCAPE '\\'"
    ).fetchall():
        db.execute(f'DROP TABLE "{name}"')
    db.commit()
    db.execute("DETACH DATABASE s")

    # Métadonnées : date du dump, comptes, utilisées par l'accueil.
    q = lambda sql: db.execute(sql).fetchone()[0]
    stats = {
        "stories": q("SELECT COUNT(*) FROM story"),
        "issues": q("SELECT COUNT(*) FROM issue"),
        "publications": q("SELECT COUNT(*) FROM publication"),
        "creators": q("SELECT COUNT(*) FROM person WHERE stories > 0"),
        "characters": q("SELECT COUNT(*) FROM character WHERE stories > 0"),
        "countries": q("SELECT COUNT(*) FROM country WHERE publications > 0"),
        "entries": q("SELECT COUNT(*) FROM toc"),
        "maxsid": q("SELECT MAX(sid) FROM story"),
    }
    db.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID")
    db.executemany("INSERT INTO meta VALUES (?, ?)", [
        ("built", dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")),
        ("stats", json.dumps(stats)),
        ("schema", "2"),
    ])
    db.commit()

    print("\n[final] ANALYZE + VACUUM…")
    db.execute("ANALYZE")
    db.commit()
    db.execute("VACUUM")
    db.close()
    print(f"[final] {human(os.path.getsize(out))} en {time.time() - t0:.0f}s")
    return stats


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("isv_dir")
    ap.add_argument("out_db")
    ap.add_argument("--staging", default=None, help="chemin de la base de travail")
    ap.add_argument("--reuse-staging", action="store_true",
                    help="réutiliser une base de travail existante")
    ap.add_argument("--dump-date", default=None, help="date du dump Inducks (AAAA-MM-JJ)")
    args = ap.parse_args()

    staging = args.staging or os.path.join(os.path.dirname(os.path.abspath(args.out_db)),
                                           "staging.sqlite")
    t0 = time.time()
    if not (args.reuse_staging and os.path.exists(staging)):
        print("[staging] chargement des ISV")
        build_staging(args.isv_dir, staging)
    print("[final] construction des tables publiées")
    stats = build_final(staging, args.out_db)
    if args.dump_date:
        db = sqlite3.connect(args.out_db)
        db.execute("INSERT OR REPLACE INTO meta VALUES ('dump', ?)", (args.dump_date,))
        db.commit()
        db.execute("VACUUM")
        db.close()
    print(f"\n[build] {json.dumps(stats)}")
    print(f"[build] durée totale : {time.time() - t0:.0f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
