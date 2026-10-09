import { manifest, one, rows } from "../db/client";

export interface Stats {
  stories: number;
  issues: number;
  publications: number;
  creators: number;
  characters: number;
  countries: number;
  entries: number;
  maxsid: number;
}

export interface DbInfo {
  stats: Stats;
  built: string | null;
  dump: string | null;
  version: string;
  totalBytes: number;
}

export async function dbInfo(): Promise<DbInfo> {
  const m = await manifest();
  const meta = await rows<{ key: string; value: string }>("SELECT key, value FROM meta");
  const map = new Map(meta.map((r) => [r.key, r.value]));
  return {
    stats: JSON.parse(map.get("stats") ?? "{}"),
    built: map.get("built") ?? m.built ?? null,
    dump: map.get("dump") ?? m.dump ?? null,
    version: m.version,
    totalBytes: m.totalBytes,
  };
}

/** Histoires parues pour la première fois ce mois-ci, il y a `years` ans, les plus rééditées. */
export async function anniversary(years: number, limit = 10): Promise<{ sids: number[]; month: string }> {
  const d = new Date();
  const y = d.getFullYear() - years;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const start = `${y}-${m}`;
  const end = `${y}-${m}~`;
  const r = await rows<{ sid: number }>(
    `SELECT sid FROM story_search WHERE date >= ? AND date < ? AND kind IN ('n', 'k')
     ORDER BY pubs DESC LIMIT ?`,
    [start, end, limit],
  );
  return { sids: r.map((x) => x.sid), month: start };
}

export async function storyCount(): Promise<number> {
  const r = await one<{ n: number }>("SELECT MAX(sid) AS n FROM story_search");
  return r?.n ?? 0;
}

/** Jour local au format AAAA-MM-JJ : l'histoire du jour change à minuit chez le visiteur. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Histoire du jour : une vraie histoire (pas une couverture), illustrée, tirée chaque jour
 * parmi les 3 000 plus publiées. Le tirage dépend de la date seule : tout le monde voit la
 * même le même jour.
 */
export async function storyOfTheDay(day = today()): Promise<string | null> {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const start = (Math.abs(h) % 3000) + 1;
  const r = await one<{ storycode: string }>(
    `SELECT s.storycode FROM story_rank r JOIN story s ON s.sid = r.sid
     WHERE r.rank >= ? AND s.kind = 'n' AND s.img IS NOT NULL AND s.pages >= 4
     ORDER BY r.rank LIMIT 1`,
    [start],
  );
  return r?.storycode ?? null;
}
