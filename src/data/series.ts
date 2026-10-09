import { one, rows } from "../db/client";
import { dataLanguages } from "../lib/inducks";
import { ftsTrigram } from "../lib/text";
import type { ListPage } from "./people";

export interface SeriesRow {
  code: string;
  name: string;
  official: number | null;
  comment: string | null;
  category: string | null;
  stories: number;
  first: string | null;
  last: string | null;
  img: string | null;
}

const COLUMNS = (lang: string) => `s.code,
  COALESCE((SELECT n.name FROM subseries_name n WHERE n.code = s.code AND n.lang = '${lang.replace(/'/g, "")}'
            ORDER BY n.preferred DESC LIMIT 1), s.name, s.code) AS name,
  s.official, s.comment, s.category, s.stories, s.first, s.last, s.img`;

export function seriesList(q = "", limit = 120): Promise<SeriesRow[]> {
  const [lang] = dataLanguages();
  const match = ftsTrigram(q);
  if (match) {
    return rows<SeriesRow>(
      `SELECT ${COLUMNS(lang)} FROM subseries s
       WHERE s.code IN (SELECT key FROM fts_subseries WHERE fts_subseries MATCH ?)
       ORDER BY s.stories DESC LIMIT ?`,
      [match, limit],
    );
  }
  return rows<SeriesRow>(
    `SELECT ${COLUMNS(lang)} FROM (SELECT * FROM subseries WHERE stories > 0
       ORDER BY stories DESC LIMIT ?) s ORDER BY s.stories DESC`,
    [limit],
  );
}

export async function seriesDetail(code: string) {
  const [lang] = dataLanguages();
  const s = await one<SeriesRow>(`SELECT ${COLUMNS(lang)} FROM subseries s WHERE s.code = ?`, [code]);
  if (!s) return null;
  const names = await rows<{ lang: string; name: string }>(
    "SELECT lang, name FROM subseries_name WHERE code = ?",
    [code],
  );
  return { ...s, names };
}

export async function seriesStories(
  code: string,
  opts: { order?: "asc" | "desc"; offset?: number; limit?: number },
): Promise<ListPage> {
  const order = opts.order === "desc" ? "DESC" : "ASC";
  const [list, total] = await Promise.all([
    rows<{ sid: number }>(
      `SELECT sid FROM subseries_story WHERE code = ?
       ORDER BY CASE WHEN date = '' THEN 1 ELSE 0 END, date ${order}, sid LIMIT ? OFFSET ?`,
      [code, opts.limit ?? 30, opts.offset ?? 0],
    ),
    one<{ stories: number }>("SELECT stories FROM subseries WHERE code = ?", [code]),
  ]);
  return { sids: list.map((r) => r.sid), total: total?.stories ?? 0 };
}
