/**
 * client.ts — Accès à la base depuis la page : un petit pool de workers SQLite.
 *
 * Chaque worker ouvre sa propre connexion sur la même base distante. Une requête part sur
 * le worker le moins chargé ; les tranches déjà reçues par un worker sont servies aux autres
 * par le cache HTTP du navigateur (elles sont immuables). Une fiche qui lance six requêtes
 * indépendantes les voit donc avancer en parallèle au lieu de s'attendre.
 */
import type {
  ErrorResponse,
  OpenResponse,
  Param,
  QueryResponse,
} from "./worker";
import type { Manifest } from "./chunkReader";

const STALE = "DB_STALE";

export type { Param };
export type Row = Record<string, unknown>;

export interface QueryResult<T = Row> {
  rows: T[];
  columns: string[];
  truncated: boolean;
  ms: number;
  io: { requests: number; bytes: number; hits: number };
}

export interface QueryOptions {
  maxRows?: number;
  timeoutMs?: number;
  /** Worker dédié (éditeur SQL) : une requête longue n'y bloque pas la navigation. */
  lane?: "ui" | "lab";
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

interface Slot {
  worker: Worker;
  busy: number;
  ready: Promise<Manifest>;
  pending: Map<number, Pending>;
}

const MANIFEST_URL =
  (import.meta.env.VITE_DB_URL as string | undefined) ??
  `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}db/manifest.json`;

/**
 * Téléphones et appareils à peu de mémoire : deux workers et des caches plus petits. Les
 * tranches restent dans le cache HTTP du navigateur, une relecture ne coûte qu'une
 * décompression.
 */
const MODEST =
  ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4 ||
  (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);
const POOL_SIZE = MODEST ? 2 : Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
const CACHE_BYTES = (MODEST ? 16 : 48) * 1024 * 1024;

let nextId = 1;
const pool: Slot[] = [];
let lab: Slot | null = null;
let manifestPromise: Promise<Manifest> | null = null;

/** Trafic cumulé depuis l'ouverture de la page, affiché dans le panneau « réseau ». */
export const sessionIo = { requests: 0, bytes: 0, queries: 0 };
const listeners = new Set<() => void>();
export function onIo(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function spawn(): Slot {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, Pending>();
  worker.onmessage = (event: MessageEvent<QueryResponse | OpenResponse | ErrorResponse>) => {
    const msg = event.data;
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.ok) entry.resolve(msg);
    else entry.reject(new Error(msg.error));
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || "worker error");
    for (const p of pending.values()) p.reject(error);
    pending.clear();
  };
  const slot: Slot = { worker, busy: 0, pending, ready: Promise.resolve(null as never) };
  slot.ready = send<OpenResponse>(slot, { type: "open", manifestUrl: MANIFEST_URL, cacheBytes: CACHE_BYTES }).then(
    (r) => r.manifest,
  );
  return slot;
}

function send<T>(slot: Slot, message: Record<string, unknown>): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    slot.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    slot.worker.postMessage({ ...message, id });
  });
}

function ensurePool(): void {
  if (pool.length) return;
  // Le premier worker ouvre la base ; les suivants démarrent juste après, pour ne pas
  // réclamer en même temps l'en-tête et le schéma au réseau.
  const first = spawn();
  pool.push(first);
  manifestPromise = first.ready;
  first.ready
    .then(() => {
      for (let i = 1; i < POOL_SIZE; i++) pool.push(spawn());
    })
    .catch(() => {
      /* l'erreur est rendue par manifest() */
    });
}

/** Ouvre la base (idempotent) et renvoie son manifeste. */
export function manifest(): Promise<Manifest> {
  ensurePool();
  return manifestPromise!;
}

function pick(): Slot {
  let best = pool[0];
  for (const slot of pool) if (slot.busy < best.busy) best = slot;
  return best;
}

/** Prévenu quand la base a été remplacée par une version plus récente en cours de visite. */
const updateListeners = new Set<() => void>();
export function onDbUpdate(fn: () => void): () => void {
  updateListeners.add(fn);
  return () => updateListeners.delete(fn);
}

