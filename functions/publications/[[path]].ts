import { lookup, page, segments, type Ctx } from "../_lib/og";

/** /publications/:country/:pub */
export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const [country, pub] = segments(ctx);
  if (!country || !pub) return page(ctx, null);
  const code = `${country}/${pub}`;
  const row = await lookup(ctx, "p", code);
  return page(ctx, row ? { title: row[0], description: code } : null);
}
