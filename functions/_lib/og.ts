/**
 * Aperçus de liens (Open Graph) pour les fiches partagées.
 *
 * Les robots qui fabriquent un aperçu (messageries, réseaux sociaux) ne lancent pas le
 * JavaScript de la page. Pour les adresses de fiches, une fonction Cloudflare renvoie donc le
 * même index.html, mais avec titre, description et image de la fiche, lus dans les petits
 * fichiers produits par scripts/og_index.py. Le visiteur, lui, ne voit aucune différence.
 */

interface Env {
  ASSETS: { fetch: (input: Request | URL | string) => Promise<Response> };
}

export interface Ctx {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}

export interface Meta {
  title: string;
  description: string;
  image?: string | null;
}

/** Doit rester identique à SHARDS dans scripts/og_index.py. */
const SHARDS: Record<string, number> = { s: 2048, p: 32, a: 64, h: 64 };

/** FNV-1a 32 bits sur l'UTF-8 du code, comme scripts/og_index.py. */
export function shard(key: string, n: number): number {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(key)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % n;
}

export async function lookup(ctx: Ctx, kind: keyof typeof SHARDS, key: string): Promise<string[] | null> {
  try {
    const url = new URL(`/og/${kind}/${shard(key, SHARDS[kind])}.json`, ctx.request.url);
    const res = await ctx.env.ASSETS.fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, string[]>;
    return data[key] ?? null;
  } catch {
    return null;
  }
}

/** Segments d'adresse : « W+OS++386-02 » -> « W OS  386-02 » (cf. src/lib/routes.ts). */
export function segments(ctx: Ctx): string[] {
  const raw = ctx.params.path ?? ctx.params.code ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((s) => {
    try {
      return decodeURIComponent(s.replace(/\+/g, "%20"));
    } catch {
      return s;
    }
  });
}

/** Image intermédiaire d'Inducks, comme mediumUrl dans src/lib/inducks.ts. */
export function imageUrl(img: string | undefined): string | null {
  if (!img) return null;
  const i = img.indexOf("|");
  const site = i === -1 ? "webusers" : img.slice(0, i);
  const path = i === -1 ? img : img.slice(i + 1);
  const source = site === "webusers" ? `https://outducks.org/webusers/webusers/${path}` : `https://outducks.org/${site}/${path}`;
  return `https://inducks.org/hr.php?image=${encodeURIComponent(source)}&normalsize=1`;
}

/** Renvoie index.html, enrichi des métadonnées de la fiche quand elles sont connues. */
export async function page(ctx: Ctx, meta: Meta | null): Promise<Response> {
  const index = await ctx.env.ASSETS.fetch(new URL("/", ctx.request.url));
  if (!meta || !index.ok) return index;
  const title = `${meta.title} | InducksButBetter`;
  const set = (value: string) => ({
    element(e: { setAttribute: (k: string, v: string) => void }) {
      e.setAttribute("content", value);
    },
  });
  const rewriter = new HTMLRewriter()
    .on("title", {
      element(e) {
        e.setInnerContent(title);
      },
    })
    .on('meta[name="description"]', set(meta.description))
    .on('meta[property="og:title"]', set(meta.title))
    .on('meta[property="og:description"]', set(meta.description))
    .on('meta[property="og:url"]', set(ctx.request.url))
    .on('meta[name="twitter:card"]', set(meta.image ? "summary" : "summary_large_image"));
  if (meta.image) rewriter.on('meta[property="og:image"]', set(meta.image));
  const res = rewriter.transform(index);
  const headers = new Headers(res.headers);
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  return new Response(res.body, { status: 200, headers });
}
