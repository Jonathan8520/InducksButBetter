import { lookup, page, segments, type Ctx } from "../_lib/og";

/** /creators/:code */
export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const [code] = segments(ctx);
  const row = code ? await lookup(ctx, "a", code) : null;
  return page(ctx, row ? { title: row[0], description: `${row[0]}, I.N.D.U.C.K.S. ${code}` } : null);
}
