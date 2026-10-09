# InducksButBetter

Toutes les bandes dessinées Disney indexées par [I.N.D.U.C.K.S.](https://inducks.org), consultables
dans le navigateur **sans rien télécharger ni importer** : histoires, numéros, publications,
auteurs, personnages, univers et séries, avec une recherche multicritère, votre collection, et un
labo SQL assisté par IA.

**En ligne : https://inducksbutbetter-demo.pages.dev**

## Ce qui change par rapport à la version d'origine

| | Avant | Maintenant |
|---|---|---|
| Données | l'utilisateur télécharge une base de ~320 Mo, ou importe lui-même les fichiers ISV | rien à faire : le navigateur lit à distance les seules pages utiles (quelques centaines de Ko par fiche) |
| Fraîcheur | base figée, reconstruite à la main | reconstruite **chaque nuit** depuis l'export public d'Inducks |
| Assistant SQL | modèle IA téléchargé dans le navigateur (WebGPU, plusieurs centaines de Mo) | modèle hébergé (Workers AI), sans clé ; clé personnelle optionnelle (Groq, OpenRouter, Mistral, Gemini) |
| Interface | thème par défaut de la bibliothèque de composants | identité propre, responsive, animations, palette de recherche (Ctrl K) |

## Architecture

```
inducks.org/isv.tgz ──► scripts/build_db.py ──► inducks.sqlite (~650 Mo)
   (export quotidien)    tables regroupées,        │
                         FTS5, index ciblés         ▼
                                            scripts/split_db.py
                                            tranches de 256 Kio compressées (~210 Mo)
                                                    │
                                                    ▼
                               Cloudflare Pages (site + tranches + /api/ask)
                                                    │
navigateur : React ─► pool de Web Workers SQLite (WASM) ─► VFS HTTP ─► tranches utiles seulement
```

- **Une base pensée pour être lue à distance.** Chaque écran lit des tables regroupées sur sa clé
  d'accès (`WITHOUT ROWID`) : les histoires d'un auteur, le sommaire d'un numéro ou les parutions
  d'une histoire sont contiguës, donc lues en une ou deux requêtes réseau. Les histoires ont un
  identifiant entier ; l'index plein texte des titres est numéroté par popularité, si bien que les
  premiers résultats d'une recherche sont lus sans parcourir les autres.
- **Des tranches immuables.** Chaque reconstruction publie un nouveau dossier de tranches
  (`/db/<empreinte>/`), mises en cache un an par le navigateur. Seul `manifest.json` est revalidé.
- **Plusieurs workers.** SQLite est synchrone : les requêtes indépendantes d'une page (une fiche
  lance une dizaine de requêtes) avancent en parallèle sur 2 à 4 workers.
- **Garde-fous de construction.** `scripts/check_db.py` vérifie le contenu (entités connues) et
  que les requêtes chaudes passent par un index. Une base qui échoue n'est jamais publiée ; si
  inducks.org ne répond pas, la dernière base valide est republiée.

## Développer

Prérequis : Node 22, pnpm 10, Python 3.12.

```bash
pnpm install

# Construire la base localement (5 minutes environ)
mkdir -p data/isv
curl -L -o data/isv.tgz https://inducks.org/inducks/isv.tgz
tar -xzf data/isv.tgz -C data/isv --strip-components=1
python scripts/build_db.py data/isv data/inducks.sqlite
python scripts/check_db.py data/inducks.sqlite
python scripts/split_db.py data/inducks.sqlite data/db
ln -s ../data/db public/db

pnpm dev        # http://localhost:5173
pnpm test       # tests unitaires
pnpm build      # site statique dans dist/
```

## Déploiement

`.github/workflows/deploy.yml` tourne chaque nuit et à chaque poussée sur `main` : vérification
des types et des tests, compilation, téléchargement de l'export Inducks, construction et contrôle
de la base, découpage, puis publication sur Cloudflare Pages (secrets `CLOUDFLARE_API_TOKEN` et
`CLOUDFLARE_ACCOUNT_ID`). Le même workflow publie un miroir sur GitHub Pages dès que Pages est
activé dans les réglages du dépôt (source : GitHub Actions).

La liaison Workers AI (`wrangler.toml`) alimente `functions/api/ask.ts`. Sur le plan gratuit,
l'allocation quotidienne est plafonnée sans facturation possible.

## Crédits

- Données : le projet [I.N.D.U.C.K.S.](https://inducks.org) et ses bénévoles.
- Projet d'origine : [WizyxGH/InducksButBetter](https://github.com/WizyxGH/InducksButBetter).

Site de fans non officiel, sans lien avec The Walt Disney Company.
