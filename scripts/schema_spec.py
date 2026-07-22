"""
schema_spec.py — La forme de la base construite : quoi garder, comment regrouper, quoi indexer.

DEUX RÈGLES DIRECTRICES, toutes deux mesurées sur le dump réel (cf. PLAN.md §2bis).

1. LES INDEX SONT LE POSTE DE DÉPENSE, PAS LE FTS5.
   Sur la première construction, 42 index ont coûté 372 Mo quand 11 tables FTS5 n'en
   coûtaient que 73,5 Mo. Chaque index doit donc servir une requête identifiée dans le code.

2. REGROUPER PHYSIQUEMENT BAT INDEXER.
   « Parutions d'une histoire » coûtait 561 pages / 415 requêtes HTTP. Un index couvrant n'y
   a rien changé (+89 Mo, 420 requêtes) : les lignes visées sont dispersées, et c'est la
   disposition physique qui compte. La même donnée regroupée dans une table `WITHOUT ROWID`
   ordonnée par storycode : 9 pages, 9 requêtes. 62x moins de trafic.

   Sur un backend en requêtes HTTP Range, l'intuition s'inverse : la normalisation coûte
   cher, la dénormalisation regroupée est le gain. On échange du stockage serveur — gratuit
   et illimité sur CDN — contre des requêtes client, seule ressource réellement rare.
"""

# ======================================================================================
# 1. TABLES ÉCARTÉES
# ======================================================================================
# Aucune requête de l'application ne les touche (vérifié par grep sur src/, en excluant
# defaultSchema.ts et dbWorker.ts qui ne font que décrire un schéma sans l'interroger).

DROP_TABLES = {
    # Journal des modifications Inducks
    "inducks_log", "inducks_logdata",
    # Statistiques jamais interrogées (les 3 autres stat* sont conservées, cf. §4)
    "inducks_statpersoncountry", "inducks_statcharactercountry",
    "inducks_statcharacterstory", "inducks_statpersonstory",
    # Référentiels et annexes sans écran associé
    "inducks_characterdetail", "inducks_characterreference", "inducks_currency",
    "inducks_currencyname", "inducks_entrycharactername", "inducks_entryjob",
    "inducks_equiv", "inducks_herocharacter", "inducks_inputfile", "inducks_issuedate",
    "inducks_issueprice", "inducks_issuerange", "inducks_language", "inducks_languagename",
    "inducks_logocharacter", "inducks_movie", "inducks_moviecharacter", "inducks_moviejob",
    "inducks_moviereference", "inducks_publicationcategory", "inducks_publicationurl",
    "inducks_referencereason", "inducks_referencereasonname", "inducks_site",
    "inducks_storycreationdate", "inducks_storyreference", "inducks_storyurl",
    "inducks_studio", "inducks_studiowork", "inducks_subseries", "inducks_substory",
    "inducks_team", "inducks_teammember", "inducks_universename",
}

#: Chargées puis supprimées : elles ne servent qu'à construire les tables dérivées.
#: inducks_entryurl pèse 203,8 Mo à elle seule (26 % du dump) et disparaît au profit des
#: trois tables de vignettes ci-dessous — un gain net d'environ 180 Mo, plus l'index de
#: 60 à 150 Mo qu'il aurait fallu poser dessus.
STAGING_TABLES = {
    "inducks_entryurl",   # -> story_thumb, entry_thumb, issue_thumb
    "inducks_storycodes", # -> inducks_story.storycode_packed
}

#: Colonnes retirées à la lecture : constantes ou inexploitées.
#: inducks_entryurl.public vaut 'Y' sur 100 % des 2 707 594 lignes (vérifié : 1 seule
#: valeur distincte en base).
DROP_COLUMNS = {
    "inducks_entryurl": {"public"},
}


# ======================================================================================
# 2. REGROUPEMENT PHYSIQUE (WITHOUT ROWID)
# ======================================================================================
# Déclarer la clé naturelle en PRIMARY KEY d'une table WITHOUT ROWID fait que *la table est
# le B-tree* : les lignes d'une même clé sont physiquement contiguës, donc lues en une ou
# deux requêtes Range au lieu d'une par ligne. Cela remplace un index secondaire au lieu de
# s'y ajouter — c'est le plus gros levier de taille de toute la spec.
#
# build_db.py bascule automatiquement sur une table ordinaire + index si une colonne de clé
# contient des NULL ou si des doublons sont détectés, et le signale.

