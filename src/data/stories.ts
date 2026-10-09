import { fanOut, one, placeholders, rows } from "../db/client";
import {
  type Credit,
  dataLanguages,
  parseCredits,
  writersArtists,
} from "../lib/inducks";
import { formatPages } from "../lib/format";
import { characterNames, personNames, publicationTitles } from "./names";

export interface StoryCard {
  sid: number;
  storycode: string;
  title: string;
  original: string | null;
  date: string | null;
  kind: string | null;
  pages: string;
  hero: string | null;
  heroName: string | null;
  credits: Credit[];
  writers: { code: string; name: string }[];
  artists: { code: string; name: string }[];
  img: string | null;
  pubs: number;
}

interface StoryRow {
  sid: number;
  storycode: string;
  title: string | null;
  date: string | null;
  kind: string | null;
  pages: number | null;
  num: number | null;
  den: number | null;
  hero: string | null;
  creators: string | null;
  img: string | null;
  pubs: number | null;
  local: string | null;
}

const CARD_COLUMNS = `s.sid, s.storycode, s.title, s.date, s.kind, s.pages, s.num, s.den,
  s.hero, s.creators, s.img, s.pubs,
  (SELECT t.title FROM story_title t WHERE t.sid = s.sid AND t.lang = ?) AS local`;

async function toCards(list: StoryRow[]): Promise<StoryCard[]> {
  const credits = new Map(list.map((r) => [r.sid, parseCredits(r.creators)]));
  const codes = new Set<string>();
  for (const c of credits.values()) for (const x of c) codes.add(x.code);
  for (const r of list) if (r.hero && /^[^\p{L}\p{N}]+$/u.test(r.hero)) r.hero = null;
  const heroes = list.map((r) => r.hero).filter((h): h is string => !!h);
  const [names, heroNames] = await Promise.all([personNames(codes), characterNames(heroes)]);
  return list.map((r) => {
    const cr = credits.get(r.sid) ?? [];
    const { writers, artists } = writersArtists(cr);
    const local = r.local && r.local !== r.title ? r.local : null;
    return {
      sid: r.sid,
      storycode: r.storycode,
      title: local ?? r.title ?? "",
      original: local ? r.title : null,
      date: r.date,
      kind: r.kind,
      pages: formatPages(r.pages, r.num, r.den),
      hero: r.hero,
      heroName: r.hero ? heroNames.get(r.hero) ?? null : null,
      credits: cr,
      writers: writers.map((code) => ({ code, name: names.get(code) ?? code })),
      artists: artists.map((code) => ({ code, name: names.get(code) ?? code })),
      img: r.img,
      pubs: r.pubs ?? 0,
    };
  });
}

/** Fiches compactes d'une liste d'histoires, dans l'ordre demandé. */
export async function storyCards(sids: number[]): Promise<StoryCard[]> {
  if (!sids.length) return [];
  const [lang] = dataLanguages();
  const found = await fanOut<StoryRow>(
    (part) => ({
      sql: `SELECT ${CARD_COLUMNS} FROM story s WHERE s.sid IN (${placeholders(part.length)})`,
      params: [lang, ...part],
    }),
    sids,
  );
  const cards = await toCards(found);
  const bySid = new Map(cards.map((c) => [c.sid, c]));
  return sids.map((s) => bySid.get(s)).filter((c): c is StoryCard => !!c);
}

export interface StoryDetail extends StoryCard {
  comment: string | null;
  plot: string | null;
  rows: number | null;
  countries: number;
  header: { code: string; title: string } | null;
  titles: { lang: string; title: string }[];
  descriptions: { lang: string; text: string }[];
  people: { code: string; name: string; roles: string[] }[];
  characters: { code: string; name: string; comment: string | null }[];
  versions: {
    svc: string;
    kind: string | null;
    pages: string;
    rows: number | null;
    what: string | null;
    plot: string | null;
  }[];
  parts: { sid: number; storycode: string; part: string | null; title: string | null; date: string | null }[];
  partOf: { sid: number; storycode: string; title: string | null; part: string | null } | null;
  subseries: { code: string; name: string }[];
  refs: { sid: number; storycode: string; title: string | null; kind: string | null; dir: "in" | "out"; reason: string | null }[];
  refCount: number;
  links: { site: string; name: string | null; url: string }[];
  /** Numéro de première parution. */
  firstIssue: { issuecode: string; publicationcode: string; title: string } | null;
}

