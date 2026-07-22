/**
 * httpVfs.ts — VFS SQLite en lecture seule, alimenté par requêtes HTTP Range.
 *
 * Branche un {@link RangeReader} sur la couche VFS de `@sqlite.org/sqlite-wasm`, ce qui
 * permet d'ouvrir une base d'un gigaoctet publiée en statique sans jamais la télécharger :
 * SQLite ne réclame que les pages nécessaires à la requête en cours.
 *
 * À N'INSTANCIER QUE DANS UN WEB WORKER : les lectures sont synchrones (contrainte de
 * l'interface xRead de SQLite) et reposent sur XMLHttpRequest synchrone, interdit sur le
 * thread principal.
 *
 * L'écriture n'est pas implémentée — la base est immuable, reconstruite chaque nuit par la
 * CI. Toute tentative d'écriture renvoie SQLITE_READONLY plutôt que d'échouer sourdement.
 */

import { RangeReader } from "./rangeReader";

/** Le module sqlite3 tel qu'exposé par @sqlite.org/sqlite-wasm (typé au plus juste). */
type Sqlite3 = any;

export const VFS_NAME = "inducks-http";

interface OpenFile {
  reader: RangeReader;
  lockLevel: number;
}

/**
 * Installe le VFS. Idempotent : un second appel remplace simplement le lecteur associé,
 * ce qui permet de recharger une base sans réinstaller les structures WASM.
 */
export function installHttpVfs(sqlite3: Sqlite3, reader: RangeReader): void {
  const capi = sqlite3.capi;
  const wasm = sqlite3.wasm;

  if (installed) {
    currentReader = reader;
    return;
  }
  currentReader = reader;

  const openFiles = new Map<number, OpenFile>();

  const ioStruct = new capi.sqlite3_io_methods();
  const vfsStruct = new capi.sqlite3_vfs();

  const ioMethods = {
    xClose: (pFile: number) => {
      openFiles.delete(pFile);
      return 0;
    },

    xRead: (pFile: number, pDest: number, n: number, offset: bigint | number) => {
      const file = openFiles.get(pFile);
      if (!file) return capi.SQLITE_IOERR_READ;
      try {
        const bytes = file.reader.read(Number(offset), n);
        const heap = wasm.heap8u();
        if (bytes.length < n) {
          // SQLite exige que la fin du tampon soit mise à zéro sur une lecture courte,
          // et attend ce code de retour précis (typiquement en fin de fichier).
          heap.fill(0, pDest, pDest + n);
          heap.set(bytes, pDest);
          return capi.SQLITE_IOERR_SHORT_READ;
        }
        heap.set(bytes, pDest);
        return 0;
      } catch (err) {
        console.error("[httpVfs] xRead", err);
        return capi.SQLITE_IOERR_READ;
      }
    },

    // --- Base immuable : toute mutation est refusée explicitement ---------------------
    xWrite: () => capi.SQLITE_READONLY,
    xTruncate: () => capi.SQLITE_READONLY,
    xSync: () => 0,

    xFileSize: (pFile: number, pSize64: number) => {
      const file = openFiles.get(pFile);
      if (!file) return capi.SQLITE_IOERR_FSTAT;
      wasm.poke64(pSize64, BigInt(file.reader.size));
      return 0;
    },

    // Aucun accès concurrent possible sur un fichier distant en lecture seule : les
    // verrous sont acceptés sans effet.
    xLock: (pFile: number, level: number) => {
      const file = openFiles.get(pFile);
      if (file) file.lockLevel = level;
      return 0;
    },
    xUnlock: (pFile: number, level: number) => {
      const file = openFiles.get(pFile);
      if (file) file.lockLevel = level;
      return 0;
    },
    xCheckReservedLock: (_pFile: number, pOut: number) => {
      wasm.poke32(pOut, 0);
      return 0;
    },

    xFileControl: () => capi.SQLITE_NOTFOUND,
    xSectorSize: () => 4096,
    /**
     * IMMUTABLE le dit à SQLite : le fichier ne changera pas sous ses pieds, il peut donc
     * se dispenser de relire l'en-tête et de vérifier le compteur de modifications.
     * Économise plusieurs allers-retours réseau par requête.
     */
    xDeviceCharacteristics: () =>
      capi.SQLITE_IOCAP_IMMUTABLE | capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN,
  };

  const vfsMethods = {
    xOpen: (_pVfs: number, _zName: number, pFile: number, flags: number, pOutFlags: number) => {
      if (!currentReader) return capi.SQLITE_CANTOPEN;
      // On ne sert que la base principale : ni journal, ni fichier temporaire — la base
      // étant en lecture seule, SQLite ne devrait jamais en demander.
      if (flags & capi.SQLITE_OPEN_MAIN_JOURNAL || flags & capi.SQLITE_OPEN_WAL) {
        return capi.SQLITE_CANTOPEN;
      }
      openFiles.set(pFile, { reader: currentReader, lockLevel: 0 });
      ioStruct.pointer && wasm.poke32(pFile, ioStruct.pointer);
      if (pOutFlags) {
        wasm.poke32(pOutFlags, capi.SQLITE_OPEN_READONLY);
      }
      return 0;
    },

    xDelete: () => capi.SQLITE_READONLY,

    xAccess: (_pVfs: number, _zName: number, _flags: number, pOut: number) => {
      // La base « existe » toujours ; aucun journal n'existe jamais. Répondre 0 partout
      // sauf pour le fichier principal évite que SQLite cherche des rollback journals.
      wasm.poke32(pOut, 0);
      return 0;
    },

    xFullPathname: (_pVfs: number, zName: number, nOut: number, pOut: number) => {
      const name = wasm.cstrToJs(zName) || "";
      const bytes = new TextEncoder().encode(name.slice(0, Math.max(0, nOut - 1)));
      const heap = wasm.heap8u();
      heap.set(bytes, pOut);
      heap[pOut + bytes.length] = 0;
      return 0;
    },

    xRandomness: (_pVfs: number, n: number, pOut: number) => {
      const heap = wasm.heap8u();
      for (let i = 0; i < n; i++) {
        heap[pOut + i] = (Math.random() * 255) | 0;
      }
      return n;
    },
    xSleep: () => 0,
    xCurrentTimeInt64: (_pVfs: number, pOut: number) => {
      wasm.poke64(pOut, BigInt(Date.now()) + 210866760000000n);
      return 0;
    },
    xCurrentTime: (_pVfs: number, pOut: number) => {
      wasm.poke(pOut, Date.now() / 86400000 + 2440587.5, "double");
      return 0;
    },
  };

  // Les champs de la structure doivent être renseignés AVANT l'enregistrement : SQLite lit
  // $zName au moment de sqlite3_vfs_register, et un VFS enregistré sans nom serait
  // introuvable depuis `new DB({vfs: ...})`.
  vfsStruct.$iVersion = 2;                 // 2 = xCurrentTimeInt64 fourni
  vfsStruct.$szOsFile = capi.sqlite3_file.structInfo.sizeof;
  vfsStruct.$mxPathname = 1024;
  vfsStruct.$zName = wasm.allocCString(VFS_NAME);

  sqlite3.vfs.installVfs({
    io: { struct: ioStruct, methods: ioMethods },
    vfs: { struct: vfsStruct, methods: vfsMethods, asDefault: false },
  });

  installed = true;
}

let installed = false;
let currentReader: RangeReader | null = null;

export function getReader(): RangeReader | null {
  return currentReader;
}