PRIMARY_KEYS: dict[str, list[str]] = {
    # --- Clés naturelles des tables principales ----------------------------------------
    # Sans elles, tout `WHERE storycode = ?` serait un parcours complet : les tables issues
    # de l'ISV n'ont aucune clé déclarée. Regrouper dessus sert aussi les recherches par
    # intervalle (autocompleteStorycode fait `storycode >= ? AND storycode < ?`).
    "inducks_story": ["storycode"],
    "inducks_storyversion": ["storyversioncode"],
    "inducks_issue": ["issuecode"],
    "inducks_publication": ["publicationcode"],
    "inducks_person": ["personcode"],
    "inducks_character": ["charactercode"],
    "inducks_appearance": ["storyversioncode", "charactercode"],
    "inducks_storyjob": ["storyversioncode", "personcode", "plotwritartink"],

    # --- Le levier principal : inducks_entry pèse 183,6 Mo -----------------------------
    # Regroupée par issuecode, elle sert le sommaire d'un numéro sans index secondaire.
    # `position` ne peut PAS entrer dans la clé : la construction a montré qu'elle contient
    # des valeurs vides, ce qui rendait la clé inutilisable (SQLite refuse un NULL dans la
    # PK d'une table WITHOUT ROWID). entrycode, lui, est renseigné sur les 2 023 594 lignes
    # et suffit à rendre la clé unique. Le tri par position porte alors sur les quelques
    # dizaines d'entrées d'un même numéro, déjà contiguës.
    "inducks_entry": ["issuecode", "entrycode"],

    # --- Tables dont l'ordre naturel ISV colle déjà à toutes les requêtes ---------------
    "inducks_storydescription": ["storyversioncode", "languagecode"],
    "inducks_storysubseries": ["storycode", "subseriescode"],
    # subseriesname entre dans la clé, comme pour charactername : une sous-série porte
    # plusieurs noms dans la même langue (83 lignes sur 3 607, soit 2,3 % perdus sinon).
    "inducks_subseriesname": ["subseriescode", "languagecode", "subseriesname"],
    # charactername entre dans la clé : un personnage peut porter PLUSIEURS noms dans la
    # même langue (2 409 lignes sur 23 916 le font). Sans elle, une clé
    # (charactercode, languagecode) en écrasait 10 % silencieusement.
    "inducks_charactername": ["charactercode", "languagecode", "charactername"],
    "inducks_characteralias": ["charactercode", "charactername"],
    # PAS de clé sur inducks_personalias : surname et givenname sont vides sur la majorité
    # des lignes, une clé les incluant en écartait 5 721 sur 8 378 (68 %). La table fait
    # 184 Ko, le regroupement n'y apporterait rien de toute façon.
    "inducks_personurl": ["personcode", "sitecode"],
    "inducks_issueurl": ["issuecode", "sitecode"],
    "inducks_issuecollecting": ["collectingissuecode", "collectedissuecode"],
    # inxtransletcol fait partie de la clé : une même personne peut être à la fois
    # indexeur et traducteur sur un numéro (190 lignes le sont). Or le filtre « indexeur »
    # de la recherche teste précisément cette colonne — les perdre fausserait le résultat.
    "inducks_issuejob": ["issuecode", "personcode", "inxtransletcol"],
    "inducks_countryname": ["countrycode", "languagecode"],
    "inducks_statpersonperson": ["personcode", "copersoncode"],
    "inducks_statcharactercharacter": ["charactercode", "cocharactercode"],
    # PAS de clé sur inducks_storyheader : storyheadercode n'y est pas unique (28 doublons
    # sur 418 lignes, soit 7 % perdus). 418 lignes tiennent sur une page, le regroupement
    # ne changerait rien.
    "inducks_publicationname": ["publicationcode", "publicationname"],
    "inducks_publisher": ["publisherid"],
    "inducks_country": ["countrycode"],
    "inducks_universe": ["universecode"],

    # --- Sens inversé par rapport à l'ordre ISV ----------------------------------------
    # L'ISV livre publisherid^issuecode^ mais toutes les requêtes corrèlent sur issuecode.
    # 747 lignes sur 227 629 ne diffèrent que par publishingjobcomment, colonne qu'aucune
    # requête ne lit : leur fusion est délibérée, pas une perte subie. L'inclure dans la
    # clé alourdirait la table groupée pour un contenu jamais affiché.
    "inducks_publishingjob": ["issuecode", "publisherid"],
    # L'ISV livre universecode^charactercode^ ; CharactersSearch filtre sur charactercode.
    "inducks_ucrelation": ["charactercode", "universecode"],
}