interface StoryDoc {
  sid: number;
  code: string;
  title: string | null;
  date: string | null;
  kind: string | null;
  pages: number | null;
  num: number | null;
  den: number | null;
  rows: number | null;
  hero: string | null;
  creators: string | null;
  img: string | null;
  pubs: number | null;
  countries: number | null;
  header: [string, string] | null;
  first: [string, string | null] | null;
  comment: string | null;
  plot: string | null;
  titles: Record<string, string> | null;
  desc: Record<string, string> | null;
  jobs: [string, string][] | null;
  chars: [string, number | null, string | null][] | null;
  versions: [string, string | null, number | null, number | null, number | null, number | null, string | null][] | null;
  parts: [string, string | null, string | null, string | null][] | null;
  partOf: [string, string | null, string | null] | null;
  series: string[] | null;
  refs: [string, string | null, string | null, "in" | "out", number | null][] | null;
  refCount: number | null;
  links: [string, string | null, string][] | null;
}

/**
 * Fiche complète d'une histoire. Tout tient dans un document (table story_doc) lu en une
 * seule descente d'index ; seuls les noms sont résolus ensuite, en parallèle.
 */
export async function storyDetail(code: string): Promise<StoryDetail | null> {
  const [lang] = dataLanguages();
  const row = await one<{ doc: string }>("SELECT doc FROM story_doc WHERE storycode = ?", [code]);
  if (!row) return null;
  const d = JSON.parse(row.doc) as StoryDoc;
  if (d.hero && /^[^\p{L}\p{N}]+$/u.test(d.hero)) d.hero = null;
  const titles = d.titles ?? {};
  const local = titles[lang] && titles[lang] !== d.title ? titles[lang] : null;

  const jobs = d.jobs ?? [];
  const chars = d.chars ?? [];
  const credits = parseCredits(d.creators);
  const personCodes = [...new Set([...jobs.map((j) => j[0]), ...credits.map((c) => c.code)])].filter(
    (c) => c !== "?" && c !== "-",
  );
  const reasonIds = [...new Set((d.refs ?? []).map((r) => r[4]).filter((x): x is number => x !== null))];
  const seriesCodes = d.series ?? [];

  const firstPub = d.first ? (d.first[1] ?? d.first[0].split(/\s+/)[0]) : null;
  const [names, charNames, series, reasons, pubTitles] = await Promise.all([
    personNames(personCodes),
    characterNames([...chars.map((c) => c[0]), ...(d.hero ? [d.hero] : [])]),
    seriesCodes.length
      ? rows<{ code: string; name: string }>(
          `SELECT s.code, COALESCE((SELECT n.name FROM subseries_name n WHERE n.code = s.code AND n.lang = ?
                    ORDER BY n.preferred DESC LIMIT 1), s.name, s.code) AS name
           FROM subseries s WHERE s.code IN (${placeholders(seriesCodes.length)})`,
          [lang, ...seriesCodes],
        )
      : Promise.resolve([]),
    reasonIds.length
      ? rows<{ id: number; lang: string; text: string }>(
          `SELECT id, lang, text FROM ref_reason WHERE id IN (${placeholders(reasonIds.length)})
           AND lang IN (?, 'en')`,
          [...reasonIds, lang],
        )
      : Promise.resolve([]),
    firstPub ? publicationTitles([firstPub]) : Promise.resolve(new Map<string, { title: string; countrycode: string }>()),
  ]);

  const reasonText = (id: number | null) => {
    if (id === null) return null;
    const list = reasons.filter((r) => r.id === id);
    return (list.find((r) => r.lang === lang) ?? list[0])?.text ?? null;
  };

  const order = ["p", "w", "a", "i", "r"];
  const people = personCodes
    .map((pc) => ({
      code: pc,
      name: names.get(pc) ?? pc,
      roles: jobs
        .filter((j) => j[0] === pc)
        .map((j) => j[1])
        .sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    }))
    .filter((p) => p.roles.length > 0)
    .sort((a, b) => order.indexOf(a.roles[0]) - order.indexOf(b.roles[0]));
  const { writers, artists } = writersArtists(credits);

  return {
    sid: d.sid,
    storycode: d.code,
    title: local ?? d.title ?? "",
    original: local ? d.title : null,
    date: d.date,
    kind: d.kind,
    pages: formatPages(d.pages, d.num, d.den),
    hero: d.hero,
    heroName: d.hero ? charNames.get(d.hero) ?? null : null,
    credits,
    writers: writers.map((c) => ({ code: c, name: names.get(c) ?? c })),
    artists: artists.map((c) => ({ code: c, name: names.get(c) ?? c })),
    img: d.img,
    pubs: d.pubs ?? 0,
    comment: d.comment,
    plot: d.plot,
    rows: d.rows,
    countries: d.countries ?? 0,
    header: d.header ? { code: d.header[0], title: d.header[1] } : null,
    titles: Object.entries(titles).map(([l, t]) => ({ lang: l, title: t })),
    descriptions: Object.entries(d.desc ?? {}).map(([l, t]) => ({ lang: l, text: t })),
    people,
    characters: chars.map(([cc, , comment]) => ({ code: cc, name: charNames.get(cc) ?? cc, comment })),
    versions: (d.versions ?? []).map(([svc, kind, pages, num, den, rows_, what]) => ({
      svc,
      kind,
      pages: formatPages(pages, num, den),
      rows: rows_,
      what,
      plot: null,
    })),
    parts: (d.parts ?? []).map(([storycode, part, title, date], i) => ({ sid: i, storycode, part, title, date })),
    partOf: d.partOf ? { sid: 0, storycode: d.partOf[0], title: d.partOf[1], part: d.partOf[2] } : null,
    subseries: series,
    refs: (d.refs ?? []).map(([storycode, title, kind, dir, reason], i) => ({
      sid: i,
      storycode,
      title,
      kind,
      dir,
      reason: reasonText(reason),
    })),
    refCount: d.refCount ?? 0,
    links: (d.links ?? []).map(([site, name, url]) => ({ site, name, url })),
    firstIssue:
      d.first && firstPub
        ? {
            issuecode: d.first[0],
            publicationcode: firstPub,
            title: `${pubTitles.get(firstPub)?.title ?? firstPub} ${d.first[0].slice(firstPub.length).trim()}`,
          }
        : null,
  };
}

