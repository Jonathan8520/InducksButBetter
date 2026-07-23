#!/usr/bin/env python3
"""
perf_budget.py — Budget de requêtes HTTP par requête de l'application.

POURQUOI CE FICHIER EXISTE
--------------------------
Sur ce backend, chaque requête SQLite se paie en requêtes HTTP Range, et chaque requête
HTTP coûte une latence d'aller-retour (~22 ms). Le nombre de requêtes est donc LA métrique
de rapidité — bien plus que les octets transférés. Une requête qui parcourt une table au
lieu d'un index passe de 10 à 1 000 requêtes sans lever la moindre erreur : l'écran tourne,
c'est tout.

Ce fichier fige, pour chaque requête que l'application exécute réellement, un plafond de
requêtes HTTP. `perf_test.py` rejoue chacune sous une VFS instrumentée et échoue si le
plafond est dépassé. C'est un test de NON-RÉGRESSION : il attrape le jour où une refonte
de schéma ou une requête réintroduit un parcours de table.

Chaque entrée cite le composant qui exécute la requête, pour qu'on retrouve d'où elle vient.

FORMAT : (nom, sql, params, budget_requêtes_HTTP)
Le budget est délibérément un peu au-dessus du coût mesuré, pour absorber les variations de
disposition d'une reconstruction à l'autre sans devenir permissif.
"""

# Paramètres réels choisis pour tomber sur des entités volumineuses — c'est là que les
# requêtes mal indexées explosent. Donald Duck : 245 557 apparitions. Carl Barks : 4 734
# histoires. « fr/SPG » (Super Picsou Géant) : la publication du cas signalé par l'utilisateur.
STORY = "W OS  178-02"
CHARACTER = "DD"
PERSON = "CB"
ISSUE = "fr/SPG 150"
PUBLICATION = "fr/SPG"
COUNTRY = "fr"

