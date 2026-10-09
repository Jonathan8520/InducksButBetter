/**
 * Recherche d'histoires multicritère.
 *
 * Chaque critère sélectif (mots du titre, personnage, auteur, pays de parution, collection)
 * produit un ensemble d'identifiants lu dans une table regroupée sur ce critère ; la base
 * en fait l'intersection, puis filtre et trie sur `story_search`, une table étroite où une
 * page de 4 Ko contient une centaine d'histoires. Sans critère sélectif, la recherche
 * parcourt directement l'index de dates.
 */
import { one, rows, type Param } from "../db/client";
import { ftsWords } from "../lib/text";

export type SortKey = "relevance" | "date_asc" | "date_desc" | "pubs" | "pages";

export interface PersonFilter {
  code: string;
  role?: "any" | "write" | "draw";
}

export interface SearchFilters {
  q?: string;
  inDescriptions?: boolean;
  kinds?: string[];
  from?: string;
  to?: string;
  characters?: string[];
  creators?: PersonFilter[];
  publishedIn?: string;
  notPublishedIn?: string;
  pagesMin?: number;
  pagesMax?: number;
  owned?: "only" | "missing";
  ownedSids?: number[];
  sort?: SortKey;
}

export interface SearchPage {
  sids: number[];
  total: number;
  capped: boolean;
}

const COUNT_CAP = 20000;

function build(f: SearchFilters) {
  const ctes: string[] = [];
  const sources: string[] = [];
  const params: Param[] = [];

  const words = f.q ? ftsWords(f.q, false) : null;
  if (words) {
    if (f.inDescriptions) {
      ctes.push(`c_text AS (
        SELECT r.sid FROM fts_story t JOIN story_rank r ON r.rank = t.rowid WHERE fts_story MATCH ?
        UNION SELECT rowid FROM fts_desc WHERE fts_desc MATCH ?)`);
      params.push(words, words);
    } else {
      ctes.push(`c_text AS (
        SELECT r.sid FROM fts_story t JOIN story_rank r ON r.rank = t.rowid WHERE fts_story MATCH ?)`);
      params.push(words);
    }
    sources.push("c_text");
  }

  (f.characters ?? []).forEach((code, i) => {
    ctes.push(`c_char${i} AS (SELECT sid FROM character_story WHERE code = ?)`);
    params.push(code);
    sources.push(`c_char${i}`);
  });

  (f.creators ?? []).forEach((p, i) => {
    let roleSql = "";
    if (p.role === "write") roleSql = " AND (roles LIKE '%p%' OR roles LIKE '%w%')";
    if (p.role === "draw") roleSql = " AND (roles LIKE '%a%' OR roles LIKE '%i%')";
    ctes.push(`c_person${i} AS (SELECT sid FROM person_story WHERE code = ?${roleSql})`);
    params.push(p.code);
    sources.push(`c_person${i}`);
  });

  if (f.publishedIn) {
    ctes.push("c_country AS (SELECT sid FROM story_country WHERE countrycode = ?)");
    params.push(f.publishedIn);
    sources.push("c_country");
  }

  if (f.owned === "only" && f.ownedSids) {
    ctes.push("c_owned AS (SELECT value AS sid FROM json_each(?))");
    params.push(JSON.stringify(f.ownedSids));
    sources.push("c_owned");
  }

  const where: string[] = [];
  const whereParams: Param[] = [];
  if (sources.length) {
    ctes.push(`cand AS (${sources.map((s) => `SELECT sid FROM ${s}`).join(" INTERSECT ")})`);
    where.push("s.sid IN (SELECT sid FROM cand)");
  }
  if (f.kinds?.length) {
    where.push(`s.kind IN (${f.kinds.map(() => "?").join(", ")})`);
    whereParams.push(...f.kinds);
  }
  if (f.from) {
    where.push("s.date >= ?");
    whereParams.push(f.from);
  }
  if (f.to) {
    where.push("s.date < ?");
    whereParams.push(`${f.to}~`);
  }
  if (f.pagesMin) {
    where.push("s.pages >= ?");
    whereParams.push(f.pagesMin);
  }
  if (f.pagesMax) {
    where.push("s.pages <= ?");
    whereParams.push(f.pagesMax);
  }
  if (f.notPublishedIn) {
    where.push("NOT EXISTS (SELECT 1 FROM story_country x WHERE x.countrycode = ? AND x.sid = s.sid)");
    whereParams.push(f.notPublishedIn);
  }
  if (f.owned === "missing" && f.ownedSids) {
    where.push("s.sid NOT IN (SELECT value FROM json_each(?))");
    whereParams.push(JSON.stringify(f.ownedSids));
  }
  // Sans aucun critère, seules les vraies histoires (pas les couvertures ni illustrations)
  // remplissent la page : c'est ce qu'on attend d'une liste « toutes les histoires ».
  if (!sources.length && !f.kinds?.length && !where.length) {
    where.push("s.kind = 'n'");
  }

  // Par défaut : pertinence avec des mots, les plus publiées sans critère (les classiques
  // d'abord), les plus récentes quand des filtres sont posés.
  const sort = f.sort ?? (words ? "relevance" : hasCriteria(f) ? "date_desc" : "pubs");
  // Les dates inconnues (« ? ») se trient après les chiffres : en ordre décroissant, elles
  // passeraient devant tout le reste.
  if (sort === "date_desc") where.push("s.date < ':'");
  const order = {
    relevance: "s.pubs DESC, s.sid",
    pubs: "s.pubs DESC, s.sid",
    date_asc: "CASE WHEN s.date IS NULL OR s.date = '' THEN 1 ELSE 0 END, s.date, s.sid",
    date_desc: "s.date DESC, s.sid",
    pages: "s.pages DESC, s.sid",
  }[sort];

  const withSql = ctes.length ? `WITH ${ctes.join(",\n")}\n` : "";
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { withSql, whereSql, order, params: [...params, ...whereParams] };
}

export function hasCriteria(f: SearchFilters): boolean {
  return Boolean(
    f.q?.trim() ||
      f.kinds?.length ||
      f.from ||
      f.to ||
      f.characters?.length ||
      f.creators?.length ||
      f.publishedIn ||
      f.notPublishedIn ||
      f.pagesMin ||
      f.pagesMax ||
      f.owned,
  );
}

export async function searchStories(f: SearchFilters, offset: number, limit: number): Promise<SearchPage> {
  const { withSql, whereSql, order, params } = build(f);
  const [page, count] = await Promise.all([
    rows<{ sid: number }>(
      `${withSql}SELECT s.sid FROM story_search s ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
    one<{ n: number }>(
      `${withSql}SELECT COUNT(*) AS n FROM (SELECT 1 FROM story_search s ${whereSql} LIMIT ${COUNT_CAP + 1})`,
      params,
    ),
  ]);
  const n = count?.n ?? 0;
  return { sids: page.map((r) => r.sid), total: Math.min(n, COUNT_CAP), capped: n > COUNT_CAP };
}

/** Toutes les lignes d'une recherche (export CSV), plafonnées. */
export async function searchAllSids(f: SearchFilters, cap = 5000): Promise<number[]> {
  const { withSql, whereSql, order, params } = build(f);
  const r = await rows<{ sid: number }>(
    `${withSql}SELECT s.sid FROM story_search s ${whereSql} ORDER BY ${order} LIMIT ?`,
    [...params, cap],
  );
  return r.map((x) => x.sid);
}
