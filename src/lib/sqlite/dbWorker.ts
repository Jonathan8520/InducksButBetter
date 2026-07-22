/**
 * dbWorker.ts — Le worker qui détient la base SQLite et exécute les requêtes.
 *
 * Deux modes, un seul moteur :
 *   - `remote` : base statique distante, lue par requêtes HTTP Range (cf. httpVfs.ts)
 *   - `local`  : base construite en mémoire depuis des fichiers ISV importés par
 *                l'utilisateur
 *
 * Faire tourner la base ici est une obligation, pas un confort : le VFS HTTP repose sur
 * XMLHttpRequest synchrone, interdit sur le thread principal.
 */

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { RangeReader } from "./rangeReader";
import { installHttpVfs, VFS_NAME } from "./httpVfs";

type Sqlite3 = any;

let sqlite3: Sqlite3 | null = null;
let db: any = null;
let reader: RangeReader | null = null;

export interface QueryResult {
  rows: Record<string, unknown>[];
  /** Coût réseau de CETTE requête — sert au panneau de diagnostic. */
  io?: { requests: number; bytesFetched: number; cacheHits: number };
}

async function ensureSqlite(): Promise<Sqlite3> {
  if (!sqlite3) {
    // Les types publiés déclarent une signature sans argument, alors que le module accepte
    // bien une configuration Emscripten à l'exécution (print / printErr).
    const init = sqlite3InitModule as unknown as (opts?: Record<string, unknown>) => Promise<Sqlite3>;
    sqlite3 = await init({
      print: () => {},
      printErr: (msg: string) => console.error("[sqlite]", msg),
    });
  }
  return sqlite3;
}

async function openRemote(baseUrl: string): Promise<{ pages: number; bytes: number }> {
  const s = await ensureSqlite();
  reader = await RangeReader.load(baseUrl);
  installHttpVfs(s, reader);

  db?.close?.();
  db = new s.oo1.DB({
    filename: "/inducks.sqlite",
    flags: "r",
    vfs: VFS_NAME,
  });

  // La base est immuable et distante : tout ce qui provoque des allers-retours inutiles
  // est désactivé, et le cache de pages est généreux puisqu'une page relue est une
  // requête HTTP économisée.
  db.exec("PRAGMA cache_size = -32000");   // 32 Mio
  db.exec("PRAGMA temp_store = MEMORY");

  return { pages: reader.manifest.totalBytes / reader.manifest.pageSize, bytes: reader.manifest.totalBytes };
}

function execute(sql: string, args: unknown[] = []): QueryResult {
  if (!db) throw new Error("Base non ouverte");
  reader?.resetStats();

  const rows: Record<string, unknown>[] = [];
  db.exec({
    sql,
    bind: args.length ? args : undefined,
    rowMode: "object",
    callback: (row: Record<string, unknown>) => {
      rows.push(row);
    },
  });

  return { rows, io: reader ? { ...reader.stats } : undefined };
}

/**
 * Variante en flux : chaque ligne est postée dès qu'elle est produite, ce qui permet à
 * l'interface d'afficher les premiers résultats sans attendre la fin du parcours.
 */
function executeStreaming(id: number, sql: string, args: unknown[] = []): QueryResult {
  if (!db) throw new Error("Base non ouverte");
  reader?.resetStats();

  let count = 0;
  db.exec({
    sql,
    bind: args.length ? args : undefined,
    rowMode: "object",
    callback: (row: Record<string, unknown>) => {
      count++;
      self.postMessage({ id, type: "row", row });
    },
  });

  return { rows: [], io: reader ? { ...reader.stats } : undefined, ...{ count } } as QueryResult;
}

self.onmessage = async (event: MessageEvent) => {
  const { id, action, payload } = event.data ?? {};
  try {
    switch (action) {
      case "openRemote": {
        const info = await openRemote(payload.baseUrl);
        self.postMessage({ id, type: "success", info });
        break;
      }
      case "execute": {
        const result = payload.stream
          ? executeStreaming(id, payload.sql, payload.args)
          : execute(payload.sql, payload.args);
        self.postMessage({ id, type: "success", ...result });
        break;
      }
      case "stats": {
        self.postMessage({ id, type: "success", io: reader?.stats ?? null });
        break;
      }
      case "close": {
        db?.close?.();
        db = null;
        reader = null;
        self.postMessage({ id, type: "success" });
        break;
      }
      default:
        self.postMessage({ id, type: "error", error: `Action inconnue : ${action}` });
    }
  } catch (err) {
    self.postMessage({
      id,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