# ======================================================================================
# 3. COLONNES ET TABLES DÉRIVÉES
# ======================================================================================

#: Colonnes calculées au build. Chacune remplace un index — ou le rend possible.
#: Format : (table, colonne, type, [instructions SQL exécutées dans l'ordre])
#:
#: ATTENTION AUX SOUS-REQUÊTES CORRÉLÉES ICI. Les colonnes dérivées sont calculées AVANT la
#: création des index : un `UPDATE t SET n = (SELECT COUNT(*) FROM gros WHERE ...)` déclenche
#: un parcours complet de `gros` par ligne de `t`. Mesuré en pratique : 16 821 personnages
#: x 1,7 M d'apparitions, la construction ne terminait jamais.
#: Le motif correct est donc systématiquement : agréger UNE fois dans une table temporaire
#: à clé primaire, puis y piocher.
DERIVED_COLUMNS: list[tuple[str, str, str, list[str]]] = [
    # searchService.ts:192/211 émet `REPLACE(s.storycode,' ','') LIKE 'abc%'`. Envelopper la
    # colonne dans REPLACE() neutralise l'index et impose un scan complet à CHAQUE recherche
    # par storycode, alors que le joker est en fin de motif. Précalculée, la comparaison
    # redevient un parcours d'intervalle.
    ("inducks_story", "storycode_packed", "TEXT", [
        "UPDATE inducks_story SET storycode_packed = lower(replace(storycode, ' ', ''))",
    ]),

    # Compteurs matérialisés : chacun supprime une sous-requête corrélée exécutée une fois
    # par ligne affichée — le motif le plus coûteux de l'application.
    ("inducks_character", "appearancecount", "INTEGER", [
        "DROP TABLE IF EXISTS _agg",
        "CREATE TABLE _agg (k TEXT PRIMARY KEY, n INTEGER) WITHOUT ROWID",
        """INSERT INTO _agg SELECT charactercode, COUNT(*) FROM inducks_appearance
           WHERE charactercode IS NOT NULL GROUP BY charactercode""",
        """UPDATE inducks_character SET appearancecount =
           COALESCE((SELECT n FROM _agg WHERE k = charactercode), 0)""",
        "DROP TABLE _agg",
    ]),
    ("inducks_publication", "issue_count", "INTEGER", [
        "DROP TABLE IF EXISTS _agg",
        "CREATE TABLE _agg (k TEXT PRIMARY KEY, n INTEGER) WITHOUT ROWID",
        """INSERT INTO _agg SELECT publicationcode, COUNT(*) FROM inducks_issue
           WHERE publicationcode IS NOT NULL GROUP BY publicationcode""",
        """UPDATE inducks_publication SET issue_count =
           COALESCE((SELECT n FROM _agg WHERE k = publicationcode), 0)""",
        "DROP TABLE _agg",
    ]),
    ("inducks_country", "publication_count", "INTEGER", [
        "DROP TABLE IF EXISTS _agg",
        "CREATE TABLE _agg (k TEXT PRIMARY KEY, n INTEGER) WITHOUT ROWID",
        """INSERT INTO _agg SELECT countrycode, COUNT(*) FROM inducks_publication
           WHERE countrycode IS NOT NULL GROUP BY countrycode""",
        """UPDATE inducks_country SET publication_count =
           COALESCE((SELECT n FROM _agg WHERE k = countrycode), 0)""",
        "DROP TABLE _agg",
    ]),
    # Remplace le tri published_most/published_least, qui comptait les parutions par
    # histoire candidate sur la table de 183,6 Mo — le pire tri de l'application.
    ("inducks_story", "entry_count", "INTEGER", [
        "DROP TABLE IF EXISTS _agg",
        "CREATE TABLE _agg (k TEXT PRIMARY KEY, n INTEGER) WITHOUT ROWID",
        """INSERT INTO _agg SELECT storycode, COUNT(*) FROM story_publications
           GROUP BY storycode""",
        """UPDATE inducks_story SET entry_count =
           COALESCE((SELECT n FROM _agg WHERE k = storycode), 0)""",
        "DROP TABLE _agg",
    ]),
]

