/**
 * Description du schéma publié, pour l'éditeur SQL (aide) et pour l'assistant IA (prompt).
 * Doit suivre scripts/build_db.py.
 */
export const SCHEMA_DOC = `
story(sid INTEGER PK, storycode TEXT UNIQUE, title, date "first publication AAAA[-MM[-JJ]]", kind "n=story k=newspaper strip g=game c=cover i=illustration t=text story a=article f=centerfold", pages INTEGER, num, den "page fraction", rows "strips per page", hero "charactercode of main hero", creators "role:personcode;… roles p=plot w=script a=pencils i=ink", img, pubs "number of printings", countries "number of countries", header, parts)
story_title(sid, lang, title) PK(sid, lang) -- title of the first printing in each language (fr, en, de, it, nl, da, fi, no, sv, es, pt…)
story_search(sid PK, date, kind, pages REAL, pubs, hero) -- narrow copy of story for fast filtering
story_rank(rank INTEGER PK, sid) -- rank 1 = most printed story
story_pick(n INTEGER PK, storycode) -- the 3000 most printed illustrated stories (story of the day)
issue_latest(countrycode, date, issuecode, publicationcode, number, title, img, stories, ptitle, PK(countrycode, date, issuecode)) -- 80 latest issues per country, cheap for "recent releases"
story_code(code, sid) -- lower-case storycodes without spaces, e.g. 'wos386-02'
story_pub(sid, date, issuecode, pos, title, lang, part) PK(sid, date, issuecode, pos) -- every printing of a story
story_country(countrycode, sid, first) PK(countrycode, sid) -- countries where a story was printed, with first date there
story_job(sid, personcode, role) PK(sid, personcode, role)
story_char(sid, charactercode, n, comment) PK(sid, charactercode)
story_desc(sid, lang, text) PK(sid, lang)
story_doc(storycode PK, sid, doc JSON) -- everything shown on a story page (titles, credits, characters, parts, references)
storyheader(code PK, title, countrycode, comment)
subseries(code PK, name, official, comment, category, stories, first, last, img)
subseries_name(code, lang, name, preferred)
subseries_story(code, date, sid) PK(code, date, sid)
character(code PK, name, official, onetime, heroonly, comment, stories, first, last, first_sid, years "stories per year: 1947:3,1948:12,…")
character_name(code, lang, name, preferred, comment) -- localized names: e.g. code 'US' is Uncle Scrooge, 'Picsou' in fr
character_alias(code, name)
character_story(code, date, sid) PK(code, date, sid) -- stories in which a character appears
character_top(code, kind 'co'|'creator', rank, other, total)
universe(code PK, comment, characters)
universe_name(code, lang, name)
universe_character(universe, stories, code)
person_label(code PK, name) -- compact names, cheapest way to show creator names
character_label(code, lang, name, PK(code, lang)) -- lang '' = base name; fr/en/de/it/es/pt/nl = localized names
publication_label(code PK, title, countrycode, issues)
person(code PK, name, nationality, official, birthname, born, bornplace, died, diedplace, comment, fake, stories, first, last, roles "role:count;…", indexed, years "stories per year: 1947:3,1948:12,…")
person_alias(code, name)
person_url(code, site, url)
person_story(code, date, sid, roles) PK(code, date, sid) -- stories of a creator, roles like 'pwai'
person_top(code, kind 'character'|'co', rank, other, total)
person_issue(code, job, date, issuecode) -- job i=indexer t=translator l=letterer c=colorist
country(code PK, name, lang, publications, issues, stories)
country_name(code, lang, name)
publication(code PK e.g. 'fr/PM', countrycode, lang, title, size, comment, circulation, fake, issues, first, last, img, title_norm)
publication_name(code, name)
publisher(id PK, name, issues, publications)
publisher_publication(publisherid, code, issues, first, last)
issue(issuecode PK e.g. 'fr/PM  272', publicationcode, countrycode, number e.g. '272', title, size, pages, price, printrun, attached, date, indexed, comment, entries, stories, publisherid, img)
toc(issuecode, pos, entry, sid, title, kind, pages, num, den, part, creators, img, notes JSON) PK(issuecode, pos, entry) -- table of contents of an issue
issue_job(issuecode, personcode, job)
issue_collecting(a, b, dir 'collects'|'collected')
fts_story(text) -- FTS5 over all titles; rowid = story_rank.rank. Use: SELECT r.sid FROM fts_story f JOIN story_rank r ON r.rank = f.rowid WHERE fts_story MATCH '"word"'
fts_desc(text) -- FTS5 over descriptions; rowid = sid
fts_person(key, text), fts_character(key, text), fts_publication(key, text), fts_subseries(key, text) -- trigram FTS on lower-case names without accents; key = code
meta(key PK, value)
`.trim();

export const SQL_EXAMPLES: { label: string; sql: string }[] = [
  {
    label: "ex.mostPrinted",
    sql: `SELECT s.storycode, s.title, s.date, s.pubs
FROM story_rank r JOIN story s ON s.sid = r.sid
WHERE s.kind = 'n'
ORDER BY r.rank
LIMIT 20`,
  },
  {
    label: "ex.barksNotInFrance",
    sql: `SELECT s.storycode, s.title, s.date, s.pubs
FROM person_story ps JOIN story s ON s.sid = ps.sid
WHERE ps.code = 'CB' AND s.kind = 'n'
  AND NOT EXISTS (SELECT 1 FROM story_country c WHERE c.countrycode = 'fr' AND c.sid = ps.sid)
ORDER BY s.pubs DESC
LIMIT 50`,
  },
  {
    label: "ex.titleSearch",
    sql: `SELECT s.storycode, s.title, s.date
FROM fts_story f
JOIN story_rank r ON r.rank = f.rowid
JOIN story s ON s.sid = r.sid
WHERE fts_story MATCH '"trésor" OR "treasure"'
ORDER BY f.rowid
LIMIT 30`,
  },
  {
    label: "ex.picsouMagazine",
    sql: `SELECT number, date, title, stories
FROM issue
WHERE publicationcode = 'fr/PM'
ORDER BY date DESC
LIMIT 25`,
  },
  {
    label: "ex.creatorsByCountry",
    sql: `SELECT nationality, COUNT(*) AS creators, SUM(stories) AS stories
FROM person
WHERE stories > 0 AND nationality IS NOT NULL
GROUP BY nationality
ORDER BY stories DESC
LIMIT 20`,
  },
  {
    label: "ex.thisWeek",
    sql: `SELECT l.date, l.issuecode, l.ptitle AS publication, l.number, c.name AS country
FROM issue_latest l JOIN country c ON c.code = l.countrycode
WHERE l.date >= date('now', '-7 days')
ORDER BY l.date DESC, l.countrycode
LIMIT 100`,
  },
  {
    label: "ex.debuts1950",
    sql: `SELECT c.code AS charactercode, c.name, c.first, c.stories
FROM character c
WHERE c.first >= '1950' AND c.first < '1951'
ORDER BY c.stories DESC
LIMIT 25`,
  },
  {
    label: "ex.gyroDebut",
    sql: `SELECT cs.date, s.storycode, s.title
FROM character_story cs JOIN story s ON s.sid = cs.sid
WHERE cs.code = 'GY'
ORDER BY cs.date
LIMIT 10`,
  },
];
