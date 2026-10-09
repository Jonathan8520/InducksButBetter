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
  links: { site: string; name: string | null; url: string }[];
}

export async function storyDetail(code: string): Promise<StoryDetail | null> {
  const [lang] = dataLanguages();
  const base = await one<StoryRow & { rows: number | null; countries: number; header: string | null }>(
    `SELECT ${CARD_COLUMNS}, s.rows, s.countries, s.header FROM story s WHERE s.storycode = ?`,
    [lang, code],
  );
  if (!base) return null;
  const sid = base.sid;

  const [card] = await toCards([base]);
  const [
    text,
    titles,
    descriptions,
    jobs,
    chars,
    versions,
    parts,
    partOf,
    subseries,
    refs,
    links,
    header,
  ] = await Promise.all([
    one<{ comment: string | null; plot: string | null }>(
      "SELECT comment, plot FROM story_text WHERE sid = ?",
      [sid],
    ),
    rows<{ lang: string; title: string }>("SELECT lang, title FROM story_title WHERE sid = ?", [sid]),
    rows<{ lang: string; text: string }>("SELECT lang, text FROM story_desc WHERE sid = ?", [sid]),
    rows<{ personcode: string; role: string }>(
      "SELECT personcode, role FROM story_job WHERE sid = ?",
      [sid],
    ),
    rows<{ charactercode: string; n: number | null; comment: string | null }>(
      "SELECT charactercode, n, comment FROM story_char WHERE sid = ? ORDER BY n, charactercode",
      [sid],
    ),
    rows<{ svc: string; kind: string | null; pages: number | null; num: number | null; den: number | null; rows: number | null; what: string | null; plot: string | null }>(
      "SELECT svc, kind, pages, num, den, rows, what, plot FROM story_version WHERE sid = ?",
      [sid],
    ),
    rows<{ sid: number; storycode: string; part: string | null; title: string | null; date: string | null }>(
      `SELECT p.sid, s.storycode, p.part, COALESCE(p.title, s.title) AS title, p.date
       FROM story_part p JOIN story s ON s.sid = p.sid WHERE p.super = ?
       ORDER BY CAST(p.part AS INTEGER), p.part`,
      [sid],
    ),
    one<{ sid: number; storycode: string; title: string | null; part: string | null }>(
      `SELECT s.sid, s.storycode, s.title, p.part FROM story_part p
       JOIN story s ON s.sid = p.super WHERE p.sid = ? LIMIT 1`,
      [sid],
    ),
    rows<{ code: string; name: string }>(
      `SELECT x.code,
              COALESCE((SELECT n.name FROM subseries_name n WHERE n.code = x.code AND n.lang = ?
                        ORDER BY n.preferred DESC LIMIT 1), ss.name, x.code) AS name
       FROM subseries_story x LEFT JOIN subseries ss ON ss.code = x.code
       WHERE x.sid = ?`,
      [lang, sid],
    ),
    rows<{ other: number; dir: "in" | "out"; reason: string | null }>(
      `SELECT r.other, r.dir,
              COALESCE((SELECT text FROM ref_reason x WHERE x.id = r.reason AND x.lang = ?),
                       (SELECT text FROM ref_reason x WHERE x.id = r.reason AND x.lang = 'en')) AS reason
       FROM (SELECT * FROM story_ref WHERE sid = ? LIMIT 60) r`,
      [lang, sid],
    ),
    rows<{ site: string; name: string | null; url: string }>(
      `SELECT u.site, si.name, u.url FROM story_url u LEFT JOIN site si ON si.sitecode = u.site
       WHERE u.sid = ?`,
      [sid],
    ),
    base.header
      ? one<{ code: string; title: string }>("SELECT code, title FROM storyheader WHERE code = ?", [base.header])
      : Promise.resolve(null),
  ]);

  const refStories = new Map(
    (
      await fanOut<{ sid: number; storycode: string; title: string | null; kind: string | null }>(
        (part) => ({
          sql: `SELECT sid, storycode, title, kind FROM story WHERE sid IN (${placeholders(part.length)})`,
          params: part,
        }),
        [...new Set(refs.map((r) => r.other))],
      )
    ).map((r) => [r.sid, r]),
  );
  const personCodes = [...new Set(jobs.map((j) => j.personcode))].filter((c) => c !== "?" && c !== "-");
  const [names, charNames] = await Promise.all([
    personNames(personCodes),
    characterNames(chars.map((c) => c.charactercode)),
  ]);
  const order = ["p", "w", "a", "i", "r"];
  const people = personCodes
    .map((code) => ({
      code,
      name: names.get(code) ?? code,
      roles: jobs
        .filter((j) => j.personcode === code)
        .map((j) => j.role)
        .sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    }))
    .sort((a, b) => order.indexOf(a.roles[0]) - order.indexOf(b.roles[0]));

  return {
    ...card,
    comment: text?.comment ?? null,
    plot: text?.plot ?? null,
    rows: base.rows,
    countries: base.countries ?? 0,
    header,
    titles,
    descriptions,
    people,
    characters: chars.map((c) => ({
      code: c.charactercode,
      name: charNames.get(c.charactercode) ?? c.charactercode,
      comment: c.comment,
    })),
    versions: versions.map((v) => ({
      svc: v.svc,
      kind: v.kind,
      pages: formatPages(v.pages, v.num, v.den),
      rows: v.rows,
      what: v.what,
      plot: v.plot,
    })),
    parts,
    partOf,
    subseries,
    refs: refs
      .map((r) => {
        const st = refStories.get(r.other);
        return st ? { sid: st.sid, storycode: st.storycode, title: st.title, kind: st.kind, dir: r.dir, reason: r.reason } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null),
    links,
  };
}

export interface Publication {
  date: string;
  issuecode: string;
  pos: string;
  title: string | null;
  lang: string | null;
  part: string | null;
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
  const pubCodes = list.map((r) => r.publicationcode ?? r.issuecode.split(/\s+/)[0]);
  const titles = await publicationTitles(pubCodes);
  return list.map((r, i) => {
    const pc = pubCodes[i];
    const info = titles.get(pc);
    return {
      ...r,
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
