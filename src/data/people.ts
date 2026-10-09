import { one, rows } from "../db/client";
import { characterNames, personNames } from "./names";

export interface PersonRow {
  code: string;
  name: string;
  nationality: string | null;
  official: number | null;
  birthname: string | null;
  born: string | null;
  bornplace: string | null;
  died: string | null;
  diedplace: string | null;
  comment: string | null;
  fake: number | null;
  stories: number | null;
  first: string | null;
  last: string | null;
  roles: string | null;
  indexed: number | null;
}

export interface PersonDetail extends PersonRow {
  aliases: string[];
  links: { site: string; url: string }[];
  roleCounts: { role: string; n: number }[];
  topCharacters: { code: string; name: string; total: number }[];
  collaborators: { code: string; name: string; total: number }[];
  jobs: { job: string; n: number }[];
}

export async function personDetail(code: string): Promise<PersonDetail | null> {
  const p = await one<PersonRow>(
    `SELECT code, name, nationality, official, birthname, born, bornplace, died, diedplace,
            comment, fake, stories, first, last, roles, indexed FROM person WHERE code = ?`,
    [code],
  );
  if (!p) return null;
  const [aliases, links, tops, jobs] = await Promise.all([
    rows<{ name: string }>("SELECT name FROM person_alias WHERE code = ?", [code]),
    rows<{ site: string; url: string }>(
      `SELECT COALESCE(s.name, u.site) AS site, u.url FROM person_url u
       LEFT JOIN site s ON s.sitecode = u.site WHERE u.code = ?`,
      [code],
    ),
    rows<{ kind: string; other: string; total: number }>(
      "SELECT kind, other, total FROM person_top WHERE code = ? ORDER BY kind, rank",
      [code],
    ),
    rows<{ job: string; n: number }>(
      `SELECT job, COUNT(*) AS n FROM person_issue WHERE code = ? GROUP BY job ORDER BY n DESC`,
      [code],
    ),
  ]);
  const chars = tops.filter((t) => t.kind === "character");
  const co = tops.filter((t) => t.kind === "co");
  const [charNames, coNames] = await Promise.all([
    characterNames(chars.map((c) => c.other)),
    personNames(co.map((c) => c.other)),
  ]);
  return {
    ...p,
    aliases: aliases.map((a) => a.name).filter((a) => a && a !== p.name && a !== p.code),
    links,
    roleCounts: (p.roles ?? "")
      .split(";")
      .filter((x) => x && !x.startsWith("r:"))
      .map((x) => {
        const [role, n] = x.split(":");
        return { role, n: Number(n) };
      }),
    topCharacters: chars.map((c) => ({ code: c.other, name: charNames.get(c.other) ?? c.other, total: c.total })),
    collaborators: co.map((c) => ({ code: c.other, name: coNames.get(c.other) ?? c.other, total: c.total })),
    jobs,
  };
}

export interface ListPage {
  sids: number[];
  total: number;
}

/** Histoires d'un auteur, par date, éventuellement filtrées par rôle. */
export async function personStories(
  code: string,
  opts: { role?: string; order?: "asc" | "desc"; offset?: number; limit?: number; only?: "stories" | "all" },
): Promise<ListPage> {
  const where = ["code = ?"];
  if (opts.only !== "all") where.push("kind IN ('n', 'k')");
  const params: (string | number)[] = [code];
  if (opts.role === "write") where.push("(roles LIKE '%p%' OR roles LIKE '%w%')");
  else if (opts.role === "draw") where.push("(roles LIKE '%a%' OR roles LIKE '%i%')");
  else if (opts.role && /^[pwair]$/.test(opts.role)) {
    where.push("roles LIKE ?");
    params.push(`%${opts.role}%`);
  }
  const order = opts.order === "desc" ? "DESC" : "ASC";
  const [list, total] = await Promise.all([
    rows<{ sid: number }>(
      `SELECT sid FROM person_story WHERE ${where.join(" AND ")}
       ORDER BY CASE WHEN date = '' THEN 1 ELSE 0 END, date ${order}, sid LIMIT ? OFFSET ?`,
      [...params, opts.limit ?? 30, opts.offset ?? 0],
    ),
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM person_story WHERE ${where.join(" AND ")}`, params),
  ]);
  return { sids: list.map((r) => r.sid), total: total?.n ?? 0 };
}

/** Numéros indexés, traduits, lettrés ou colorisés par une personne. */
export function personIssues(code: string, job: string, offset = 0, limit = 60) {
  return rows<{ issuecode: string; date: string; publicationcode: string; number: string; title: string | null; img: string | null; publicationTitle: string | null }>(
    `SELECT x.issuecode, x.date, i.publicationcode, i.number, i.title, i.img, p.title AS publicationTitle
     FROM person_issue x JOIN issue i ON i.issuecode = x.issuecode
     LEFT JOIN publication p ON p.code = i.publicationcode
     WHERE x.code = ? AND x.job = ? ORDER BY x.date DESC LIMIT ? OFFSET ?`,
    [code, job, limit, offset],
  );
}

export interface PersonListItem {
  code: string;
  name: string;
  nationality: string | null;
  stories: number;
  first: string | null;
  last: string | null;
  roles: string | null;
}

/** Auteurs les plus prolifiques, éventuellement d'un pays. */
export function topPeople(nationality?: string, limit = 60, offset = 0): Promise<PersonListItem[]> {
  if (nationality) {
    return rows<PersonListItem>(
      `SELECT code, name, nationality, stories, first, last, roles FROM person
       WHERE nationality = ? AND stories > 0 ORDER BY stories DESC LIMIT ? OFFSET ?`,
      [nationality, limit, offset],
    );
  }
  return rows<PersonListItem>(
    `SELECT code, name, nationality, stories, first, last, roles FROM person
     WHERE stories > 0 ORDER BY stories DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

export function nationalities(): Promise<{ code: string; n: number }[]> {
  return rows<{ code: string; n: number }>(
    `SELECT nationality AS code, COUNT(*) AS n FROM person
     WHERE nationality IS NOT NULL AND stories > 0 GROUP BY nationality ORDER BY n DESC`,
  );
}
