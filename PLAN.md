# Plan de migration — InducksButBetter

> **But :** un site public, toujours disponible, avec une recherche instantanée, pour **0 €**
> quel que soit le trafic — et sans aucun compteur facturable.
>
> Document autoportant : il contient tous les faits mesurés nécessaires pour reprendre le
> travail à froid.
>
> Rédigé le 22/07/2026 · Fork `Jonathan8520/InducksButBetter` (amont `WizyxGH/InducksButBetter`)

---

## 1. Constat

### 1.1 Pourquoi le quota Turso a explosé

Le site actuel interroge une base **Turso** (SQLite edge) directement depuis le navigateur.
Turso facture **à la ligne lue**, pas à la requête. Quatre facteurs se cumulent :

1. **Deux scans complets par recherche.** `useSearchExecution.ts:64` lance un `COUNT(*)` sur
   tout le `WHERE`, puis la requête principale.
2. **Filtres non-sargables.** Tous les filtres texte sont des `LIKE '%mot%'` : aucun index
   n'est utilisable, chaque scan traverse la table entière.
3. **Sous-requêtes corrélées par ligne.** Chaque vignette est un
   `(SELECT … FROM inducks_entryurl … LIMIT 1)` rejoué pour chaque ligne retournée.
4. **L'onglet SQL est ouvert à tous.** `SqlEditor.tsx:180` exécute le SQL brut du visiteur,
   sans `LIMIT` forcé, sans validation, sans timeout. Un `SELECT * FROM inducks_entry` d'un
   curieux brûle des millions de lignes lues d'un coup.

S'y ajoute que **le token Turso est compilé dans le bundle public** (le README l'assume
explicitement) : n'importe qui peut l'extraire et taper la base en boucle. Il n'existe
structurellement aucun plafond.

L'auteur amont le confirme lui-même dans son annonce publique du 21/07/2026 :

> *all the solutions I used to host the website and the data are completely free, so while
> you're supposed to be able to directly make any searches on the website that I host,
> **I recommend using it only for SQL queries***

→ Ce n'est pas un problème de trafic, c'est un **coût unitaire par recherche** trop élevé.

### 1.2 Autres problèmes relevés

| # | Problème | Emplacement |
|---|---|---|
| P1 | Le backend proxy d'images **n'existe pas** dans le dépôt. 19 occurrences de `/api/proxy-image` en dur dans 8 composants. En prod → 404. | `StoryResultCard.tsx`, `Autocomplete.tsx`, `MultiAutocomplete.tsx`, `IssueResultCard.tsx`, `CreatorBadge.tsx`, `StoryDetail.tsx`, `IssueDetail.tsx`, `CharactersSearch.tsx` |
| P2 | `getApiUrl()` existe et gère `VITE_API_BASE_URL`, mais n'est **jamais utilisé** pour ces URLs (importé sans usage dans `Autocomplete.tsx`). | `src/lib/api.ts:3` |
| P3 | Code-splitting cassé : `id.includes('react')` attrape `react-day-picker`, `react-i18next`, `lucide-react`, `@uiw/react-codemirror`… donc tout finit dans `react-vendor` et la branche `ui-vendor` n'est jamais atteinte. | `vite.config.ts:38` |
| P4 | Sous-requête morte : `autocompleteCharacter` lit `inducks_characterurl`, **table vide dans le dump** (28 octets). D'où le repli permanent sur `inducks.org/characterthumb.php`, HS actuellement. | `src/lib/turso.ts:38-43` |
| P5 | `loadLocalDb()` lève `"not implemented"` — code mort. | `src/lib/localDb.ts:38` |
| P6 | Base locale perdue à chaque rechargement (rien en IndexedDB). | `src/lib/localDb.ts` |
| P7 | Zéro test, zéro linter. La CI ne fait que build + deploy. ~12 100 lignes de TS/TSX. | `.github/workflows/deploy.yml` |
| P8 | Deux moteurs SQLite en parallèle (`@libsql/client` distant + `sql.js` local) avec deux chemins de code. | `src/lib/db.ts`, `turso.ts`, `localDb.ts` |

### 1.3 État d'inducks.org