#: Tables dénormalisées et regroupées. L'ordre compte : `depends` doit être construit avant.
#: Format : (nom, DDL, INSERT, dépendances)
MATERIALIZED: list[tuple[str, str, str, list[str]]] = [
    # LE gain mesuré : 561 pages / 415 requêtes -> 9 pages / 9 requêtes.
    ("story_publications", """
        CREATE TABLE story_publications (
            storycode       TEXT NOT NULL,
            entrycode       TEXT NOT NULL,
            issuecode       TEXT,
            issuenumber     TEXT,
            publicationcode TEXT,
            countrycode     TEXT,
            oldestdate      TEXT,
            entry_title     TEXT,
            position        TEXT,
            PRIMARY KEY (storycode, entrycode)
        ) WITHOUT ROWID
     """, """
        INSERT OR REPLACE INTO story_publications
        SELECT sv.storycode, e.entrycode, i.issuecode, i.issuenumber,
               p.publicationcode, p.countrycode, i.oldestdate, e.title, e.position
        FROM inducks_storyversion sv
        JOIN inducks_entry e ON e.storyversioncode = sv.storyversioncode
        JOIN inducks_issue i ON i.issuecode = e.issuecode
        JOIN inducks_publication p ON p.publicationcode = i.publicationcode
        WHERE sv.storycode IS NOT NULL AND e.entrycode IS NOT NULL
     """, []),

    # Les valeurs distinctes du formulaire, figées au build.
    #
    # `SELECT DISTINCT kind FROM inducks_storyversion` coûtait 23 107 pages, 90,3 Mo et
    # 1 249 requêtes HTTP — pour DIX valeurs. Cette seule requête, exécutée au montage du
    # formulaire de recherche, représentait l'essentiel du temps de chargement perçu :
    # bien plus que la recherche elle-même. Un DISTINCT sans index parcourt toute la table.
    ("meta_kind", """
        CREATE TABLE meta_kind (kind TEXT NOT NULL PRIMARY KEY) WITHOUT ROWID
     """, [
        """INSERT OR REPLACE INTO meta_kind
           SELECT DISTINCT kind FROM inducks_storyversion
           WHERE kind IS NOT NULL AND kind <> ''""",
     ], []),

    # Second point chaud mesuré : les personnages d'une histoire coûtaient 87 pages et
    # 79 requêtes, parce que les 170 lignes d'appearance renvoient vers autant de lignes
    # dispersées d'inducks_character. Le nom par défaut est embarqué ici ; la traduction
    # éventuelle reste une jointure sur inducks_charactername, table minuscule et
    # elle-même groupée sur (charactercode, languagecode).
    ("story_characters", """
        CREATE TABLE story_characters (
            storycode         TEXT NOT NULL,
            charactercode     TEXT NOT NULL,
            number            TEXT,
            charactername     TEXT,
            appearancecomment TEXT,
            charactercomment  TEXT,
            PRIMARY KEY (storycode, charactercode)
        ) WITHOUT ROWID
     """, """
        INSERT OR REPLACE INTO story_characters
        SELECT sv.storycode, a.charactercode, MIN(a.number),
               MAX(c.charactername), MAX(a.appearancecomment), MAX(c.charactercomment)
        FROM inducks_appearance a
        JOIN inducks_storyversion sv ON sv.storyversioncode = a.storyversioncode
        LEFT JOIN inducks_character c ON c.charactercode = a.charactercode
        WHERE sv.storycode IS NOT NULL AND a.charactercode IS NOT NULL
        GROUP BY sv.storycode, a.charactercode
     """, []),

    # Vignettes : trois tables d'une ligne par entité, remplaçant les 203,8 Mo
    # d'inducks_entryurl. Priorité 'webusers' d'abord, exactement comme le fait
    # l'application avec son ORDER BY CASE WHEN sitecode='webusers' THEN 0 ELSE 1 END.
    ("entry_thumb", """
        CREATE TABLE entry_thumb (
            entrycode TEXT NOT NULL PRIMARY KEY,
            sitecode  TEXT,
            url       TEXT
        ) WITHOUT ROWID
     """, """
        INSERT OR REPLACE INTO entry_thumb
        SELECT entrycode, sitecode, url FROM (
            SELECT entrycode, sitecode, url,
                   ROW_NUMBER() OVER (
                       PARTITION BY entrycode
                       ORDER BY CASE WHEN sitecode='webusers' THEN 0 ELSE 1 END,
                                pagenumber
                   ) AS rn
            FROM inducks_entryurl
            WHERE entrycode IS NOT NULL AND url IS NOT NULL
        ) WHERE rn = 1
     """, []),

    ("story_thumb", """
        CREATE TABLE story_thumb (
            storycode TEXT NOT NULL PRIMARY KEY,
            sitecode  TEXT,
            url       TEXT
        ) WITHOUT ROWID
     """, """
        INSERT OR REPLACE INTO story_thumb
        SELECT storycode, sitecode, url FROM (
            SELECT storycode, sitecode, url,
                   ROW_NUMBER() OVER (
                       PARTITION BY storycode
                       ORDER BY CASE WHEN sitecode='webusers' THEN 0 ELSE 1 END,
                                pagenumber
                   ) AS rn
            FROM inducks_entryurl
            WHERE storycode IS NOT NULL AND storycode <> '' AND url IS NOT NULL
        ) WHERE rn = 1
     """, []),

    ("issue_thumb", """
        CREATE TABLE issue_thumb (
            issuecode TEXT NOT NULL PRIMARY KEY,
            sitecode  TEXT,
            url       TEXT
        ) WITHOUT ROWID
     """, """
        INSERT OR REPLACE INTO issue_thumb
        SELECT issuecode, sitecode, url FROM (
            SELECT e.issuecode AS issuecode, eu.sitecode AS sitecode, eu.url AS url,
                   ROW_NUMBER() OVER (
                       PARTITION BY e.issuecode
                       ORDER BY CASE WHEN eu.sitecode='webusers' THEN 0 ELSE 1 END,
                                e.position, eu.pagenumber
                   ) AS rn
            FROM inducks_entry e
            JOIN inducks_entryurl eu ON eu.entrycode = e.entrycode
            WHERE e.issuecode IS NOT NULL AND eu.url IS NOT NULL
        ) WHERE rn = 1
     """, []),
    # ---------------------------------------------------------------------------------
    # LA CARTE DE RÉSULTAT PRÉ-ASSEMBLÉE — le plus gros gain de toute la spec.
    #
    # Mesures qui ont conduit à ces deux tables :
    #   - la recherche touchait 1 525 pages réparties en 1 309 plages contiguës, soit
    #     1,2 page par plage : l'accès est quasi parfaitement ALÉATOIRE ;
    #   - 22,4 ms de latence par requête x 1 309 = ~29 s, conformes aux 30-60 s observées
    #     dans le navigateur. Le coût est donc entièrement de l'aller-retour, pas du
    #     volume : 6 Mo se transfèrent en moins d'une seconde ;
    #   - 1,8 % seulement des pages lues étant dans les 32 premiers Mo, aucun
    #     préchargement de « préambule » ne pouvait aider ; et sans séquentialité, la
    #     lecture anticipée non plus.
    #
    # Le seul levier restant est de toucher moins de pages. Une carte assemblée au build
    # ramène la recherche à 165 pages et 126 requêtes (~2,8 s) : 10x moins d'allers-retours.
    #
    # SCINDÉE EN DEUX à dessein. Une table unique par langue coûtait +159 Mo, soit ~950 Mo
    # pour les 6 langues — la base aurait doublé. Or la majorité des champs (parutions,
    # auteurs, vignette, pagination, date) ne dépend pas de la langue : elle n'est stockée
    # qu'une fois. Seuls titre, description et noms de personnages sont dupliqués.
    ("story_card", """
        CREATE TABLE story_card (
            storycode             TEXT NOT NULL PRIMARY KEY,
            publication_list      TEXT,
            creators              TEXT,
            story_thumb           TEXT,
            kind                  TEXT,
            entirepages           INTEGER,
            brokenpagenumerator   INTEGER,
            brokenpagedenominator INTEGER,
            rowsperpage           INTEGER,
            firstpublicationdate  TEXT,
            storyheadercode       TEXT,
            plotsummary           TEXT,
            storyversioncode      TEXT,
            entry_count           INTEGER
        ) WITHOUT ROWID
     """, [
        # Version de référence de chaque histoire, agrégée EN UNE PASSE.
        "DROP TABLE IF EXISTS _bestver",
        """CREATE TABLE _bestver (storycode TEXT PRIMARY KEY, svc TEXT) WITHOUT ROWID""",
        """INSERT INTO _bestver SELECT storycode, MIN(storyversioncode)
           FROM inducks_storyversion WHERE storycode IS NOT NULL GROUP BY storycode""",
        # Auteurs et parutions, également en une passe chacun.
        "DROP TABLE IF EXISTS _cred",
        """CREATE TABLE _cred (storycode TEXT PRIMARY KEY, lst TEXT) WITHOUT ROWID""",
        # Format attendu par StoryResultCard : « role:personcode|nom », séparés par « ; ».
        # Le séparateur par défaut de GROUP_CONCAT est la virgule, et SQLite refuse
        # GROUP_CONCAT(DISTINCT x, sep) : on déduplique donc dans une sous-requête.
        """INSERT INTO _cred
           SELECT storycode, GROUP_CONCAT(entry, ';') FROM (
             SELECT DISTINCT b.storycode AS storycode,
                    sj.plotwritartink || ':' || sj.personcode || '|' || p.fullname AS entry
             FROM _bestver b
             JOIN inducks_storyjob sj ON sj.storyversioncode = b.svc
             JOIN inducks_person p ON p.personcode = sj.personcode
             WHERE sj.plotwritartink IS NOT NULL AND p.fullname IS NOT NULL
           ) GROUP BY storycode""",
        "DROP TABLE IF EXISTS _pubs",
        # `n` est compté ici plutôt que repris de inducks_story.entry_count : cette
        # colonne dérivée est calculée APRÈS les tables regroupées, donc elle n'existe pas
        # encore à ce stade. La compter dans le même GROUP BY ne coûte rien.
        """CREATE TABLE _pubs (storycode TEXT PRIMARY KEY, lst TEXT, n INTEGER) WITHOUT ROWID""",
        # « pays|TITRE de publication », séparés par « ; » — le composant affiche le titre,
        # pas le code. Le décompte sert au tri « le plus publié ».
        """INSERT INTO _pubs
           SELECT storycode, GROUP_CONCAT(entry, ';'), SUM(n) FROM (
             SELECT sp.storycode AS storycode,
                    sp.countrycode || '|' || COALESCE(pub.title, sp.publicationcode) AS entry,
                    COUNT(*) AS n
             FROM story_publications sp
             LEFT JOIN inducks_publication pub ON pub.publicationcode = sp.publicationcode
             GROUP BY sp.storycode, entry
           ) GROUP BY storycode""",
        """INSERT OR REPLACE INTO story_card
           SELECT s.storycode,
                  COALESCE(pb.lst, ''), COALESCE(cr.lst, ''),
                  COALESCE(st.sitecode || '|' || st.url, ''),
                  sv.kind, sv.entirepages, sv.brokenpagenumerator,
                  sv.brokenpagedenominator, sv.rowsperpage, s.firstpublicationdate,
                  s.storyheadercode, sv.plotsummary, b.svc, COALESCE(pb.n, 0)
           FROM inducks_story s
           LEFT JOIN _bestver b ON b.storycode = s.storycode
           LEFT JOIN inducks_storyversion sv ON sv.storyversioncode = b.svc
           LEFT JOIN _cred cr ON cr.storycode = s.storycode
           LEFT JOIN _pubs pb ON pb.storycode = s.storycode
           LEFT JOIN story_thumb st ON st.storycode = s.storycode""",
        "DROP TABLE _cred",
        "DROP TABLE _pubs",
     ], []),

    # Part linguistique : uniquement ce qui change d'une langue à l'autre.
    ("story_card_i18n", """
        CREATE TABLE story_card_i18n (
            languagecode   TEXT NOT NULL,
            storycode      TEXT NOT NULL,
            story_title    TEXT,
            series_title   TEXT,
            description    TEXT,
            character_list TEXT,
            PRIMARY KEY (languagecode, storycode)
        ) WITHOUT ROWID
     """, [
        # storyheadercode n'est pas unique (28 doublons sur 418) : sans déduplication, la
        # jointure multiplierait les lignes de la carte.
        "DROP TABLE IF EXISTS _head",
        """CREATE TABLE _head (storyheadercode TEXT PRIMARY KEY, title TEXT) WITHOUT ROWID""",
        """INSERT INTO _head SELECT storyheadercode, MIN(title)
           FROM inducks_storyheader GROUP BY storyheadercode""",
        # Une ligne par (langue, histoire), en repartant des tables déjà groupées.
        """INSERT OR REPLACE INTO story_card_i18n
           SELECT l.languagecode, s.storycode,
                  COALESCE(s.title, h.title, ''),
                  COALESCE(h.title, ''),
                  COALESCE(sd.desctext, sc.plotsummary, ''),
                  COALESCE(ch.lst, '')
           FROM (SELECT 'fr' AS languagecode UNION ALL SELECT 'en' UNION ALL SELECT 'de'
                 UNION ALL SELECT 'it' UNION ALL SELECT 'es' UNION ALL SELECT 'pt') l
           CROSS JOIN inducks_story s
           LEFT JOIN story_card sc ON sc.storycode = s.storycode
           LEFT JOIN _head h ON h.storyheadercode = s.storyheadercode
           LEFT JOIN inducks_storydescription sd
                  ON sd.storyversioncode = sc.storyversioncode
                 AND sd.languagecode = l.languagecode
           LEFT JOIN (
                SELECT sch.storycode, cn.languagecode AS lc,
                       GROUP_CONCAT(sch.charactercode || '|' ||
                                    COALESCE(cn.charactername, sch.charactername) || '|' ||
                                    COALESCE(sch.appearancecomment, '') || '|' ||
                                    COALESCE(sch.charactercomment, '') || '|', ';') AS lst
                FROM story_characters sch
                LEFT JOIN inducks_charactername cn
                       ON cn.charactercode = sch.charactercode
                GROUP BY sch.storycode, cn.languagecode
           ) ch ON ch.storycode = s.storycode AND ch.lc = l.languagecode""",
        "DROP TABLE _head",
        "DROP TABLE IF EXISTS _bestver",
     ], []),
]