let generation = 0;

/** Ferme tous les workers : les prochains rouvriront la base d'après le manifeste du jour. */
function reopen(seen: number): void {
  if (seen !== generation) return; // un autre appel a déjà rouvert
  generation++;
  for (const slot of pool) {
    slot.worker.terminate();
    for (const p of slot.pending.values()) p.reject(new Error(STALE));
  }
  pool.length = 0;
  manifestPromise = null;
  if (lab) {
    lab.worker.terminate();
    lab = null;
  }
  updateListeners.forEach((fn) => fn());
}

/**
 * Le site est republié chaque nuit avec une nouvelle base ; une page restée ouverte
 * réclame alors des tranches qui n'existent plus. On rouvre la base et on rejoue la
 * requête une fois, sans que la page ne s'en aperçoive.
 */
export async function query<T = Row>(
  sql: string,
  params: Param[] = [],
  options: QueryOptions = {},
): Promise<QueryResult<T>> {
  const seen = generation;
  try {
    return await queryOnce<T>(sql, params, options);
  } catch (err) {
    if (!(err instanceof Error) || err.message !== STALE) throw err;
    reopen(seen);
    return queryOnce<T>(sql, params, options);
  }
}

async function queryOnce<T = Row>(
  sql: string,
  params: Param[] = [],
  options: QueryOptions = {},
): Promise<QueryResult<T>> {
  ensurePool();
  let slot: Slot;
  if (options.lane === "lab") {
    if (!lab) lab = spawn();
    slot = lab;
  } else {
    await manifestPromise;
    slot = pick();
  }
  await slot.ready;
  slot.busy++;
  try {
    const res = await send<QueryResponse>(slot, {
      type: "query",
      sql,
      params,
      maxRows: options.maxRows,
      timeoutMs: options.timeoutMs ?? 45_000,
    });
    sessionIo.requests += res.io.requests;
    sessionIo.bytes += res.io.bytes;
    sessionIo.queries++;
    listeners.forEach((fn) => fn());
    if (import.meta.env.DEV) {
      console.debug(
        `[sql] ${res.io.requests} req ${(res.io.bytes / 1024).toFixed(0)} KB ${res.ms.toFixed(0)} ms`,
        sql.replace(/\s+/g, " ").slice(0, 140),
      );
    }
    return res as unknown as QueryResult<T>;
  } finally {
    slot.busy--;
  }
}

export async function rows<T = Row>(sql: string, params: Param[] = []): Promise<T[]> {
  return (await query<T>(sql, params)).rows;
}

export async function one<T = Row>(sql: string, params: Param[] = []): Promise<T | null> {
  return (await query<T>(sql, params, { maxRows: 1 })).rows[0] ?? null;
}

/**
 * Exécute la même requête sur des sous-ensembles d'une liste, répartis entre les workers.
 * Sert aux fiches d'histoires d'une page de résultats : les codes sont triés pour que chaque
 * worker lise des lignes voisines, donc peu de tranches.
 */
export async function fanOut<T = Row>(
  build: (part: (string | number)[]) => { sql: string; params: Param[] },
  keys: (string | number)[],
): Promise<T[]> {
  if (!keys.length) return [];
  ensurePool();
  await manifestPromise;
  const sorted = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const parts = Math.min(pool.length || 1, Math.ceil(sorted.length / 6));
  const size = Math.ceil(sorted.length / parts);
  const chunks: (string | number)[][] = [];
  for (let i = 0; i < sorted.length; i += size) chunks.push(sorted.slice(i, i + size));
  const results = await Promise.all(
    chunks.map((part) => {
      const { sql, params } = build(part);
      return rows<T>(sql, params);
    }),
  );
  return results.flat();
}

/** Arrête l'éditeur SQL en cours (requête trop longue) et prépare un worker neuf. */
export function cancelLab(): void {
  if (!lab) return;
  lab.worker.terminate();
  for (const p of lab.pending.values()) p.reject(new Error("cancelled"));
  lab = null;
}

/** Placeholders « ?, ?, ? » pour une liste IN (…). */
export const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");
