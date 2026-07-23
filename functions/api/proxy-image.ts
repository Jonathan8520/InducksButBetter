/**
 * functions/api/proxy-image.ts — Proxy d'images pour la PRODUCTION (Cloudflare Pages Function).
 *
 * Répond à `GET /api/proxy-image?url=<url encodée>` : récupère l'image côté serveur (ce qui
 * pose un référent interne pour contourner l'anti-hotlink) et la renvoie même origine, avec
 * CORS ouvert et un cache long. Le front pointe déjà ses `<img>` ici ; il ne manquait que
 * l'endpoint. Aucun changement front n'est nécessaire : le jour où inducks.org répond de
 * nouveau, les images s'affichent.
 *
 * Le pendant DÉVELOPPEMENT est le middleware de vite.config.ts ; les deux partagent la
 * validation de src/lib/imageProxy.ts. Ce fichier n'est PAS compilé par le `tsc` du build
 * (hors de `include: ["src"]`) — c'est wrangler qui le bundle au déploiement. `context` est
 * donc typé librement pour ne pas dépendre de @cloudflare/workers-types.
 *
 * `fetch`, `Response`, `Request` et `caches` sont des globales du runtime Workers.
 */
import {
  IMAGE_CACHE_SECONDS,
  isImageResponse,
  resolveImageTarget,
  upstreamHeaders,
} from "../../src/lib/imageProxy";

declare const caches: { default: { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> } };

export async function onRequestGet(context: {
  request: Request;
  waitUntil: (p: Promise<unknown>) => void;
}): Promise<Response> {
  const { request, waitUntil } = context;
  const url = new URL(request.url);
  const cors = { "access-control-allow-origin": "*" };

  const resolved = resolveImageTarget(url.searchParams.get("url"));
  if (!resolved.ok) {
    return new Response(resolved.message, { status: resolved.status, headers: cors });
  }

  // Cache d'arête : une même image n'est récupérée en amont qu'une fois par POP Cloudflare.
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let upstream: Response;
  try {
    upstream = await fetch(resolved.target, {
      headers: upstreamHeaders(resolved.referer),
      // @ts-expect-error `cf` est une extension spécifique au runtime Workers.
      cf: { cacheEverything: true, cacheTtl: IMAGE_CACHE_SECONDS },
    });
  } catch {
    return new Response("échec de récupération amont", { status: 502, headers: cors });
  }

  const contentType = upstream.headers.get("content-type");
  if (!isImageResponse(upstream.ok, contentType)) {
    // inducks.org en panne renvoie une page HTML en 503 : on répond 502 pour que le `onError`
    // de la balise <img> bascule proprement sur le placeholder, au lieu d'afficher du HTML.
    return new Response("la réponse amont n'est pas une image", { status: 502, headers: cors });
  }

  const headers = new Headers(cors);
  headers.set("content-type", contentType as string);
  headers.set("cache-control", `public, max-age=${IMAGE_CACHE_SECONDS}, immutable`);

  const response = new Response(upstream.body, { status: 200, headers });
  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
