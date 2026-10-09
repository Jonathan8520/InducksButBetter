import { lookup, page, segments, type Ctx } from "../_lib/og";

/** /issues/:country/:pub/:number — « Picsou Magazine 272 ». */
export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const [country, pub, number] = segments(ctx);
  if (!country || !pub) return page(ctx, null);
  const code = `${country}/${pub}`;
  const row = await lookup(ctx, "p", code);
  if (!row) return page(ctx, null);
  const title = number ? `${row[0]} ${number}` : row[0];
  return page(ctx, { title, description: `${title}, ${code}${number ? ` ${number}` : ""}` });
}
