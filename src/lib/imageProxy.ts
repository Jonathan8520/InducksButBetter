/**
 * imageProxy.ts — Cœur PARTAGÉ du proxy d'images, isomorphe (aucune API navigateur ni Node).
 *
 * Le front affiche les scans Inducks via `<img src="/api/proxy-image?url=...">`. Cet endpoint
 * n'existait pas dans ce dépôt : c'était une fonction serveur de l'hébergement d'origine
 * (Vercel), jamais reprise. Résultat, même les vignettes servies directement par inducks.org
 * (photos d'auteurs, `characterthumb.php`) ne pouvaient pas se charger.
 *
 * Il est réimplémenté à DEUX endroits qui partagent tous deux cette validation :
 *   - functions/api/proxy-image.ts — fonction Cloudflare Pages (production) ;
 *   - vite.config.ts               — middleware du serveur de dev (`pnpm dev`).
 *
 * Ne PAS transformer ce proxy en relais ouvert : sans liste blanche d'hôtes, il servirait à
 * récupérer n'importe quelle URL (SSRF, abus de bande passante, blanchiment de contenu). La
 * validation ci-dessous est donc la partie sensible, d'où le test dédié.
 */

/**
 * Hôtes autorisés : uniquement les serveurs d'images d'Inducks. Tous les points d'appel du
 * front visent l'un d'eux — `inducks.org` (hr.php, characterthumb.php, creators/photos) et
 * `outducks.org` (scans en direct). `outducks.org` est aujourd'hui perdu (domaine reparké),
 * mais on le garde dans la liste : une requête vers lui échouera proprement en amont plutôt
 * que d'être refusée ici, et le jour où un CDN équivalent renaît, rien à changer.
 */
export const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  "inducks.org",
  "www.inducks.org",
  "coa.inducks.org",
  "outducks.org",
  "www.outducks.org",
]);

/** Durée de cache CDN d'une image résolue : une image Inducks est immuable. */
export const IMAGE_CACHE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

export type ResolveResult =
  | { ok: true; target: string; referer: string }
  | { ok: false; status: number; message: string };

/**
 * Valide le paramètre `url` reçu et renvoie la cible à récupérer, ou un refus explicite.
 * Refuse tout ce qui n'est pas http(s) vers un hôte de la liste blanche.
 */
export function resolveImageTarget(raw: string | null | undefined): ResolveResult {
  if (!raw) return { ok: false, status: 400, message: "paramètre 'url' manquant" };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, status: 400, message: "'url' invalide" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, status: 400, message: "protocole non autorisé" };
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { ok: false, status: 403, message: `hôte non autorisé : ${parsed.hostname}` };
  }

  // Referer d'un hôte Inducks : contourne la protection anti-hotlink des serveurs d'images,
  // qui refusent les requêtes dont le référent n'est pas interne.
  return { ok: true, target: parsed.toString(), referer: "https://inducks.org/" };
}

/** En-têtes envoyés au serveur d'images amont (référent interne + UA de navigateur). */
export function upstreamHeaders(referer: string): Record<string, string> {
  return {
    "user-agent":
      "Mozilla/5.0 (compatible; InducksButBetter/1.0; +https://github.com/Jonathan8520/InducksButBetter)",
    referer,
    accept: "image/avif,image/webp,image/*,*/*;q=0.8",
  };
}

/**
 * Vrai si la réponse amont est bien une image exploitable. Sert à distinguer une vraie image
 * d'une page d'erreur : inducks.org en panne renvoie du HTML avec un code 503, qu'il ne faut
 * surtout pas relayer comme si c'était une image (la balise `<img>` afficherait un cassé).
 */
export function isImageResponse(ok: boolean, contentType: string | null): boolean {
  return ok && !!contentType && contentType.toLowerCase().startsWith("image/");
}
