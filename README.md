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

## Quick start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- A [Turso](https://turso.tech/) database containing the Inducks schema

### 1. Environment Setup
Create a `.env` file at the root of the project with your read-only Turso credentials:
```env
VITE_TURSO_DATABASE_URL=libsql://your-database-name.turso.io
VITE_TURSO_AUTH_TOKEN=your-read-only-token
```

### 2. Install & Run
```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```
The application will be available at `http://localhost:5173`.

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

## Deployment (GitHub Pages)

This project is fully automated for deployment on GitHub Pages using GitHub Actions!

1. Add your `VITE_TURSO_DATABASE_URL` and `VITE_TURSO_AUTH_TOKEN` as **Repository Secrets** on GitHub.
2. Push to the `main` branch.
3. The Action will automatically bake your read-only credentials into the static Vite bundle and publish the site.

## Credits

- **Luis Bärenfaller**: German, Italian, and Portuguese translations.

---

<div align="center">
  <h3>🌟 Support the project</h3>
  <p>If you find this project useful or simply love Disney comics, please consider <strong>giving it a star</strong>! It helps the project grow and motivates me to add more features. ⭐</p>
  <br />
  <i>Built with ❤️ for Inducks contributors,Disney comics fans and collectors.</i>
</div>
