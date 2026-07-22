<div align="center">
  <h1>InducksButBetter</h1>
  <p><strong>A lightning-fast, modern, and serverless frontend for exploring the Disney Comics Database (I.N.D.U.C.K.S.)</strong></p>

  [![React](https://img.shields.io/badge/React_18.2-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite_5.2-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript_5.2-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Turso](https://img.shields.io/badge/Turso_0.14-4FF8D2?style=for-the-badge&logo=sqlite&logoColor=black)](https://turso.tech/)
</div>

<br />

Welcome to **InducksButBetter**! This project is a complete reimagining of the classic Inducks search experience. Built with modern web technologies and a cutting-edge serverless database architecture, it offers instant searches, an elegant dark-mode UI, and powerful SQL exploration tools.

---

## Features

- **Instant search experience:** Autocomplete for characters, authors, and publishers in milliseconds.
- **"My collection" filter:** Paste your raw Inducks collection export and instantly filter stories to only show issues you actually own!
- **Smart SQL editor:** A built-in code editor with syntax highlighting, database schema-aware autocomplete, and auto-suggested tables for power users.
- **AI-powered SQL assistant:** Don't know SQL? Just ask the AI in plain English/French, and it will translate your request into a complex Inducks query!
- **Fully internationalized:** Seamless switching between French and English.
- **100% Serverless:** Direct connection to a remote [Turso](https://turso.tech/) (SQLite) edge database. No heavy backend required!

## Architecture: a static database, queried over HTTP Range

The app no longer talks to a remote database server. It ships a **prebuilt SQLite file**,
published as static chunks, and the browser fetches only the pages a query actually needs
via HTTP Range requests.

Why: a hosted database billed per row read cannot serve a public site for free. Every
`LIKE '%word%'` search was a full table scan, and the free-form SQL tab let any visitor
scan the whole database. Static bytes on a CDN have no such meter.

**What a visitor actually downloads** (measured with an instrumented VFS,
`scripts/measure_io.py`): a session of eight varied queries transfers about **3 MB — roughly
0.3 % of the database**. A story detail page costs ~50 KB, an autocomplete ~30 KB.

The single most effective technique is counter-intuitive: **physical clustering beats adding
indexes**. Fetching the publications of a story through live joins cost 561 pages and 415
HTTP requests; the same data in a purpose-built `WITHOUT ROWID` table clustered by
`storycode` costs 9 pages and 9 requests. On this backend you trade server-side storage —
free and unmetered on a CDN — for client requests, which are the scarce resource.

## Quick start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/) 9+
- [Python](https://www.python.org/) 3.12+ (only to build the database)

### 1. Get the Inducks data

```bash
# Official source, regenerated daily
python scripts/fetch_isv.py data/isv --base https://inducks.org/inducks/isv

# Fallback while inducks.org is down: a public backup of the same files
python scripts/fetch_isv.py data/isv --mega     # needs: pip install pycryptodome
```

### 2. Build and split the database

```bash
python scripts/build_db.py data/isv data/inducks.sqlite
python scripts/check_queries.py data/inducks.sqlite   # no query may fall back to a scan
python scripts/split_db.py data/inducks.sqlite public/db
```

### 3. Install & run

```bash
pnpm install
pnpm dev
```

The app is served at `http://localhost:5173` and reads the chunks from `public/db/`.

Set `VITE_STATIC_DB_URL` to serve the chunks from elsewhere, or to `off` to fall back to the
legacy Turso path (which still requires `VITE_TURSO_DATABASE_URL` and
`VITE_TURSO_AUTH_TOKEN`).

> **Note:** A minimal backend proxy runs on `http://localhost:3000` solely to proxy images from external providers and bypass CORS restrictions. All SQL queries are executed securely directly from the client!

### Using a local database (ISV files)

If you don't want to use Turso, or if you exceed the free-tier limits, you can import the raw Inducks database directly into your browser:
1. Obtain the official Inducks ISV database dump (usually a ZIP file containing `.isv` files).
2. Extract the `.isv` files to a folder on your computer.
3. Click the **Import DB** button in the top right corner of the application.
4. Select all the extracted `.isv` files. The app will parse them, create the tables, build necessary indexes for speed, and load the entire database into a dedicated **Web Worker**.
5. Your searches will now be executed entirely offline, with results **streamed progressively** to the UI without ever freezing your browser!

## Architecture and optimizations

- **Modular React architecture**: The search interface has been completely refactored. The business logic has been extracted into dedicated custom hooks (`useSearchFilters.ts`, `useSearchExecution.ts`, `useMetadata.ts`), and the UI has been split into independent sub-components (`SearchForm.tsx` and `SearchResults.tsx`).
- **Edge database (`@libsql/client/web`)**: The app connects directly to Turso via HTTP.
- **Web Worker Database Engine**: When using a local ISV database, `sql.js` operates entirely inside a Web Worker thread. Heavy SQL searches are executed asynchronously and streamed progressively to the UI, guaranteeing a flawless 60 FPS experience with no UI freezing.
- **Vite bundle optimization (manualChunks)**: Code splitting is configured to separate dependencies (`react-vendor`, `ui-vendor`, `db-vendor`, `ai-vendor`) for faster initial page loads and optimal browser caching.
- **Aggressive caching**: To preserve free-tier quotas, static metadata (countries, universes, languages) is cached via `sessionStorage`.
- **JSON injection**: The personal collection filter uses SQLite's `json_each()` function to pass thousands of issue codes to the database in a single, lightweight payload.

## Deployment (Cloudflare Pages)

`.github/workflows/build-db.yml` runs nightly: it fetches the ISV files, rebuilds the
database, verifies that every real query still uses an index, splits the result into chunks
and deploys.

Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. No database
credentials exist any more — there is nothing left to leak.

**Why Cloudflare Pages rather than R2 or GitHub Pages.** The choice is not about which is
technically nicest, it is about which one *cannot send you a bill*:

| | Free tier | On overage |
|---|---|---|
| **Cloudflare Pages** | unlimited bandwidth, 20 000 files, **25 MiB max per file** | never billed |
| GitHub Pages | 1 GB site, ~100 GB/month soft | never billed (email, or service stops) |
| Cloudflare R2 | 10 GB, 10 M reads/month, egress genuinely free | ⚠️ **billed automatically** |

R2 is the more elegant fit — one big file, no chunking — but its overage is billed, which is
exactly how the previous setup failed. Pages is capped at 25 MiB per file, hence the 20 MiB
chunks. The database is over 1 GB, which rules out GitHub Pages as the primary host.

A `*.pages.dev` subdomain is provided free; no domain purchase is required.

## Credits

- **Luis Bärenfaller**: German, Italian, and Portuguese translations.

---

<div align="center">
  <h3>🌟 Support the project</h3>
  <p>If you find this project useful or simply love Disney comics, please consider <strong>giving it a star</strong>! It helps the project grow and motivates me to add more features. ⭐</p>
  <br />
  <i>Built with ❤️ for Inducks contributors,Disney comics fans and collectors.</i>
</div>