# ======================================================================================
# 3bis. COLONNES NORMALISÉES (accents et casse)
# ======================================================================================
# Le LIKE de SQLite ne replie la casse que pour l'ASCII : « picsou » trouve « Picsou »,
# mais « géant » NE TROUVE PAS « Géant ». Une recherche de « Super picsou géant » ne
# renvoie donc rien, alors que le titre existe. Et même corrigée, elle resterait sensible
# aux accents : « geant » ne trouverait pas « Géant ».
#
# On stocke donc une forme normalisée — minuscules, accents retirés — calculée en Python
# au build (SQLite n'a pas de fonction de dépliage Unicode). L'application normalise la
# saisie de la même façon avant de comparer.
#
# Format : (table, colonne source, colonne normalisée)

NORMALIZED_COLUMNS: list[tuple[str, str, str]] = [
    ("inducks_publication", "title", "title_norm"),
    ("inducks_publicationname", "publicationname", "publicationname_norm"),
    ("inducks_issue", "title", "title_norm"),
    ("inducks_person", "fullname", "fullname_norm"),
    ("inducks_character", "charactername", "charactername_norm"),
]


# ======================================================================================
# 4. INDEX
# ======================================================================================
# Chaque entrée nomme la requête qu'elle sert. Les clés primaires déclarées en §2 ne sont
# pas répétées ici : elles sont déjà l'ordre physique de leur table.

