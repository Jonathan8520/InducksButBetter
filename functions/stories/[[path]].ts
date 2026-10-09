import { imageUrl, lookup, page, segments, type Ctx } from "../_lib/og";

/** /stories/:code — titre (français s'il existe), auteurs, année et première page. */
export async function onRequestGet(ctx: Ctx): Promise<Response> {
  // Un code peut contenir « / » (« Qgr/MYE 12A ») : les segments sont recollés.
  const code = segments(ctx).join("/");
  const row = code ? await lookup(ctx, "s", code) : null;
  if (!row) return page(ctx, null);
  const [title, year, creators, img, fr] = row;
  const shown = fr && fr !== title ? `${fr} (${title})` : title;
  const description = [creators, year].filter(Boolean).join(", ") || code;
  return page(ctx, { title: shown, description: `${description}. ${code}`, image: imageUrl(img) });
}