QUERIES: list[tuple[str, str, tuple, int]] = [

    # =============================================================================
    # Métadonnées — chargées au montage de CHAQUE formulaire, donc critiques.
    # =============================================================================
    ("meta.kinds (useMetadata)",
     "SELECT kind FROM meta_kind ORDER BY kind", (), 3),
    ("meta.countries (useMetadata)",
     "SELECT c.countrycode, COALESCE(cn.countryname, c.countryname) as countryname "
     "FROM inducks_country c LEFT JOIN inducks_countryname cn "
     "ON c.countrycode = cn.countrycode AND cn.languagecode = ? ORDER BY countryname",
     ("fr",), 8),
    ("meta.universes (useMetadata)",
     "SELECT universecode, universecomment FROM inducks_universe ORDER BY universecomment",
     (), 3),
    ("meta.subseries (useMetadata)",
     "SELECT subseriescode, subseriesname FROM inducks_subseriesname "
     "WHERE languagecode = ? OR languagecode = 'en' GROUP BY subseriescode "
     "ORDER BY CASE WHEN languagecode = ? THEN 0 ELSE 1 END, subseriesname",
     ("fr", "fr"), 8),

    # =============================================================================
    # Autocomplétions — exécutées à chaque frappe, les plus sensibles à la latence.
    # =============================================================================
    ("autocomplete.character (turso.ts, FTS)",
     "SELECT c.charactercode, COALESCE(MAX(cn.charactername), c.charactername) "
     "FROM fts_character f JOIN inducks_character c ON c.charactercode = f.charactercode "
     "LEFT JOIN inducks_charactername cn ON cn.charactercode = c.charactercode AND cn.languagecode = ? "
     "WHERE fts_character MATCH ? GROUP BY c.charactercode "
     "ORDER BY MAX(COALESCE(cn.preferred, 0)) DESC, c.appearancecount DESC LIMIT 10",
     ("fr", '"donald"'), 70),
    ("autocomplete.person (turso.ts, FTS)",
     "SELECT p.personcode, p.fullname FROM fts_person f "
     "JOIN inducks_person p ON p.personcode = f.personcode "
     "WHERE fts_person MATCH ? ORDER BY p.numberofindexedissues DESC LIMIT 10",
     ('"barks"',), 30),
    ("autocomplete.storycode (turso.ts, intervalle)",
     "SELECT storycode, storyheadercode, title FROM inducks_story "
     "WHERE storycode >= ? AND storycode < ? ORDER BY storycode LIMIT 15",
     ("W OS", "W OT"), 10),
    ("autocomplete.publisher (turso.ts, FTS)",
     "SELECT publisherid, publishername FROM fts_publisher WHERE fts_publisher MATCH ? LIMIT 10",
     ('"egmont"',), 20),
    ("autocomplete.publication (turso.ts, FTS trigram normalisé)",
     "SELECT p.publicationcode, COALESCE(pn.publicationname, p.title) "
     "FROM fts_publication f JOIN inducks_publication p ON p.publicationcode = f.publicationcode "
     "LEFT JOIN inducks_publicationname pn ON pn.publicationcode = p.publicationcode "
     "WHERE fts_publication MATCH ? ORDER BY 2 LIMIT 10",
     ('"super picsou geant"',), 40),

    # =============================================================================
    # Recherche d'histoires — la carte est pré-assemblée (story_card).
    # =============================================================================
    ("search.stories.count (searchService)",
     "SELECT COUNT(s.storycode) as total FROM inducks_story s WHERE s.storycode IN ("
     "SELECT storycode FROM fts_story WHERE fts_story MATCH ? "
     "UNION SELECT sh.storycode FROM fts_storyheader f JOIN inducks_story sh ON sh.storyheadercode = f.storyheadercode WHERE fts_storyheader MATCH ? "
     "UNION SELECT storycode FROM fts_entrytitle WHERE fts_entrytitle MATCH ?)",
     ("bear mountain", "bear mountain", "bear mountain"), 110),
    ("search.stories.page (searchService, carte assemblée)",
     "WITH ids AS (SELECT s.storycode FROM inducks_story s WHERE s.storycode IN ("
     "SELECT storycode FROM fts_story WHERE fts_story MATCH ? "
     "UNION SELECT sh.storycode FROM fts_storyheader f JOIN inducks_story sh ON sh.storyheadercode = f.storyheadercode WHERE fts_storyheader MATCH ? "
     "UNION SELECT storycode FROM fts_entrytitle WHERE fts_entrytitle MATCH ?) "
     "ORDER BY s.firstpublicationdate DESC, s.storycode ASC LIMIT 24) "
     "SELECT c.storycode, i.story_title, c.publication_list, c.creators, c.story_thumb "
     "FROM ids JOIN story_card c ON c.storycode = ids.storycode "
     "LEFT JOIN story_card_i18n i ON i.storycode = ids.storycode AND i.languagecode = ?",
     ("bear mountain", "bear mountain", "bear mountain", "fr"), 130),
    # Voie rapide : la table groupée est déjà triée par date, on lit les 24 premières
    # lignes d'un bloc au lieu de trier 13 000 storycodes via inducks_story.
    ("search.stories.byCharacter (voie rapide)",
     "SELECT storycode FROM character_stories WHERE charactercode = ? "
     "ORDER BY firstpublicationdate DESC, storycode DESC LIMIT 24",
     (CHARACTER,), 10),
    ("search.stories.byAuthor (voie rapide)",
     "SELECT storycode FROM person_stories WHERE personcode = ? "
     "ORDER BY firstpublicationdate DESC, storycode DESC LIMIT 24",
     (PERSON,), 15),

    # =============================================================================
    # Recherche de publications.
    # =============================================================================
    ("search.pub.byCode (suggestion choisie)",
     "SELECT i.issuecode FROM inducks_issue i "
     "JOIN inducks_publication p ON i.publicationcode = p.publicationcode "
     "WHERE p.publicationcode = ? AND i.issuenumber = ? "
     "ORDER BY p.countrycode, i.issuecode LIMIT 24",
     (PUBLICATION, "150"), 25),
    ("search.pub.byTitle (FTS publication)",
     "SELECT i.issuecode FROM inducks_issue i "
     "JOIN inducks_publication p ON i.publicationcode = p.publicationcode "
     "WHERE p.publicationcode IN (SELECT publicationcode FROM fts_publication WHERE fts_publication MATCH ?) "
     "LIMIT 24",
     ('"picsou"',), 40),
    ("search.pub.byCountry",
     "SELECT i.issuecode FROM inducks_issue i "
     "JOIN inducks_publication p ON i.publicationcode = p.publicationcode "
     "WHERE p.countrycode = ? ORDER BY p.countrycode, i.issuecode LIMIT 24",
     (COUNTRY,), 15),
    # Champ « Titre spécifique du numéro ». L'ancienne forme (i.title LIKE '%...%') balayait
    # les 258 551 numéros ; par fts_issue elle passe par l'index plein texte.
    ("search.pub.bySpecificTitle (fts_issue)",
     "SELECT i.issuecode FROM inducks_issue i "
     "JOIN inducks_publication p ON i.publicationcode = p.publicationcode "
     "WHERE i.issuecode IN (SELECT issuecode FROM fts_issue WHERE fts_issue MATCH ?) "
     "ORDER BY p.countrycode, i.issuecode LIMIT 24",
     ('"vie" "trepidante"*',), 25),

    # =============================================================================
    # Fiche Histoire (StoryDetail / getStoryDetail).
    # =============================================================================
    ("story.core (turso.ts)",
     "SELECT s.storycode, s.firstpublicationdate, s.storyheadercode, s.storycomment, s.title "
     "FROM inducks_story s WHERE s.storycode = ?", (STORY,), 5),
    ("story.version (story_card)",
     "SELECT storyversioncode, kind, entirepages, plotsummary, story_thumb "
     "FROM story_card WHERE storycode = ?", (STORY,), 8),
    ("story.characters (story_characters)",
     "SELECT sc.charactercode, COALESCE(cn.charactername, sc.charactername) "
     "FROM story_characters sc LEFT JOIN inducks_charactername cn "
     "ON cn.charactercode = sc.charactercode AND cn.languagecode = ? "
     "WHERE sc.storycode = ? ORDER BY sc.number", ("fr", STORY), 25),
    ("story.publications (story_publications)",
     "SELECT sp.entrycode, sp.issuecode, sp.countrycode FROM story_publications sp "
     "WHERE sp.storycode = ? ORDER BY sp.countrycode, sp.oldestdate", (STORY,), 15),
    ("story.thumbnail (story_thumb)",
     "SELECT sitecode, url FROM story_thumb WHERE storycode = ?", (STORY,), 5),

    # =============================================================================
    # Fiche Numéro (IssueDetail / getIssueDetail).
    # =============================================================================
    ("issue.core (turso.ts)",
     "SELECT i.issuecode, i.issuenumber, i.oldestdate, i.pages, p.title, p.countrycode "
     "FROM inducks_issue i JOIN inducks_publication p ON i.publicationcode = p.publicationcode "
     "WHERE i.issuecode = ?", (ISSUE,), 6),
    ("issue.stories (issue_stories)",
     "SELECT entrycode, position, entirepages, entry_title, storycode, story_title, writers, artists "
     "FROM issue_stories WHERE issuecode = ? ORDER BY position", (ISSUE,), 15),
    ("issue.thumbnail (issue_thumb)",
     "SELECT sitecode, url FROM issue_thumb WHERE issuecode = ?", (ISSUE,), 5),

    # =============================================================================
    # Fiche Personnage (CharacterDetail) — Donald Duck, le pire cas mesuré.
    # =============================================================================
    ("character.core",
     "SELECT charactercode, charactername, official, heroonly, charactercomment "
     "FROM inducks_character WHERE charactercode = ?", (CHARACTER,), 5),
    ("character.names",
     "SELECT languagecode, charactername, preferred FROM inducks_charactername "
     "WHERE charactercode = ? AND charactername IS NOT NULL", (CHARACTER,), 5),
    ("character.topAuthors (statpersoncharacter)",
     "SELECT sc.personcode, sc.total, p.fullname FROM inducks_statpersoncharacter sc "
     "JOIN inducks_person p ON sc.personcode = p.personcode "
     "WHERE sc.charactercode = ? ORDER BY sc.total DESC LIMIT 5", (CHARACTER,), 30),
    ("character.companions (statcharactercharacter)",
     "SELECT scc.cocharactercode, scc.total FROM inducks_statcharactercharacter scc "
     "WHERE scc.charactercode = ? ORDER BY scc.total DESC LIMIT 5", (CHARACTER,), 30),
    ("character.firstAppearance (character_stories)",
     "SELECT storycode, story_title, firstpublicationdate FROM character_stories "
     "WHERE charactercode = ? AND firstpublicationdate != '' "
     "ORDER BY firstpublicationdate ASC LIMIT 1", (CHARACTER,), 20),
    ("character.recentStories (character_stories)",
     "SELECT storycode, story_title, firstpublicationdate, appearances FROM character_stories "
     "WHERE charactercode = ? ORDER BY firstpublicationdate DESC LIMIT 30", (CHARACTER,), 15),

    # =============================================================================
    # Fiche Auteur (AuthorDetail) — Carl Barks.
    # =============================================================================
    ("author.core",
     "SELECT p.personcode, p.fullname, p.nationalitycountrycode, COALESCE(p.story_count, 0) as story_count "
     "FROM inducks_person p WHERE p.personcode = ?", (PERSON,), 5),
    ("author.stories (person_stories)",
     "SELECT storycode, story_title, firstpublicationdate FROM person_stories "
     "WHERE personcode = ? ORDER BY firstpublicationdate DESC LIMIT 20", (PERSON,), 15),
    ("author.topCoauthors (statpersonperson)",
     "SELECT sp.copersoncode, sp.total, p.fullname FROM inducks_statpersonperson sp "
     "JOIN inducks_person p ON sp.copersoncode = p.personcode "
     "WHERE sp.personcode = ? ORDER BY sp.total DESC LIMIT 5", (PERSON,), 30),
    ("author.topCharacters (statpersoncharacter inversé)",
     "SELECT sc.charactercode, sc.total, COALESCE(cn.charactername, c.charactername) "
     "FROM inducks_statpersoncharacter sc "
     "JOIN inducks_character c ON sc.charactercode = c.charactercode "
     "LEFT JOIN inducks_charactername cn ON c.charactercode = cn.charactercode AND cn.languagecode = ? "
     "WHERE sc.personcode = ? ORDER BY sc.total DESC LIMIT 5", ("fr", PERSON), 30),

    # =============================================================================
    # Navigation par pays (CountryList / CountryPublications).
    # =============================================================================
    ("countries.list (compteurs matérialisés)",
     "SELECT countrycode, COALESCE(publication_count, 0) FROM inducks_country "
     "WHERE COALESCE(publication_count, 0) > 0 ORDER BY countrycode", (), 5),
    ("countries.publications (compteur matérialisé)",
     "SELECT publicationcode, title, COALESCE(issue_count, 0) FROM inducks_publication "
     "WHERE countrycode = ? ORDER BY title", (COUNTRY,), 15),
]
