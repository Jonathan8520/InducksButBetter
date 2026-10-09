/// <reference lib="webworker" />
/**
 * worker.ts — Détient une connexion SQLite sur la base distante et exécute les requêtes.
 *
 * Plusieurs workers tournent en parallèle (cf. client.ts) : SQLite est synchrone et chaque
 * lecture de tranche bloque son worker, donc des requêtes indépendantes — les blocs d'une
 * fiche, les vignettes d'une page de résultats — avancent plus vite côte à côte.
 */
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { ChunkReader, STALE } from "./chunkReader";
import { installVfs, VFS_NAME } from "./vfs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type Param = string | number | null;

export interface QueryRequest {
  id: number;
  type: "query";
  sql: string;
  params?: Param[];
  maxRows?: number;
  timeoutMs?: number;
}

export interface OpenRequest {
  id: number;
  type: "open";
  manifestUrl: string;
}

export type Request = QueryRequest | OpenRequest;

export interface QueryResponse {
  id: number;
  ok: true;
  rows: Record<string, unknown>[];
  columns: string[];
  truncated: boolean;
  ms: number;
  io: { requests: number; bytes: number; hits: number };
}

export interface OpenResponse {
  id: number;
  ok: true;
  manifest: ChunkReader["manifest"];
}

export interface ErrorResponse {
  id: number;
  ok: false;
  error: string;
}

let sqlite3: Any = null;
let db: Any = null;
let reader: ChunkReader | null = null;
let deadline = 0;

async function open(manifestUrl: string) {
  if (!sqlite3) {
    const init = sqlite3InitModule as unknown as (o?: Any) => Promise<Any>;
    sqlite3 = await init({ print: () => {}, printErr: (m: string) => console.warn("[sqlite]", m) });
  }
  reader = await ChunkReader.load(manifestUrl);
  installVfs(sqlite3, reader);
  db?.close?.();
  db = new sqlite3.oo1.DB({ filename: "/inducks.sqlite", flags: "r", vfs: VFS_NAME });
  // Une page relue est une requête réseau évitée : cache SQLite généreux, et pas de
  // fichiers temporaires (le VFS n'en sert pas).
  db.exec("PRAGMA cache_size = -16000; PRAGMA temp_store = MEMORY;");
  // Garde-fou de durée : SQLite appelle ce gestionnaire régulièrement, et l'interruption
  // rend la main proprement au lieu de figer le worker sur une requête sans fin.
  sqlite3.capi.sqlite3_progress_handler(
    db.pointer,
    1000,
    () => (deadline && Date.now() > deadline ? 1 : 0),
    0,
  );
  return reader.manifest;
}

function query(req: QueryRequest): Omit<QueryResponse, "id" | "ok"> {
  if (!db || !reader) throw new Error("database not open");
  const started = performance.now();
  deadline = req.timeoutMs ? Date.now() + req.timeoutMs : 0;
  reader.takeStats();
  const rows: Record<string, unknown>[] = [];
  let columns: string[] = [];
  let truncated = false;
  try {
    const stmt = db.prepare(req.sql);
    try {
      if (req.params?.length) stmt.bind(req.params);
      columns = stmt.getColumnNames();
      const max = req.maxRows ?? Infinity;
      while (stmt.step()) {
        if (rows.length >= max) {
          truncated = true;
          break;
        }
        rows.push(stmt.get({}));
      }
    } finally {
      stmt.finalize();
      deadline = 0;
    }
  } catch (err) {
    // SQLite ne voit qu'une erreur d'entrée-sortie : on rend la vraie cause au client.
    if (reader.stale) throw new Error(STALE);
    throw err;
  }
  return { rows, columns, truncated, ms: performance.now() - started, io: reader.takeStats() };
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const req = event.data;
  try {
    if (req.type === "open") {
      const manifest = await open(req.manifestUrl);
      self.postMessage({ id: req.id, ok: true, manifest } satisfies OpenResponse);
    } else {
      const result = query(req);
      self.postMessage({ id: req.id, ok: true, ...result } satisfies QueryResponse);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ id: req.id, ok: false, error: message } satisfies ErrorResponse);
  }
};
