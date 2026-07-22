/**
 * client.ts — Interface côté page vers le worker SQLite.
 *
 * Expose la même forme de résultat que l'ancien client Turso (`{ rows }`), pour que le
 * basculement du moteur ne se voie pas depuis les composants : c'est tout l'intérêt de
 * l'indirection déjà présente dans `src/lib/db.ts`.
 */

import DbWorker from "./dbWorker?worker";

export interface IoStats {
  requests: number;
  bytesFetched: number;
  cacheHits: number;
}

export interface ExecResult {
  rows: Record<string, unknown>[];
  io?: IoStats;
}

type Pending = {
  resolve: (value: ExecResult) => void;
  reject: (reason: Error) => void;
  onRow?: (row: Record<string, unknown>) => void;
};

let worker: Worker | null = null;
let counter = 0;
let openPromise: Promise<void> | null = null;
const pending = new Map<number, Pending>();
const pendingSql = new Map<number, string>();

/** Cumul du trafic depuis le chargement de la page — alimente le panneau de diagnostic. */
export const sessionIo: IoStats = { requests: 0, bytesFetched: 0, cacheHits: 0 };

function getWorker(): Worker {
  if (worker) return worker;
  worker = new DbWorker();
  worker.onmessage = (event: MessageEvent) => {
    const { id, type, error, row, rows, io } = event.data ?? {};
    const entry = pending.get(id);
    if (!entry) return;

    if (type === "row") {
      entry.onRow?.(row);
      return;
    }
    if (type === "error") {
      pending.delete(id);
      entry.reject(new Error(error));
      return;
    }
    if (io && import.meta.env.DEV) {
      const sql = pendingSql.get(id);
      pendingSql.delete(id);
      if (sql) console.info(`[sql] ${String(io.requests).padStart(4)} req  ${sql}`);
    }
    if (io) {
      sessionIo.requests += io.requests;
      sessionIo.bytesFetched += io.bytesFetched;
      sessionIo.cacheHits += io.cacheHits;
    }
    pending.delete(id);
    entry.resolve({ rows: rows ?? [], io });
  };
  return worker;
}

function post(action: string, payload: unknown, onRow?: Pending["onRow"]): Promise<ExecResult> {
  const w = getWorker();
  const id = ++counter;
  if (import.meta.env.DEV && action === "execute") {
    // Journal de diagnostic (développement uniquement) : sans lui, impossible de savoir
    // QUELLE requête consomme les allers-retours. Les totaux de session ne le disent pas.
    pendingSql.set(id, String((payload as any)?.sql ?? "").replace(/\s+/g, " ").slice(0, 110));
  }
  return new Promise<ExecResult>((resolve, reject) => {
    pending.set(id, { resolve, reject, onRow });
    w.postMessage({ id, action, payload });
  });
}

/**
 * Ouvre la base distante. Les appels concurrents partagent la même promesse : plusieurs
 * composants montés en parallèle ne doivent pas ouvrir la base plusieurs fois.
 */
export function openRemoteDb(baseUrl: string): Promise<void> {
  if (!openPromise) {
    openPromise = post("openRemote", { baseUrl })
      .then(() => undefined)
      .catch((err) => {
        openPromise = null; // un échec ne doit pas figer les tentatives suivantes
        throw err;
      });
  }
  return openPromise;
}

export function isOpen(): boolean {
  return openPromise !== null;
}

export function executeRemote(
  query: { sql: string; args?: unknown[] } | string,
  onRow?: (row: Record<string, unknown>) => void,
): Promise<ExecResult> {
  const sql = typeof query === "string" ? query : query.sql;
  const args = typeof query === "string" ? [] : query.args ?? [];
  return post("execute", { sql, args, stream: Boolean(onRow) }, onRow);
}

export function closeDb(): void {
  if (!worker) return;
  worker.terminate();
  worker = null;
  openPromise = null;
  pending.clear();
}