INDEXES: list[tuple[str, list[str]]] = [
    # Sens inverse de la PK (storyversioncode) : la corrélation la plus fréquente de
    # l'appli, présente dans chaque EXISTS de la recherche et 5 fois par page de détail.
    ("inducks_storyversion", ["storycode", "entirepages"]),

    # inducks_entry est regroupée sur (issuecode, position) ; ce sens-là reste nécessaire
    # pour toutes les corrélations e.storyversioncode = sv.storyversioncode.
    ("inducks_entry", ["storyversioncode"]),

    # Onglet Personnages : l'ISV ordonne (storyversioncode, charactercode), l'inverse de ce
    # dont on a besoin.
    ("inducks_appearance", ["charactercode", "storyversioncode"]),

    # Onglet Auteurs : idem, sens inverse de l'ordre naturel.
    ("inducks_storyjob", ["personcode", "storyversioncode", "plotwritartink"]),

    # Tri par défaut de la recherche d'histoires + seuls filtres d'intervalle sargables.
    ("inducks_story", ["firstpublicationdate", "storycode"]),
    # Recherche par storycode, rendue possible par la colonne dérivée.
    ("inducks_story", ["storycode_packed"]),
    # Remonter d'un en-tête de série vers ses histoires : sert la branche storyheader de
    # la recherche par titre, sans quoi cette branche imposerait un parcours complet.
    ("inducks_story", ["storyheadercode", "storycode"]),

    # Filtres de date ET tris date_asc/date_desc (SQLite parcourt un index ASC à l'envers).
    ("inducks_issue", ["oldestdate", "issuecode"]),
    ("inducks_issue", ["publicationcode", "oldestdate", "issuenumber"]),

    # Index couvrant sur une petite table (7 281 lignes) : sert la navigation par pays.
    ("inducks_publication", ["countrycode", "title", "publicationcode", "languagecode"]),
    # Recherche de publication insensible aux accents et à la casse.
    ("inducks_publication", ["title_norm"]),

    # statpersoncharacter est la seule table de stats interrogée dans les deux sens.
    ("inducks_statpersoncharacter", ["charactercode", "total"]),

    # Tri des auteurs par volume indexé.
    ("inducks_person", ["numberofindexedissues", "fullname"]),

    # Chemin storycode -> parutions, dans le sens inverse de la PK.
    ("story_publications", ["issuecode"]),

    # Tri par date sur la carte assemblée : la recherche ordonne par date de première
    # publication avant de découper la page, donc l'index doit servir le tri directement.
    ("story_card", ["firstpublicationdate", "storycode"]),

    # inducks_publishingjob est groupée sur (issuecode, publisherid) ; le filtre « par
    # éditeur » a besoin du sens inverse, sinon il impose un parcours des 258 551 numéros.
    ("inducks_publishingjob", ["publisherid", "issuecode"]),
]


