/**
 * rangeReader.ts — Lit des plages d'octets dans une base SQLite découpée en tranches.
 *
 * La base (~1 Go) est publiée en tranches de 20 Mio, sous la limite de 25 Mio de
 * Cloudflare Pages. Ce module traduit « lire les octets [offset, offset+length) » en
 * requêtes HTTP Range sur les bonnes tranches, et met les pages en cache.
 *
 * Contrainte structurante : le xRead d'un VFS SQLite est SYNCHRONE, alors que fetch() est
 * asynchrone. On s'appuie donc sur XMLHttpRequest en mode synchrone, autorisé à l'intérieur
 * d'un Web Worker (et uniquement là — d'où l'obligation de faire tourner la base dans un
 * worker). C'est la même approche que sql.js-httpvfs, et elle évite d'exiger les en-têtes
 * COOP/COEP qu'imposerait la variante SharedArrayBuffer + Atomics.wait.
 */

export interface ChunkInfo {
  name: string;
  bytes: number;
  sha256: string;
}

export interface DbManifest {
  format: "sqlite-chunked-v1";
  totalBytes: number;
  chunkBytes: number;
  chunkCount: number;
  pageSize: number;
  sha256: string;
  chunks: ChunkInfo[];
}

export interface ReaderStats {
  /** Requêtes HTTP réellement émises. */
  requests: number;
  /** Octets réellement transférés. */
  bytesFetched: number;
  /** Lectures servies depuis le cache mémoire. */
  cacheHits: number;
}

/** Taille de bloc du cache. Un multiple de la page SQLite (4096) limite le gaspillage. */
const BLOCK_SIZE = 16 * 1024;

/**
 * Nombre maximal de blocs gardés en mémoire (16 Ko x 4096 = 64 Mio).
 * Au-delà, on évince les plus anciens : sans cela, une requête balayant une grosse table
 * ferait enfler la mémoire du worker sans limite.
 */
const MAX_BLOCKS = 4096;

export class RangeReader {
  readonly manifest: DbManifest;
  private baseUrl: string;
  private blocks = new Map<number, Uint8Array>();
  stats: ReaderStats = { requests: 0, bytesFetched: 0, cacheHits: 0 };

  constructor(baseUrl: string, manifest: DbManifest) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    this.manifest = manifest;
  }

  get size(): number {
    return this.manifest.totalBytes;
  }

  /**
   * Charge le manifeste. Seule opération asynchrone : tout le reste est synchrone,
   * puisqu'appelé depuis le xRead de SQLite.
   */
  static async load(baseUrl: string): Promise<RangeReader> {
    const url = (baseUrl.endsWith("/") ? baseUrl : baseUrl + "/") + "manifest.json";
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Manifeste introuvable (${res.status}) : ${url}`);
    }
    const manifest = (await res.json()) as DbManifest;
    if (manifest.format !== "sqlite-chunked-v1") {
      throw new Error(`Format de manifeste inconnu : ${manifest.format}`);
    }
    return new RangeReader(baseUrl, manifest);
  }

  /**
   * Lit `length` octets à partir de `offset`. Synchrone par nécessité (cf. en-tête).
   * Une lecture chevauchant deux tranches est découpée en autant de requêtes.
   */
  read(offset: number, length: number): Uint8Array {
    const out = new Uint8Array(length);
    let written = 0;

    while (written < length) {
      const pos = offset + written;
      const blockIndex = Math.floor(pos / BLOCK_SIZE);
      const block = this.getBlock(blockIndex);
      const inBlock = pos - blockIndex * BLOCK_SIZE;
      const take = Math.min(length - written, block.length - inBlock);
      if (take <= 0) break; // au-delà de la fin du fichier
      out.set(block.subarray(inBlock, inBlock + take), written);
      written += take;
    }

    return written === length ? out : out.subarray(0, written);
  }

  private getBlock(index: number): Uint8Array {
    const cached = this.blocks.get(index);
    if (cached) {
      this.stats.cacheHits++;
      // Remise en tête : Map conserve l'ordre d'insertion, ce qui donne un LRU gratuit.
      this.blocks.delete(index);
      this.blocks.set(index, cached);
      return cached;
    }

    const start = index * BLOCK_SIZE;
    const end = Math.min(start + BLOCK_SIZE, this.manifest.totalBytes) - 1;
    if (start > end) return new Uint8Array(0);

    const block = this.fetchRange(start, end);
    this.blocks.set(index, block);
    if (this.blocks.size > MAX_BLOCKS) {
      const oldest = this.blocks.keys().next().value;
      if (oldest !== undefined) this.blocks.delete(oldest);
    }
    return block;
  }

  /**
   * Récupère [start, end] inclus, en assemblant les morceaux si la plage franchit une
   * frontière de tranche.
   */
  private fetchRange(start: number, end: number): Uint8Array {
    const { chunkBytes } = this.manifest;
    const out = new Uint8Array(end - start + 1);
    let written = 0;
    let pos = start;

    while (pos <= end) {
      const chunkIndex = Math.floor(pos / chunkBytes);
      const chunk = this.manifest.chunks[chunkIndex];
      if (!chunk) {
        throw new Error(`Tranche ${chunkIndex} absente du manifeste (offset ${pos})`);
      }
      const chunkStart = chunkIndex * chunkBytes;
      const from = pos - chunkStart;
      const to = Math.min(end - chunkStart, chunk.bytes - 1);

      const part = this.httpRange(chunk.name, from, to);
      out.set(part, written);
      written += part.length;
      pos = chunkStart + to + 1;

      // Garde-fou : un serveur ignorant l'en-tête Range renverrait tout le fichier et
      // ferait boucler indéfiniment.
      if (part.length === 0) {
        throw new Error(`Lecture vide sur ${chunk.name} [${from}-${to}]`);
      }
    }

    return written === out.length ? out : out.subarray(0, written);
  }

  private httpRange(chunkName: string, from: number, to: number): Uint8Array {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", this.baseUrl + chunkName, /* async */ false);
    xhr.responseType = "arraybuffer";
    xhr.setRequestHeader("Range", `bytes=${from}-${to}`);
    xhr.send();

    if (xhr.status !== 206 && xhr.status !== 200) {
      throw new Error(`HTTP ${xhr.status} sur ${chunkName} [${from}-${to}]`);
    }

    let buf = new Uint8Array(xhr.response as ArrayBuffer);
    // Un serveur sans support des requêtes Range répond 200 avec le fichier entier :
    // on retaille nous-mêmes plutôt que de corrompre la lecture.
    if (xhr.status === 200 && buf.length > to - from + 1) {
      buf = buf.subarray(from, to + 1);
    }

    this.stats.requests++;
    this.stats.bytesFetched += buf.length;
    return buf;
  }

  resetStats(): void {
    this.stats = { requests: 0, bytesFetched: 0, cacheHits: 0 };
  }
}
