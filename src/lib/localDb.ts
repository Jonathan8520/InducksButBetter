import DbWorker from './dbWorker?worker';

let worker: Worker | null = null;
let queryIdCounter = 0;
const pendingQueries = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void, onRow?: (row: any) => void }>();
let onProgressCallback: ((progress: any) => void) | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new DbWorker();
    worker.onmessage = (e) => {
      const { id, type, error, row, rows, count, table, current, total } = e.data;
      
      if (type === 'progress' && onProgressCallback) {
        onProgressCallback({ table, current, total });
        return;
      }
      
      const pending = pendingQueries.get(id);
      if (pending) {
        if (type === 'row' && pending.onRow) {
          pending.onRow(row);
          return;
        }
        
        if (type === 'error') {
          pending.reject(new Error(error));
        } else if (type === 'success') {
          pending.resolve(rows ? { rows } : { rows: [], count });
        }
        pendingQueries.delete(id);
      }
    };
  }
  return worker;
}

export async function loadLocalDb(file: File): Promise<void> {
  throw new Error("loadLocalDb for direct sqlite file is not implemented in worker yet.");
}

let localDbStats: { count: number, size: number } | null = null;

export function hasLocalDb(): boolean {
  return worker !== null && localDbStats !== null;
}

export function getLocalDbStats() {
  return localDbStats;
}

export async function loadFromIsvFiles(files: File[], onProgress?: (progress: {table: string, current: number, total: number}) => void): Promise<void> {
  const w = getWorker();
  onProgressCallback = onProgress || null;
  
  localDbStats = {
    count: files.length,
    size: files.reduce((acc, f) => acc + f.size, 0)
  };
  
  return new Promise((resolve, reject) => {
    const id = ++queryIdCounter;
    pendingQueries.set(id, { resolve, reject });
    w.postMessage({
      id,
      action: "loadIsv",
      payload: { files, baseUrl: import.meta.env.BASE_URL }
    });
  });
}

export function unloadLocalDb() {
  if (worker) {
    worker.postMessage({ id: ++queryIdCounter, action: "unload", payload: {} });
    // We don't wait for response, we just terminate it
    worker.terminate();
    worker = null;
    localDbStats = null;
  }
}

export async function executeLocal(query: { sql: string, args?: any[] } | string, onRow?: (row: any) => void) {
  if (!worker) throw new Error("Local database is not loaded.");
  
  const sqlString = typeof query === "string" ? query : query.sql;
  const args = typeof query === "string" ? [] : (query.args || []);
  
  return new Promise<any>((resolve, reject) => {
    const id = ++queryIdCounter;
    pendingQueries.set(id, { resolve, reject, onRow });
    
    worker!.postMessage({
      id,
      action: "execute",
      payload: { sql: sqlString, args, stream: !!onRow }
    });
  });
}
