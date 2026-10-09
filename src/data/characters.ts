import { one, rows } from "../db/client";
import { dataLanguages } from "../lib/inducks";
import { characterNames, personNames } from "./names";
import type { ListPage } from "./people";

export interface CharacterRow {
  code: string;
  name: string;
  official: number | null;
  onetime: number | null;
  heroonly: number | null;
  comment: string | null;
  stories: number | null;
  first: string | null;
  last: string | null;
  first_sid: number | null;
}

export interface CharacterDetail extends CharacterRow {
  localName: string;
  names: { lang: string; name: string; preferred: number; comment: string | null }[];
  aliases: string[];
  universes: { code: string; name: string }[];
  coCharacters: { code: string; name: string; total: number }[];
  creators: { code: string; name: string; total: number }[];
}

export async function characterDetail(code: string): Promise<CharacterDetail | null> {
  const c = await one<CharacterRow>(
    `SELECT code, name, official, onetime, heroonly, comment, stories, first, last, first_sid
     FROM character WHERE code = ?`,
    [code],
  );
  if (!c) return null;
  const [lang] = dataLanguages();
  const [names, aliases, universes, tops] = await Promise.all([
    rows<{ lang: string; name: string; preferred: number; comment: string | null }>(
      "SELECT lang, name, preferred, comment FROM character_name WHERE code = ?",
      [code],
    ),
    rows<{ name: string }>("SELECT name FROM character_alias WHERE code = ?", [code]),
    rows<{ code: string; name: string | null }>(
      `SELECT u.universe AS code,
              COALESCE((SELECT n.name FROM universe_name n WHERE n.code = u.universe AND n.lang = ?),
                       u.universe) AS name
       FROM universe_character u WHERE u.code = ?`,
      [lang, code],
    ),
    rows<{ kind: string; other: string; total: number }>(
      "SELECT kind, other, total FROM character_top WHERE code = ? ORDER BY kind, rank",
      [code],
    ),
  ]);
  const co = tops.filter((t) => t.kind === "co");
  const cr = tops.filter((t) => t.kind === "creator");
  const [coNames, crNames] = await Promise.all([
    characterNames(co.map((x) => x.other)),
    personNames(cr.map((x) => x.other)),
  ]);
  const local =
    names.filter((n) => n.lang === lang).sort((a, b) => b.preferred - a.preferred)[0]?.name ?? c.name;
  return {
    ...c,
    localName: local,
    names,
    aliases: aliases.map((a) => a.name),
    universes: universes.map((u) => ({ code: u.code, name: u.name ?? u.code })),
    coCharacters: co.map((x) => ({ code: x.other, name: coNames.get(x.other) ?? x.other, total: x.total })),
    creators: cr.map((x) => ({ code: x.other, name: crNames.get(x.other) ?? x.other, total: x.total })),
  };
}

export async function characterStories(
  code: string,
  opts: { order?: "asc" | "desc"; offset?: number; limit?: number; only?: "stories" | "all" },
): Promise<ListPage> {
  const order = opts.order === "desc" ? "DESC" : "ASC";
  const kind = opts.only === "all" ? "" : " AND kind IN ('n', 'k')";
  const [list, total] = await Promise.all([
    rows<{ sid: number }>(
      `SELECT sid FROM character_story WHERE code = ?${kind}
       ORDER BY CASE WHEN date = '' THEN 1 ELSE 0 END, date ${order}, sid LIMIT ? OFFSET ?`,
      [code, opts.limit ?? 30, opts.offset ?? 0],
    ),
    opts.only === "all"
      ? one<{ n: number }>("SELECT stories AS n FROM character WHERE code = ?", [code])
      : one<{ n: number }>(`SELECT COUNT(*) AS n FROM character_story WHERE code = ?${kind}`, [code]),
  ]);
  return { sids: list.map((r) => r.sid), total: total?.n ?? 0 };
}

export interface CharacterListItem {
  code: string;
  name: string;
  stories: number;
  first: string | null;
}

/** Personnages les plus présents (parcourt la petite table des personnages). */
export async function topCharacters(limit = 60, offset = 0): Promise<CharacterListItem[]> {
  const [lang] = dataLanguages();
  return rows<CharacterListItem>(
    `SELECT c.code,
            COALESCE((SELECT n.name FROM character_name n WHERE n.code = c.code AND n.lang = ?
                      ORDER BY n.preferred DESC LIMIT 1), c.name) AS name,
            c.stories, c.first
     FROM (SELECT code, name, stories, first FROM character WHERE stories > 0
           ORDER BY stories DESC LIMIT ? OFFSET ?) c
     ORDER BY c.stories DESC`,
    [lang, limit, offset],
  );
}

export interface UniverseRow {
  code: string;
  name: string;
  comment: string | null;
  characters: number;
}

export function universes(): Promise<UniverseRow[]> {
  const [lang] = dataLanguages();
  return rows<UniverseRow>(
    `SELECT u.code, COALESCE((SELECT n.name FROM universe_name n WHERE n.code = u.code AND n.lang = ?),
                             (SELECT n.name FROM universe_name n WHERE n.code = u.code AND n.lang = 'en'),
                             u.code) AS name,
            u.comment, u.characters
     FROM universe u WHERE u.characters > 0 ORDER BY u.characters DESC`,
    [lang],
  );
}

export async function universeDetail(code: string) {
  const [lang] = dataLanguages();
  const u = await one<UniverseRow>(
    `SELECT u.code, COALESCE((SELECT n.name FROM universe_name n WHERE n.code = u.code AND n.lang = ?),
                             (SELECT n.name FROM universe_name n WHERE n.code = u.code AND n.lang = 'en'),
                             u.code) AS name, u.comment, u.characters
     FROM universe u WHERE u.code = ?`,
    [lang, code],
  );
  if (!u) return null;
  const members = await rows<{ code: string; stories: number }>(
    "SELECT code, stories FROM universe_character WHERE universe = ? ORDER BY stories DESC",
    [code],
  );
  const names = await characterNames(members.map((m) => m.code));
  return {
    ...u,
    members: members.map((m) => ({ code: m.code, stories: m.stories, name: names.get(m.code) ?? m.code })),
  };
}