export interface Publication {
  /** Date de parution, vide si inconnue. */
  date: string;
  issuecode: string;
  pos: string;
  title: string | null;
  lang: string | null;
  /** Parties de l'histoire dans ce numéro (vide si elle y paraît d'un bloc). */
  parts: string[];
  publicationcode: string;
  publicationTitle: string;
  countrycode: string;
}

/** Toutes les parutions d'une histoire, avec le titre de leur publication. */
export async function storyPublications(sid: number): Promise<Publication[]> {
  const list = await rows<{ date: string; issuecode: string; pos: string; title: string | null; lang: string | null; part: string | null; publicationcode: string | null }>(
    `SELECT p.date, p.issuecode, p.pos, p.title, p.lang, p.part, p.pub AS publicationcode
     FROM story_pub p WHERE p.sid = ?`,
    [sid],
  );
  // Une histoire découpée en parties dans un même numéro n'y fait qu'une parution.
  const byIssue = new Map<string, (typeof list)[number] & { parts: string[] }>();
  for (const r of [...list].sort((a, b) => a.pos.localeCompare(b.pos))) {
    const cur = byIssue.get(r.issuecode);
    if (cur) {
      if (r.part && !cur.parts.includes(r.part)) cur.parts.push(r.part);
      cur.title ??= r.title;
    } else {
      byIssue.set(r.issuecode, { ...r, parts: r.part ? [r.part] : [] });
    }
  }
  const merged = [...byIssue.values()];
  const pubCodes = merged.map((r) => r.publicationcode ?? r.issuecode.split(/\s+/)[0]);
  const titles = await publicationTitles(pubCodes);
  return merged.map((r, i) => {
    const pc = pubCodes[i];
    const info = titles.get(pc);
    return {
      date: /^\d{4}/.test(r.date ?? "") ? r.date : "",
      issuecode: r.issuecode,
      pos: r.pos,
      title: r.title,
      lang: r.lang,
      parts: r.parts.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)),
      publicationcode: pc,
      publicationTitle: info?.title ?? pc,
      countrycode: info?.countrycode ?? pc.split("/")[0],
    };
  });
}

/** Couvertures des numéros, pour illustrer une liste de parutions. */
export async function issueCovers(issuecodes: string[]): Promise<Map<string, string>> {
  if (!issuecodes.length) return new Map();
  const r = await fanOut<{ issuecode: string; img: string | null }>(
    (part) => ({
      sql: `SELECT issuecode, img FROM issue WHERE issuecode IN (${placeholders(part.length)})`,
      params: part as string[],
    }),
    issuecodes,
  );
  return new Map(r.filter((x) => x.img).map((x) => [x.issuecode, x.img as string]));
}

export async function randomStory(): Promise<string | null> {
  const r = await one<{ storycode: string }>(
    `SELECT storycode FROM story
     WHERE sid >= (SELECT abs(random()) % (SELECT MAX(sid) FROM story_search) + 1)
       AND kind = 'n' AND img IS NOT NULL AND pubs >= 3
     LIMIT 1`,
  );
  return r?.storycode ?? null;
}