# ======================================================================================
# 5. FTS5
# ======================================================================================
# Remplacent les LIKE '%mot%' non-sargables. Deux tokenizers selon l'usage :
#
#   unicode61 remove_diacritics 2 — texte naturel, accents transparents (fr/de/it/es/pt).
#   trigram                        — colonnes de CODES, où l'appli cherche au milieu d'une
#                                    chaîne (charactercode LIKE '%x%'). unicode61 ne sait
#                                    faire que du préfixe et perdrait ces correspondances.
#
# TABLES AUTONOMES, PAS `content=`.
# Le mode `content=` (index externe) exige que la table source possède un rowid — ce qui est
# incompatible avec les tables WITHOUT ROWID du §2. Mesuré : 9 tables FTS sur 11 échouaient
# avec « no such column: T.rowid ». Les tables autonomes dupliquent le texte indexé, mais
# elles fonctionnent quelle que soit la table source et se lisent plus simplement depuis
# l'application : `SELECT <clé> FROM fts_x WHERE fts_x MATCH ?`, sans jointure sur rowid.
#
# Format : (nom, table source, colonne clé, colonnes indexées, tokenizer)
# La colonne clé est déclarée UNINDEXED : elle est stockée pour être relue, pas tokenisée.

FTS_TABLES: list[tuple[str, str, str, list[str], str]] = [
    ("fts_storyheader", "inducks_storyheader", "storyheadercode", ["title"],
     "unicode61 remove_diacritics 2"),
    ("fts_story", "inducks_story", "storycode", ["title"],
     "unicode61 remove_diacritics 2"),
    # Indexée depuis story_publications, PAS depuis inducks_entry : cette dernière est
    # groupée sur (issuecode, entrycode), donc une jointure sur entrycode seul n'a aucun
    # index à emprunter — mesuré, le planificateur balayait alors les 734 876 versions
    # d'histoires. story_publications porte déjà storycode ET entry_title côte à côte :
    # la recherche par titre imprimé se fait sans la moindre jointure.
    ("fts_entrytitle", "story_publications", "storycode", ["entry_title"],
     "unicode61 remove_diacritics 2"),
    ("fts_storydescription", "inducks_storydescription", "storyversioncode", ["desctext"],
     "unicode61 remove_diacritics 2"),
    ("fts_storyversion", "inducks_storyversion", "storyversioncode", ["plotsummary"],
     "unicode61 remove_diacritics 2"),
    ("fts_issue", "inducks_issue", "issuecode", ["title"],
     "unicode61 remove_diacritics 2"),

    # Colonnes portant des codes : trigram, seul tokenizer capable de retrouver une
    # sous-chaîne au milieu d'un identifiant (l'appli fait `charactercode LIKE '%x%'`).
    # unicode61 ne sait faire que du préfixe et perdrait ces correspondances.
    ("fts_person", "inducks_person", "personcode", ["personcode", "fullname"], "trigram"),
    ("fts_character", "inducks_character", "charactercode",
     ["charactercode", "charactername"], "trigram"),
    ("fts_charactername", "inducks_charactername", "charactercode", ["charactername"],
     "trigram"),
    ("fts_publisher", "inducks_publisher", "publisherid",
     ["publisherid", "publishername"], "trigram"),
    ("fts_publication", "inducks_publication", "publicationcode",
     ["publicationcode", "title"], "trigram"),
]
