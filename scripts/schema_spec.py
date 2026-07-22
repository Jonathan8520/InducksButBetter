"""
schema_spec.py — Quels index et quelles tables FTS5 construire, et pourquoi.

RÈGLE DIRECTRICE (mesurée, cf. PLAN.md §2.3) : sur `inducks_issue`, 4 index ont fait passer
la table de 27,4 Mo à 49,2 Mo (+80 %), tandis que l'index FTS5 n'a coûté que 3,3 Mo.
Les index sont donc le poste de dépense principal — chacun doit servir une requête réelle,
identifiée dans le code. Un index sans requête associée est une régression.

À l'inverse, sur un backend en requêtes HTTP Range, une requête non indexée ne « rame » pas :
elle télécharge la table entière. L'absence d'index est donc pire que sur un serveur classique.

Format :
    INDEXES    : (table, [colonnes])          — l'ordre des colonnes compte
    FTS_TABLES : (nom_fts, table_source, [colonnes])
"""

# ======================================================================================
# INDEX
# ======================================================================================

INDEXES: list[tuple[str, list[str]]] = [

    # --- Clés d'accès primaires ------------------------------------------------------
    # Les tables sont créées sans PRIMARY KEY (colonnes brutes issues de l'ISV), donc
    # toute recherche par code a besoin de son index sous peine de scan complet.
    ("inducks_story", ["storycode"]),
    ("inducks_storyversion", ["storyversioncode"]),
    ("inducks_entry", ["entrycode"]),
    ("inducks_issue", ["issuecode"]),
    ("inducks_publication", ["publicationcode"]),
    ("inducks_person", ["personcode"]),
    ("inducks_character", ["charactercode"]),
    ("inducks_publisher", ["publisherid"]),
    ("inducks_country", ["countrycode"]),
    ("inducks_storyheader", ["storyheadercode"]),

    # --- Jointures de la recherche d'histoires ---------------------------------------
    # buildAdvancedSearchQuery : story -> storyversion -> entry -> issue -> publication
    ("inducks_storyversion", ["storycode"]),
    ("inducks_entry", ["storyversioncode"]),
    ("inducks_entry", ["issuecode", "position"]),   # sert aussi l'ORDER BY d'IssueDetail
    # NB : pas d'index sur inducks_issue(publicationcode) seul — il serait un préfixe strict
    # du composite (publicationcode, oldestdate, issuecode) plus bas, donc pure redondance.
    # build_db.py refuse désormais ce cas de figure.

    # --- Filtres de la recherche d'histoires ------------------------------------------
    ("inducks_appearance", ["charactercode"]),        # filtre « contient ce personnage »
    ("inducks_appearance", ["storyversioncode"]),     # liste des personnages d'une histoire
    ("inducks_storyjob", ["personcode"]),             # filtre « par cet auteur »
    ("inducks_storyjob", ["storyversioncode"]),       # crédits d'une histoire
    ("inducks_storysubseries", ["storycode"]),
    ("inducks_storydescription", ["storyversioncode"]),
    ("inducks_herocharacter", ["charactercode"]),
    ("inducks_logocharacter", ["charactercode"]),

    # --- Recherche de publications / numéros ------------------------------------------
    # buildPublicationsSearchQuery : tris country_code / date_asc / date_desc / pages
    ("inducks_issue", ["publicationcode", "oldestdate", "issuecode"]),
    ("inducks_issue", ["oldestdate"]),
    ("inducks_publication", ["countrycode"]),
    ("inducks_publicationname", ["publicationcode"]),
    ("inducks_publishingjob", ["issuecode"]),
    ("inducks_publishingjob", ["publisherid"]),
    ("inducks_issuejob", ["issuecode"]),
    ("inducks_issuecollecting", ["collectingissuecode"]),
    ("inducks_issueurl", ["issuecode"]),

    # --- Vignettes ---------------------------------------------------------------------
    # Après réduction, inducks_entryurl a une ligne par (entrycode, pagenumber).
    ("inducks_entryurl", ["entrycode"]),

    # --- Noms localisés ----------------------------------------------------------------
    ("inducks_charactername", ["charactercode", "languagecode"]),
    ("inducks_subseriesname", ["subseriescode"]),
    ("inducks_countryname", ["countrycode", "languagecode"]),
    ("inducks_languagename", ["languagecode"]),
    ("inducks_universename", ["universecode"]),

    # --- Onglets Auteurs / Personnages -------------------------------------------------
    ("inducks_statpersoncharacter", ["personcode"]),
    ("inducks_statcharactercharacter", ["charactercode"]),
    ("inducks_statpersonperson", ["personcode"]),
    ("inducks_statpersoncountry", ["personcode"]),
    ("inducks_statcharactercountry", ["charactercode"]),
]


# ======================================================================================
# FTS5
# ======================================================================================
# Remplacent les `LIKE '%mot%'` non-sargables du code actuel. `remove_diacritics 2` rend
# les accents transparents — indispensable sur un corpus multilingue (fr/de/it/es/pt).
#
# NB : les tables FTS5 sont créées en mode `content=` (contentless-delete), donc elles ne
# dupliquent pas le texte source, seulement son index inversé.

FTS_TABLES: list[tuple[str, str, list[str]]] = [
    # Titres d'histoires — le filtre `title` de la recherche principale
    ("fts_storyheader", "inducks_storyheader", ["title"]),
    ("fts_story", "inducks_story", ["title"]),
    # Titres tels qu'imprimés dans chaque parution (l'autre moitié du filtre `title`)
    ("fts_entry", "inducks_entry", ["title"]),
    # Résumés et descriptions — le filtre `description`
    ("fts_storyversion", "inducks_storyversion", ["plotsummary"]),
    ("fts_storydescription", "inducks_storydescription", ["desctext"]),
    # Autocomplétions (aujourd'hui en LIKE '%x%' sur chaque frappe)
    ("fts_person", "inducks_person", ["fullname"]),
    ("fts_character", "inducks_character", ["charactername"]),
    ("fts_charactername", "inducks_charactername", ["charactername"]),
    ("fts_publisher", "inducks_publisher", ["publishername"]),
    ("fts_publicationname", "inducks_publicationname", ["publicationname"]),
    # Titres de numéros — filtre `specificTitle` de la recherche de publications
    ("fts_issue", "inducks_issue", ["title"]),
]