**Totalement hors service** au 22/07/2026 — HTTP 503 sur *tout*, y compris les fichiers
statiques `.isv` (donc ce n'est pas seulement le PHP qui tombe).

Vérifié :

```
https://inducks.org/inducks/isv/inducks_publication.isv  → 503
https://inducks.org/inducks/isv/inducks_issue.isv        → 503
https://inducks.org/inducks/isv/inducks_story.isv        → 503
https://inducks.org/bolderbast/                          → 503
https://inducks.org/static.php?c=download                → 503
```

---

## 2. Les données

### 2.1 Source canonique (quand le site est debout)

```
https://inducks.org/inducks/isv/{table}.isv
```

- Format **ISV** : séparateur `^` (accent circonflexe), **pas** de tabulation
- Première ligne = en-têtes de colonnes
- Encodage UTF-8
- Régénéré **quotidiennement**

*(Découvert en lisant `setup_db.py` du dépôt `WizyxGH/disney-comics-watcher`, qui synchronise
Inducks → Turso via un cron GitHub Actions quotidien à 02h00 UTC.)*

### 2.2 Sauvegarde de repli — MEGA

```
https://mega.nz/folder/lSZ3BSIa#5ygCpsBRQrd8JCxvfmMaFg
```

Dossier **`Inducks data 2026-07-05`** — publié par l'auteur amont (Florian / Wizyx) dans son
annonce Discord du 21/07/2026, en réaction à la panne.

**73 fichiers `.isv` · 745,8 Mo · 781 992 688 octets**

C'est un instantané figé du répertoire `https://inducks.org/inducks/isv/` — mêmes noms,
même format.

Répartition du poids :

| Fichier | Octets | Part |
|---|---:|---:|
| `inducks_entryurl.isv` | 203 843 262 | 26,1 % |
| `inducks_entry.isv` | 183 608 035 | 23,5 % |
| `inducks_storyversion.isv` | 95 677 711 | 12,2 % |
| `inducks_storyjob.isv` | 54 030 381 | 6,9 % |
| `inducks_appearance.isv` | 41 706 186 | 5,3 % |
| `inducks_logocharacter.isv` | 33 880 225 | 4,3 % |
| `inducks_story.isv` | 31 549 184 | 4,0 % |
| `inducks_issue.isv` | 26 534 983 | 3,4 % |
| `inducks_storydescription.isv` | 22 765 944 | 2,9 % |
| `inducks_storycodes.isv` | 16 383 969 | 2,1 % |
| `inducks_log.isv` | 11 371 432 | 1,5 % |
| *(62 autres)* | 60 641 376 | 7,8 % |

**Tables abandonnables :** `inducks_log` + `inducks_logdata` (~11,4 Mo, historique des
modifications, sans usage pour une appli de recherche). Les 7 tables `inducks_stat*`
(~12 Mo d'agrégats pré-calculés) sont à évaluer.

**Anomalie :** `inducks_characterurl.isv` fait **28 octets** — la table est vide (cf. P4).

### 2.3 Mesures réelles — ratio ISV → SQLite *(22/07/2026)*

Échantillon téléchargé dans `data/isv/` (18 fichiers, 28,9 Mo). Format confirmé :
séparateur `^`, en-têtes en ligne 1, **`^` terminal en fin de chaque ligne** (donc un champ
vide surnuméraire au `split` — piège à gérer dans le parseur), UTF-8.

Volumétrie constatée : 258 554 numéros, 23 917 noms de personnages, 16 822 personnages,
12 226 auteurs, 7 282 publications, 1 408 éditeurs, 85 pays.

**`inducks_characterurl.isv` ne contient QUE sa ligne d'en-tête** → la table est bien vide,
P4 est confirmé.

Banc d'essai sur `inducks_issue` (25,3 Mo, 258 553 lignes, 19 colonnes), SQLite 3.45.3 :

| Couche | Taille | Ratio | Delta |
|---|---:|---:|---:|
| Table nue (tout en `TEXT`) | 27,4 Mo | ×1,08 | — |
| + 4 index couvrants | 49,2 Mo | ×1,94 | **+21,8 Mo** |
| + FTS5 sur `title` | 52,5 Mo | ×2,08 | +3,3 Mo |

**Enseignement majeur : le coût, ce sont les index, pas le FTS5.** Quatre index doublent
presque la table ; l'index plein texte ne coûte que 3,3 Mo. Le levier d'optimisation est donc
le **choix des index**, pas la parcimonie sur la recherche plein texte.

- **Extrapolation brute sur 745,8 Mo : ~1,5 Go** (plafond pessimiste)
- **Chargement : 1,6 s pour 258 k lignes** → conversion complète en 1 à 2 minutes, la
  reconstruction quotidienne sur GitHub Actions est donc sans souci

Pourquoi 1,5 Go est pessimiste : le banc applique 4 index (dont un composite à 3 colonnes) à
une table effectivement très sollicitée, garde les 19 colonnes en `TEXT` alors que plusieurs
sont des drapeaux `Y`/`N`, ne supprime rien, et l'extrapolation suppose le même traitement
pour toutes les tables — faux, `inducks_entryurl` (26 % du poids) n'a besoin que d'un index.

**Cible réaliste après nettoyage : ~1 Go.**

#### Découverte : `inducks_entryurl` est redondant d'un facteur 3,4

La table la plus lourde du dump (203,8 Mo, 26 % du total) contient **2 707 594 lignes pour
seulement 801 963 `entrycode` distincts**. Les lignes surnuméraires sont la *même image*
déclinée par `sitecode` — seule l'écriture de l'URL change :

```
ae/DC   10a ^ webusers    ^ 1 ^ 2021/12/ae_dc_0010a_001.jpg
ae/DC   10a ^ thumbnails  ^ 1 ^ webusers/2021/12/ae_dc_0010a_001.jpg
ae/DC   10a ^ thumbnails2 ^ 1 ^ webusers/2021/12/ae_dc_0010a_001.jpg
```

Répartition : `thumbnails` et `thumbnails2` comptent **exactement** 836 091 lignes chacun
(miroirs parfaits), `webusers` 715 415, `thumbnails3` 201 029.

Or l'application ne retient jamais qu'une ligne :
`ORDER BY CASE WHEN sitecode='webusers' THEN 0 ELSE 1 END LIMIT 1`.

→ **Ne garder qu'une ligne par `(entrycode, pagenumber)`, celle de plus forte priorité,
reproduit exactement le choix de l'appli tout en supprimant 70 % des lignes.** Implémenté
dans `scripts/build_db.py` (`reduce_entryurl`, `ENTRYURL_PRIORITY`).

**Conséquence d'architecture :** > 1 Go ⇒ **GitHub Pages est écarté comme plan B**,
Cloudflare Pages devient le choix obligé. ~75 tranches de 20 Mio (plafond : 20 000 fichiers).

Leviers de réduction à appliquer en étape 1 : typer les drapeaux en `INTEGER`, n'indexer que
ce que `searchService.ts` interroge réellement, compacter `inducks_entryurl`, abandonner
`inducks_log`/`logdata`, arbitrer `PRAGMA page_size`.

### 2.4 Récupération du dossier MEGA

Le lien MEGA est chiffré côté client. Un script Python isolé
(`scratchpad/mega_list.py`, venv avec `pycryptodome`) déchiffre l'index et les noms :

- Clé du dossier = fragment du lien (`5ygCpsBRQrd8JCxvfmMaFg`), base64url → 16 octets
- Chaque nœud : `k` = `handle:clé_b64`, déchiffré en **AES-ECB** avec la clé du dossier
- Fichiers : clé 32 octets → clé AES = `k[0:16] XOR k[16:32]`, IV = `k[16:24]` + 8 zéros
- Attributs `a` : base64url → **AES-CBC** (IV nul) → préfixe `MEGA` + JSON contenant le nom `n`
- Téléchargement : `POST [{"a":"g","g":1,"n":"<handle>"}]` → URL, puis **AES-CTR**

Le listing fonctionne. Le téléchargement reste à écrire (même schéma de clés).

---

## 2bis. RÉSULTATS DE CONSTRUCTION *(22/07/2026)*

La chaîne complète a tourné de bout en bout sur le dump réel.

### Base construite

```
12 402 627 lignes · 71 tables · 157,7 s

  Sans index                644,0 Mo
  + 42 index              1 016,3 Mo    (+372,3 Mo)
  + 11 tables FTS5          1,1 Go      (+73,5 Mo)

  FINAL : 1 141 723 136 octets (1,1 Go) — ratio ISV x1,46
  Durée totale : 214,1 s
```

**Le ratio réel (×1,46) est bien meilleur que l'extrapolation (×2,08)**, grâce à la réduction
d'`entryurl` (−70 % de lignes), au typage INTEGER automatique et aux deux tables abandonnées.

**Confirmation éclatante de la thèse : les index coûtent 372 Mo, le FTS5 seulement 73,5 Mo.**
Un rapport de 5 pour 1. Le budget d'index est bien le seul poste à surveiller.

### Découpage

```
55 tranches de 20 Mio (la dernière : 8,8 Mo) · page SQLite : 4096 octets
Toutes sous la limite de 25 Mio de Cloudflare Pages ✓
manifest.json : offsets, tailles, empreintes SHA-256
```

### Validation des plans de requêtes — le résultat le plus important

`scripts/check_queries.py` rejoue 20 requêtes représentatives sous `EXPLAIN QUERY PLAN`.
**11/20 sont entièrement indexées. Les 9 autres révèlent deux problèmes distincts :**

**(a) Les `LIKE '%mot%'` — corrigeables par FTS5, déjà prévu**
`autocompleteCharacter`, `autocompletePerson`, `autocompletePublisher`,
`autocompletePublicationTitle`, `search.byTitle_LIKE`.

**(b) Les requêtes mal orientées — AUCUN index ne les corrigera**

```
search.byCharacter
    SCAN s USING COVERING INDEX ix_story_storycode
    CORRELATED SCALAR SUBQUERY 1
      SEARCH sv USING INDEX ix_storyversion_storycode
      SEARCH a  USING INDEX ix_appearance_storyversioncode
```

L'application balaie **les 355 404 histoires** et exécute une sous-requête corrélée pour
chacune. Même chose pour `search.byAuthor` et `publications.byPublisher`.

→ Il faut **inverser le sens de la requête** : partir de la table sélective
(`inducks_appearance` filtrée sur le personnage, `inducks_storyjob` filtrée sur l'auteur)
et remonter vers `inducks_story`, au lieu de descendre depuis `inducks_story`.

**C'est le vrai chantier de l'étape 3, et il n'est pas seulement une question de FTS5.**

### Anomalies élucidées

- **`inducks_substory` : 11 245 lignes « malformées » — faux positif.** Inducks tronque la
  ligne quand les dernières colonnes sont vides ; le parseur complète par `NULL` et
  l'alignement est préservé. Message d'avertissement corrigé pour ne plus alarmer à tort.
  Même cas pour `inducks_subseries` (109 lignes).
- **`inducks_characterurl` : 0 ligne** — confirme P4 définitivement.
- **Un index redondant supprimé** : `inducks_issue(publicationcode)` était un préfixe strict
  de `(publicationcode, oldestdate, issuecode)`. `build_db.py` refuse désormais ce cas
  automatiquement (`check_redundant_indexes`).

### Outillage livré

| Script | Rôle |
|---|---|
| `scripts/fetch_isv.py` | Récupère les ISV — source officielle **ou** sauvegarde MEGA (`--mega`) |
| `scripts/build_db.py` | ISV → SQLite : typage auto, réducteurs, index, FTS5, VACUUM |
| `scripts/schema_spec.py` | La spec d'index et de FTS5, avec la justification de chaque entrée |
| `scripts/split_db.py` | Découpe en tranches + `manifest.json` |
| `scripts/check_queries.py` | Rejoue les requêtes réelles, signale scans et index inutiles |
| `.github/workflows/build-db.yml` | Cron quotidien : fetch → build → check → split → déploie |

### Mesure du trafic réel par requête — `scripts/measure_io.py`

VFS instrumentée (apsw) comptant les pages SQLite réellement lues, converties en requêtes
HTTP Range après fusion des pages contiguës.

**Une session de 8 requêtes variées transfère 3,2 Mo — soit 0,296 % de la base.**

| Requête | Transféré | Requêtes HTTP |
|---|---:|---:|
| Détail d'une histoire | 52 Ko | 13 |
| Autocomplétion storycode | 32 Ko | 8 |
| Recherche par personnage (bien orientée) | 52 Ko | 10 |
| Recherche par personnage (forme actuelle) | 112 Ko | 16 |
| Personnages d'une histoire | 340 Ko | 77 |
| Numéros d'un pays | 620 Ko | 9 |
| **Parutions d'une histoire** | **2,2 Mo** | **415** ⚠ |

### LE principe architectural : regrouper physiquement, ne pas indexer davantage

« Parutions d'une histoire » coûtait 2,2 Mo et 415 requêtes. **Un index couvrant sur
`inducks_entry` n'a rien corrigé** (+89 Mo pour 420 requêtes au lieu de 415) : le coût n'est
pas là. Les 256 `issuecode` résultants sont dispersés dans `inducks_issue`, chacun sur une
page distincte — c'est la *disposition physique* des données, qu'aucun index ne change.

Table dénormalisée et regroupée construite au build :

```sql
CREATE TABLE story_publications (
  storycode, entrycode, issuecode, issuenumber, publicationcode, countrycode, oldestdate,
  PRIMARY KEY (storycode, entrycode)
) WITHOUT ROWID          -- la table EST le B-tree, groupée par storycode
```

| | Pages | Transféré | Requêtes HTTP |
|---|---:|---:|---:|
| Avant (jointures à la volée) | 561 | 2,2 Mo | 415 |
| Après (table regroupée) | **9** | **36 Ko** | **9** |

**62× moins de données, 46× moins de requêtes**, pour +130 Mo côté serveur (1,88 M lignes).

> **Sur un backend en requêtes Range, l'intuition habituelle s'inverse : la normalisation
> coûte cher, la dénormalisation regroupée est le gain.** On échange du stockage serveur —
> gratuit et illimité sur CDN — contre des requêtes client, qui sont la ressource rare.
> À généraliser à tous les chemins chauds en étape 1bis.

### Résultat après réorientation des requêtes et regroupement

**23 requêtes sur 23 entièrement indexées** (`scripts/check_queries.py`). Trafic à froid,
cache vide, mesuré sur la base finale :

| Requête | Avant | Après |
|---|---:|---:|
| **Parutions d'une histoire** | 2,2 Mo · 410 req | **44 Ko · 5 req** |
| Personnages d'une histoire | 340 Ko · 77 req | **52 Ko · 12 req** |
| Détail d'une histoire | 52 Ko · 13 req | 60 Ko · 14 req |
| Autocomplétion storycode | 36 Ko · 9 req | **8 Ko · 2 req** |
| Autocomplétion personnage (trigram) | — | 60 Ko · 12 req |
| Recherche plein texte (FTS5) | — | 116 Ko · 18 req |
| Numéros d'un pays | 620 Ko · 9 req | 628 Ko · **6 req** |

Sur la requête la plus coûteuse : **50x moins de données, 82x moins d'allers-retours.**

« Numéros d'un pays » reste le plus gros volume mais ne coûte que 6 requêtes : c'est un
parcours *séquentiel* d'index couvrant, le motif le plus favorable en Range — beaucoup de
pages contiguës, très peu de requêtes.

**Les trois réorientations appliquées** remplacent un `EXISTS` corrélé par un `IN` qui part
de la table sélective. Plan avant : `SCAN s` sur 355 404 histoires plus une sous-requête par
ligne. Après : `SEARCH a USING INDEX (charactercode=?)` puis accès par clé primaire.

### Cartographie fine du code (6 analyses parallèles + synthèse)

Spec resserrée : **15 index au lieu de 42**, 41 tables supprimables (~98 Mo d'ISV), et des
tables déclarées `WITHOUT ROWID` sur leur clé naturelle plutôt qu'indexées — ce qui
corrobore indépendamment la mesure ci-dessus.

**Défauts du code vérifiés un par un (pas seulement rapportés) :**

| # | Défaut | Emplacement | Vérification |
|---|---|---|---|
| D1 | **Injection SQL** : `` `AND sj.plotwritartink LIKE '%${pr.role}%'` `` construit par concaténation | `searchService.ts:302` | Lu dans le fichier ✅ |
| D2 | **Filtre éditeur cassé** : la requête lit `pjob.storyversioncode`, colonne **inexistante** — l'en-tête réel est `publisherid^issuecode^publishingjobcomment^` | `searchService.ts:327` | En-tête ISV vérifié ✅ |
| D3 | **Titre toujours « Sans titre »** : le composant lit `story.story_title`, la requête sélectionne `s.title` sans alias | `StoryDetail.tsx:141` vs `turso.ts:153` | Les deux lus ✅ |
| D4 | `inducks_publicationname` n'a que **148 lignes pour 7 281 publications** — l'INNER JOIN de `autocompletePublicationTitle` rend 98 % des publications introuvables | `turso.ts:137` | Compté en base ✅ |
| D5 | `inducks_entryurl.public` vaut `Y` sur **100 %** des lignes — colonne à supprimer | — | 1 seule valeur distincte ✅ |

Autres points remontés, à traiter en étape 3 : `COUNT(*)` de pagination exécuté en série
avant la requête paginée ; filtres `description`/`includeComments` sans aucun champ dans
l'UI ; `SUBSTR(borndate,1,4)` non-sargable dans la recherche d'auteurs ; 10 sous-requêtes
corrélées par ligne retournée dans la recherche d'histoires ; éditeur SQL sans `LIMIT`
injecté ni plafond de lignes.

### Prudence sur le typage INTEGER

`build_db.py` n'applique l'affinité INTEGER que si **aucune** valeur de la colonne ne porte de
zéro non significatif — sinon SQLite convertirait `007` en `7`. Vérifié nécessaire :
`inducks_issue.issuenumber` contient des valeurs comme `01-01`.

---

## 3. Architecture cible

### 3.1 Principe

Une base **SQLite pré-construite, servie en statique**, interrogée depuis le navigateur via
**requêtes HTTP Range**. SQLite est paginé : on remplace « lire l'octet N du fichier » par
« GET Range sur l'octet N ». Une requête indexée descend son B-tree en ne demandant que
quelques pages → **quelques dizaines de Ko téléchargés au lieu de la base entière**.

Coût d'hébergement : **des octets statiques sur un CDN**. Aucun compteur ne tourne.

Effet de bord précieux : **l'onglet SQL libre devient inoffensif.** Une requête coûteuse ne
consomme plus que la bande passante et le CPU du visiteur qui la lance.

### 3.2 Comparatif

| | Aujourd'hui | Après |
|---|---|---|
| Données | Turso distant, facturé à la ligne lue | SQLite pré-construit, tranches de 20 Mio |
| Hébergement | GitHub Pages + quota Turso | Cloudflare Pages (site **et** données) |
| Moteur | `@libsql/client` **+** `sql.js` | `@sqlite.org/sqlite-wasm` + VFS HTTP Range |
| Recherche | `LIKE '%mot%'`, scans complets | FTS5 + index couvrants |
| Pagination | `COUNT(*)` sur tout le `WHERE` | Curseur (keyset) |
| Secret | Token dans le bundle public | Aucun secret |
| Hors-ligne | Non | Oui (cache des pages) |
| Coût | Quota épuisé | Rien de facturable |

### 3.3 Point d'appui

**`src/lib/db.ts` est déjà la bonne abstraction.** Ses 18 lignes (`executeQuery()`) isolent
tout le reste du code du moteur sous-jacent. On remplace ce qu'il y a dessous, **l'UI ne
bouge pas**. C'est ce qui rend la migration réaliste.

---

## 4. Décisions techniques

### 4.1 Bibliothèque SQLite WASM

Fraîcheur npm relevée le 22/07/2026 :

| Paquet | Dernière publication |
|---|---|
| `sql.js-httpvfs` | 2022-09-23 (~4 ans) |
| `sqlite-wasm-http` | 2023-12-12 (~2,5 ans) |
| `wa-sqlite` | 2024-01-05 |
| **`@sqlite.org/sqlite-wasm`** | **2026-04-21** ✅ |

**Décision : `@sqlite.org/sqlite-wasm`** (distribution officielle, maintenue par SQLite et
Google) **+ un VFS HTTP maison (~200 lignes)**.

*Justification :* les deux bibliothèques clés en main sont abandonnées ; l'auteur de
`sql.js-httpvfs` écrit lui-même dans son README que c'était « surtout écrit pour de petits
projets personnels » et renvoie vers d'autres solutions. On garde la maîtrise du cache et le
cœur reste maintenu en amont. **Bonus : le même moteur remplace aussi `sql.js` pour l'import
ISV local → une seule couche SQLite au lieu de deux (résout P8).**

### 4.2 Hébergement — la distinction qui compte

Ce n'est pas « gratuit / payant », c'est **« peut / ne peut pas m'envoyer une facture »**.

| Service | Plan gratuit | Dépassement |
|---|---|---|
| **Cloudflare Pages** | Bande passante illimitée, 20 000 fichiers, **25 Mio max/fichier**, 500 builds/mois, sous-domaine `*.pages.dev` gratuit | **Jamais facturé** |
| **GitHub Pages** | Site ≤ 1 Go, ~100 Go/mois (souple), 10 builds/h | **Jamais facturé** (mail du support, ou arrêt) |
| **GitHub Actions** | Illimité sur dépôt public | — |
| **Cloudflare R2** | 10 Go, 10 M opérations lecture/mois, egress vraiment illimité | ⚠️ **Facturé automatiquement** |
| **Cloudflare Workers** | 100 000 req/jour | Bloqué (non facturé) |

**Décision : Cloudflare Pages**, base découpée en tranches de ~20 Mio.

*Justification :* **R2 est écarté malgré son élégance technique** (fichier unique, egress
gratuit) précisément parce que son dépassement part en facturation automatique — c'est le
mode de défaillance exact de Turso. Cloudflare Pages ne peut pas facturer, offre une bande
passante illimitée, et héberge site + données au même endroit.

- Base estimée 0,8–1,5 Go → **~40 à 75 tranches** (plafond : 20 000 fichiers, très loin)
- Chaque tranche < 25 Mio → sous la limite par fichier
- Requêtes Range **à l'intérieur** des tranches → ~100 Ko par recherche
- **Aucun domaine à acheter** : `<projet>.pages.dev` est fourni. Option gratuite plus jolie :
  un sous-domaine `is-a.dev`.

**Plan B — GitHub Pages.** Viable si la base passe sous 1 Go, avec des tranches < 100 Mo
(limite dure de git). Sa limite souple de 100 Go/mois représente ~1 million de recherches
mensuelles à 100 Ko l'unité. Même dépassée : un mail, jamais une facture.

**Fait vérifié :** GitHub Pages **honore bien les requêtes Range** —
`curl -r 0-99 https://wizyxgh.github.io/InducksButBetter/index.html` → `206`, 100 octets,
en-tête `Accept-Ranges: bytes`.

### 4.3 Proxy d'images

Hypothèse à tester : **une balise `<img src>` classique n'a besoin d'aucun CORS.** Le proxy a
probablement été ajouté contre le hotlinking ou pour un souci de referrer, pas pour une vraie
contrainte navigateur.

- **Si l'hypothèse tient** → on supprime le proxy, on pointe directement sur `outducks.org`.
  Zéro infrastructure, et P1/P2 sont résolus au passage.
- **Sinon** → Cloudflare Worker (100 000 req/jour gratuits). Attention : plusieurs vignettes
  par page de résultats, ce plafond peut se remplir.

**Non vérifiable tant qu'inducks.org est HS.** À tester en priorité à son retour.

---

## 5. Étapes

### Étape 0 — Récupérer les données · ✅ *échantillon fait*

- [x] Téléchargeur MEGA écrit (AES-CTR, cf. §2.4) — `scratchpad/mega_get.py`
- [x] **Échantillon récupéré** : 18 fichiers, 28,9 Mo dans `data/isv/`
- [x] `data/`, `*.sqlite` ajoutés au `.gitignore`
- [x] Format validé, ratio mesuré (§2.3)
- [ ] Les 745 Mo complets (~1 min à la vitesse constatée : 25 Mo en 1,8 s)

> Débit MEGA constaté : ~14 Mo/s. Le téléchargement complet n'est pas un obstacle.

### Étape 1 — Convertisseur ISV → SQLite · ✅ *fait (commit `c1fec21`)*

Tout est implémenté dans `scripts/build_db.py` + `scripts/schema_spec.py`. Les points
ci-dessous listaient l'intention ; ce qui a réellement été construit et mesuré figure en
§2bis. Deux enseignements non anticipés méritent d'être retenus :

- **Le regroupement physique bat l'indexation** (62x mesuré). C'est devenu le principe
  directeur de la spec, pas une optimisation de plus.
- **Le typage et les clés doivent être vérifiés, pas supposés.** Une clé incluant une
  colonne souvent vide écartait 68 % d'une table sans que rien n'échoue ; une affinité
  INTEGER naïve aurait transformé le code d'un numéro `007` en `7`. `build_db.py` publie
  désormais un récapitulatif des pertes à chaque construction.

<details>
<summary>Intention initiale (conservée pour mémoire)</summary>

- [ ] Parseur en flux des fichiers `^`-séparés (ne jamais charger 200 Mo en mémoire)
- [ ] S'appuyer sur **`src/lib/defaultSchema.ts`** (543 lignes) qui décrit déjà le schéma
- [ ] Abandonner `inducks_log`, `inducks_logdata` ; évaluer les `inducks_stat*`
- [ ] Étudier la compaction de `inducks_entryurl` (26 % du poids, URLs à préfixes très répétitifs)
- [ ] **Tables FTS5** sur titres, descriptions, résumés (`inducks_storydescription`,
      `inducks_storyheader`, `inducks_entry.title`, `inducks_storyversion.plotsummary`)
- [ ] Index couvrants pour **chaque** tri et **chaque** filtre de `searchService.ts`
- [ ] `PRAGMA page_size` (arbitrer 1024 vs 4096 : granularité fine vs moins de requêtes)
- [ ] `INSERT INTO fts(fts) VALUES('optimize')`, puis `VACUUM` + `ANALYZE`

> **Livrable clé : la taille réelle de la base.** C'est le chiffre dont dépendent le
> découpage et le choix final d'hébergeur.

</details>

### Étape 2 — Moteur de lecture · ✅ *écrit (commit `0a909c3`)*

- [x] `@sqlite.org/sqlite-wasm` dans un Web Worker (`src/lib/sqlite/dbWorker.ts`)
- [x] VFS HTTP traduisant les lectures de pages en requêtes Range (`httpVfs.ts`,
      `rangeReader.ts`), avec cache de blocs LRU borné à 64 Mio
- [x] Branché sous `executeQuery()` (`src/lib/db.ts`) : local / statique distant / Turso
- [ ] **Reste à valider dans un vrai navigateur** — le VFS ne peut pas être exercé ici
- [ ] Cache des pages persistant via l'API Cache indexé par ETag (hors-ligne)
- [ ] Faire converger l'import ISV local sur le même moteur (supprime `sql.js`, résout P8)

> Contrainte structurante : `xRead` est **synchrone** côté SQLite alors que `fetch` est
> asynchrone. D'où le recours à XMLHttpRequest synchrone, autorisé uniquement dans un Web
> Worker — c'est ce qui impose que la base tourne dans un worker. Cette voie évite les
> en-têtes COOP/COEP qu'exigerait la variante SharedArrayBuffer + `Atomics.wait`.

### Étape 3 — Réécriture des requêtes

- [x] Autocomplétions personnages et auteurs sur FTS5, avec repli LIKE (`src/lib/fts.ts`)
- [x] `COUNT(*)` de pagination sorti du chemin critique : il partait **avant** la requête
      paginée, en série — deux parcours complets avant le premier résultat affiché
- [x] Sous-requête morte sur `inducks_characterurl` supprimée (P4)
- [x] `REPLACE(s.storycode,' ','')` remplacé par la colonne `storycode_packed`, sans quoi
      l'index posé pour elle resterait inutilisable
- [x] Vignettes lues dans `story_thumb` / `entry_thumb` / `issue_thumb`
- [x] Parutions et personnages d'une histoire lus dans les tables regroupées
- [x] Éditeur SQL : `LIMIT` injecté quand la requête n'en porte pas
- [ ] Recherche par titre et description sur FTS5 (reste en LIKE)
- [ ] Réorienter les `EXISTS` corrélés de la recherche par personnage / auteur
- [ ] **Préserver `getStorycodeCandidates()`** : ~20 heuristiques répliquant
      `coa/util14-storycode.php`. Fonction pure → candidat idéal pour des tests unitaires

### Étape 4 — Pipeline automatisé · ✅ *écrit*

- [x] `.github/workflows/build-db.yml` : cron quotidien fetch → build → **check_queries**
      → split → déploiement Cloudflare Pages
- [x] Source pilotée par une entrée de workflow : `inducks` (officielle) ou `mega`
      (sauvegarde), un seul paramètre à changer au retour d'inducks.org
- [x] Garde-fou : la CI refuse de publier si le lot d'ISV compte moins de 60 fichiers —
      un téléchargement partiel ne doit pas écraser une base en ligne valide
- [ ] Adapter `base` dans `vite.config.ts:7` au domaine Pages retenu
- [ ] Créer le projet Cloudflare Pages et poser les deux secrets

### Étape 5 — Nettoyage et robustesse

- [ ] Supprimer `@libsql/client` et **le token Turso** (secrets GitHub compris) — le repli
      Turso reste actif tant que le chemin statique n'a pas tourné dans un navigateur
- [ ] Corriger `manualChunks` (`vite.config.ts:38`) — P3
- [ ] Tester la suppression du proxy d'images (§4.3) — P1/P2
- [ ] ESLint + tests unitaires, en commençant par `getStorycodeCandidates()`
- [ ] Faire converger l'import ISV local sur `@sqlite.org/sqlite-wasm` (supprime `sql.js`,
      résout P8) et supprimer `loadLocalDb()` mort (P5)
- [ ] Traduire les libellés français en dur de `src/lib/constants.ts`

---

## 6. Hors périmètre — on n'y touche pas

- Toute l'UI et les composants shadcn/ui
- L'i18n (6 langues, `public/locales/`)
- L'assistant IA WebLLM — déjà 100 % navigateur via WebGPU, donc **déjà gratuit**
- L'éditeur SQL CodeMirror — devient simplement inoffensif
- Le routage par hash de `App.tsx` (un vrai routeur serait souhaitable, mais c'est un autre
  chantier, indépendant de celui-ci)

---

## 7. Risques et inconnues

| Risque | Impact | Atténuation |
|---|---|---|
| ~~Taille finale inconnue~~ | ~~Détermine le découpage~~ | ✅ **Mesuré : ~1,5 Go pessimiste, ~1 Go visé** (§2.3) → Cloudflare Pages confirmé |
| Poids des **index** sous-estimé (pas le FTS5) | Base trop grosse | Mesuré : les index doublent une table. N'indexer que ce que `searchService.ts` interroge |
| Nécessité réelle du proxy d'images | Une brique serveur à maintenir | Tester dès le retour d'inducks.org |
| Date de retour d'inducks.org inconnue | Données figées au 05/07/2026 | Précisément pourquoi on veut notre propre copie |
| Latence des requêtes Range sur des index mal fichus | Recherche lente | Index couvrants → accès séquentiel, pas d'accès aléatoire |
| Politique d'usage équitable Cloudflare | Théoriquement un blocage | Volumétrie très en deçà ; GitHub Pages en repli |

---

## 8. Annexes

### 8.1 État du fork

`Jonathan8520/InducksButBetter` est **strictement identique** à l'amont
`WizyxGH/InducksButBetter` — `git log main..upstream/main` et l'inverse sont tous deux vides.
Aucune release, aucun tag, pas de wiki. Rien à récupérer côté git.

Le site amont : `https://wizyxgh.github.io/InducksButBetter/`.
`inducksbutbetter.is-a.dev` est enregistré mais **ne sert rien** (redirige vers la page
d'accueil d'is-a.dev).

### 8.2 Liens

- Sauvegarde MEGA — `https://mega.nz/folder/lSZ3BSIa#5ygCpsBRQrd8JCxvfmMaFg`
- Source canonique ISV — `https://inducks.org/inducks/isv/{table}.isv`
- Pipeline de référence — `https://github.com/WizyxGH/disney-comics-watcher` (`setup_db.py`, `.github/workflows/update_db.yml`)
- `sql.js-httpvfs` (technique de référence) — https://github.com/phiresky/sql.js-httpvfs
- SQLite WASM officiel — https://sqlite.org/wasm
- Tarifs R2 — https://developers.cloudflare.com/r2/pricing/
- Limites Pages — https://developers.cloudflare.com/pages/platform/limits/
- Limites Workers — https://developers.cloudflare.com/workers/platform/limits/
- Limites GitHub Pages — https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

### 8.3 Fichiers les plus denses

```
741  src/lib/searchService.ts        ← cœur de l'étape 3
617  src/components/Search/SearchForm.tsx
543  src/lib/defaultSchema.ts        ← schéma réutilisable pour l'étape 1
458  src/components/Authors/AuthorsSearch.tsx
452  src/components/Settings.tsx
446  src/components/Search/StoryDetail.tsx
426  src/components/StoryResultCard.tsx
372  src/App.tsx
354  src/lib/turso.ts                ← à supprimer
 18  src/lib/db.ts                   ← point de bascule du moteur
```

Total : ~12 100 lignes de TS/TSX.
