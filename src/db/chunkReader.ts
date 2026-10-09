/**
 * chunkReader.ts — Lit des octets dans une base SQLite publiée en tranches statiques.
 *
 * La base (environ 1 Go) n'est jamais téléchargée : elle est publiée en tranches de taille
 * fixe, compressées une à une, et SQLite ne réclame que les pages utiles à la requête.
 *
 * Choix structurants, tous mesurés :
 *  - une tranche entière par requête HTTP, sans en-tête Range. Cloudflare Pages ignore
 *    Range et renvoie de toute façon le fichier complet ; autant le garder en entier en
 *    cache plutôt que d'en jeter 98 %. Sans Range, la requête est « simple » au sens CORS
 *    (pas de pré-vol) et le cache HTTP du navigateur la sert aux autres workers.
 *  - chaque tranche est compressée (deflate brut) : les pages SQLite de texte se
 *    compressent d'un facteur 3 environ, ce qui compte sur une connexion mobile.
 *  - les lectures sont SYNCHRONES (contrainte du VFS SQLite), d'où XMLHttpRequest
 *    synchrone, autorisé dans un Web Worker uniquement.
 */

import { inflateSync } from "fflate";

export interface Manifest {
  format: "sqlite-chunked-v2";
  /** Empreinte de la base : dossier des tranches, change à chaque reconstruction. */
  version: string;
  /** Dossier des tranches, relatif au manifeste. */
  path: string;
  totalBytes: number;
  chunkBytes: number;
  chunkCount: number;
  pageSize: number;
  compression: "deflate-raw" | "none";
  built?: string;
  dump?: string;
}

export interface IoStats {
  /** Requêtes HTTP réellement émises (hors cache mémoire). */
  requests: number;
  /** Octets reçus (compressés). */
  bytes: number;
  /** Lectures servies par le cache mémoire du worker. */
  hits: number;
}

/** Message d'erreur convenu : la base a changé de version pendant la visite. */
export const STALE = "DB_STALE";

/** Plafond mémoire par défaut du cache de tranches décompressées, par worker. */
const CACHE_BUDGET = 48 * 1024 * 1024;

export class ChunkReader {
  readonly manifest: Manifest;
  private base: string;
  private cache = new Map<number, Uint8Array>();
  private cachedBytes = 0;
  /** Réduit sur les appareils modestes (cf. client.ts) : le cache HTTP garde les tranches. */
  budget = CACHE_BUDGET;
  stats: IoStats = { requests: 0, bytes: 0, hits: 0 };
  /**
   * Vrai quand une tranche a disparu : le site a été republié avec une nouvelle base et
   * l'ancienne version n'est plus servie. La page doit relire le manifeste.
   */
  stale = false;

  constructor(manifestUrl: string, manifest: Manifest) {
    const dir = manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1);
    this.base = new URL(manifest.path.replace(/\/?$/, "/"), new URL(dir, self.location.href)).href;
    this.manifest = manifest;
  }

  get size(): number {
    return this.manifest.totalBytes;
  }

  static async load(manifestUrl: string): Promise<ChunkReader> {
    // Le manifeste est la seule ressource à revalider : les tranches vivent dans un dossier
    // propre à chaque version et sont immuables.
    const res = await fetch(manifestUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    const manifest = (await res.json()) as Manifest;
    if (manifest.format !== "sqlite-chunked-v2") {
      throw new Error(`unknown manifest format ${manifest.format}`);
    }
    return new ChunkReader(manifestUrl, manifest);
  }

  read(offset: number, length: number): Uint8Array {
    const { chunkBytes, totalBytes } = this.manifest;
    const end = Math.min(offset + length, totalBytes);
    const out = new Uint8Array(length);
    let pos = offset;
    while (pos < end) {
      const index = Math.floor(pos / chunkBytes);
      const chunk = this.chunk(index);
      const inChunk = pos - index * chunkBytes;
      const take = Math.min(end - pos, chunk.length - inChunk);
      if (take <= 0) break;
      out.set(chunk.subarray(inChunk, inChunk + take), pos - offset);
      pos += take;
    }
    return pos - offset === length ? out : out.subarray(0, pos - offset);
  }

  private chunk(index: number): Uint8Array {
    const hit = this.cache.get(index);
    if (hit) {
      this.stats.hits++;
      // Map conserve l'ordre d'insertion : remettre en tête donne un LRU.
      this.cache.delete(index);
      this.cache.set(index, hit);
      return hit;
    }
    const data = this.fetchChunk(index);
    this.cache.set(index, data);
    this.cachedBytes += data.length;
    while (this.cachedBytes > this.budget && this.cache.size > 1) {
      const [oldest, bytes] = this.cache.entries().next().value as [number, Uint8Array];
      this.cache.delete(oldest);
      this.cachedBytes -= bytes.length;
    }
    return data;
  }

  private fetchChunk(index: number): Uint8Array {
    const name = String(index).padStart(5, "0") + ".bin";
    let lastError: unknown;
    // Une tranche manquée est une requête SQL en échec : on réessaie avant d'abandonner.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", this.base + name, false);
        xhr.responseType = "arraybuffer";
        xhr.send();
        // Une tranche absente revient en 404, ou en page HTML (repli « application monopage »
        // de l'hébergeur) : dans les deux cas cette version de la base n'existe plus.
        const type = xhr.getResponseHeader("content-type") ?? "";
        if (xhr.status === 404 || (xhr.status === 200 && type.includes("text/html"))) {
          this.stale = true;
          throw new Error(STALE);
        }
        if (xhr.status !== 200) throw new Error(`HTTP ${xhr.status} ${name}`);
        const raw = new Uint8Array(xhr.response as ArrayBuffer);
        this.stats.requests++;
        this.stats.bytes += raw.length;
        return this.manifest.compression === "deflate-raw" ? inflateSync(raw) : raw;
      } catch (err) {
        lastError = err;
        if (this.stale) break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  takeStats(): IoStats {
    const s = this.stats;
    this.stats = { requests: 0, bytes: 0, hits: 0 };
    return s;
  }
}
