import { one, placeholders, rows } from "../db/client";
import { parseCredits } from "../lib/inducks";
import { formatPages } from "../lib/format";
import { personNames } from "./names";

export interface IssueRow {
  issuecode: string;
  publicationcode: string;
  countrycode: string;
  number: string;
  title: string | null;
  size: string | null;
  pages: number | null;
  price: string | null;
  printrun: string | null;
  attached: string | null;
  date: string | null;
  indexed: number | null;
  comment: string | null;
  entries: number;
  stories: number;
  publisherid: string | null;
  img: string | null;
}

export interface TocEntry {
  pos: string;
  entry: string;
  sid: number | null;
  storycode: string | null;
  title: string | null;
  originalTitle: string | null;
  kind: string | null;
  pages: string;
  part: string | null;
  people: { code: string; name: string; roles: string[] }[];
  img: string | null;
  notes: Record<string, string | number> | null;
  /** Ce numéro est la première parution de l'histoire. */
  first: boolean;
}

export interface IssueDetail extends IssueRow {
  publicationTitle: string;
  publisherName: string | null;
  toc: TocEntry[];
  jobs: { code: string; name: string; job: string }[];
  collects: { issuecode: string; publicationcode: string | null; title: string | null }[];
  collectedIn: { issuecode: string; publicationcode: string | null; title: string | null }[];
  prev: { issuecode: string; number: string } | null;
  next: { issuecode: string; number: string } | null;
}

const ISSUE_COLUMNS = `i.issuecode, i.publicationcode, i.countrycode, i.number, i.title, i.size,
  i.pages, i.price, i.printrun, i.attached, i.date, i.indexed, i.comment, i.entries, i.stories,
  i.publisherid, i.img`;

/** Retrouve un numéro depuis l'URL (publication + numéro tel qu'affiché). */
export async function findIssue(pub: string, number: string): Promise<IssueRow | null> {
  const exact = await one<IssueRow>(
    `SELECT ${ISSUE_COLUMNS} FROM issue i WHERE i.publicationcode = ? AND i.number = ? LIMIT 1`,
    [pub, number],
  );
  if (exact) return exact;
  // L'issuecode porte un remplissage d'espaces : on tente aussi la forme canonique.
  const padded = await one<IssueRow>(
    `SELECT ${ISSUE_COLUMNS} FROM issue i
     WHERE i.issuecode >= ? AND i.issuecode < ? AND replace(i.issuecode, ' ', '') = ? LIMIT 1`,
    [pub + " ", pub + "!", (pub + number).replace(/\s+/g, "")],
  );
  return padded;
}

export async function issueDetail(pub: string, number: string): Promise<IssueDetail | null> {
  const issue = await findIssue(pub, number);
  if (!issue) return null;
  const code = issue.issuecode;

  const [toc, pubRow, publisher, jobs, collects, collectedIn, siblings] = await Promise.all([
    rows<{ pos: string; entry: string; sid: number | null; storycode: string | null; title: string | null; otitle: string | null; kind: string | null; pages: number | null; num: number | null; den: number | null; part: string | null; creators: string | null; img: string | null; notes: string | null; first: number | null }>(
      `SELECT pos, entry, sid, storycode, title, otitle, kind, pages, num, den, part, creators, img, notes, first
       FROM toc WHERE issuecode = ? ORDER BY pos, entry`,
      [code],
    ),
    one<{ title: string }>("SELECT title FROM publication WHERE code = ?", [issue.publicationcode]),
    issue.publisherid
      ? one<{ name: string }>("SELECT name FROM publisher WHERE id = ?", [issue.publisherid])
      : Promise.resolve(null),
    rows<{ personcode: string; job: string }>(
      "SELECT personcode, job FROM issue_job WHERE issuecode = ?",
      [code],
    ),
    rows<{ issuecode: string; publicationcode: string | null; title: string | null }>(
      `SELECT c.b AS issuecode, i.publicationcode, p.title FROM issue_collecting c
       LEFT JOIN issue i ON i.issuecode = c.b LEFT JOIN publication_label p ON p.code = i.publicationcode
       WHERE c.a = ? AND c.dir = 'collects'`,
      [code],
    ),
    rows<{ issuecode: string; publicationcode: string | null; title: string | null }>(
      `SELECT c.b AS issuecode, i.publicationcode, p.title FROM issue_collecting c
       LEFT JOIN issue i ON i.issuecode = c.b LEFT JOIN publication_label p ON p.code = i.publicationcode
       WHERE c.a = ? AND c.dir = 'collected'`,
      [code],
    ),
    Promise.all([
      one<{ issuecode: string; number: string }>(
        `SELECT issuecode, number FROM issue WHERE issuecode < ? AND issuecode >= ?
         AND publicationcode = ? ORDER BY issuecode DESC LIMIT 1`,
        [code, issue.publicationcode + " ", issue.publicationcode],
      ),
      one<{ issuecode: string; number: string }>(
        `SELECT issuecode, number FROM issue WHERE issuecode > ? AND issuecode < ?
         AND publicationcode = ? ORDER BY issuecode LIMIT 1`,
        [code, issue.publicationcode + "!", issue.publicationcode],
      ),
    ]),
  ]);

  const creditsByEntry = toc.map((t) => parseCredits(t.creators));
  const codes = new Set<string>();
  creditsByEntry.forEach((c) => c.forEach((x) => codes.add(x.code)));
  jobs.forEach((j) => codes.add(j.personcode));
  const names = await personNames(codes);

  return {
    ...issue,
    publicationTitle: pubRow?.title ?? issue.publicationcode,
    publisherName: publisher?.name ?? null,
    toc: toc.map((t, i) => {
      const byPerson = new Map<string, string[]>();
      for (const c of creditsByEntry[i]) {
        const r = byPerson.get(c.code) ?? [];
        r.push(c.role);
        byPerson.set(c.code, r);
      }
      let notes: Record<string, string | number> | null = null;
      try {
        notes = t.notes ? JSON.parse(t.notes) : null;
      } catch {
        notes = null;
      }
      return {
        pos: t.pos,
        entry: t.entry,
        sid: t.sid,
        storycode: t.storycode,
        title: t.title ?? t.otitle,
        originalTitle: t.title && t.otitle ? t.otitle : null,
        kind: t.kind,
        pages: formatPages(t.pages, t.num, t.den),
        part: t.part,
        people: [...byPerson.entries()].map(([code, roles]) => ({
          code,
          name: names.get(code) ?? code,
          roles,
        })),
        img: t.img,
        notes,
        first: t.first === 1,
      };
    }),
    jobs: jobs.map((j) => ({ code: j.personcode, name: names.get(j.personcode) ?? j.personcode, job: j.job })),
    collects,
    collectedIn,
    prev: siblings[0],
    next: siblings[1],
  };
}

export interface IssueTile {
  issuecode: string;
  publicationcode: string;
  number: string;
  title: string | null;
  date: string | null;
  img: string | null;
  stories: number;
  publicationTitle?: string;
  /** Nombre total de numéros de la publication (pour « 12 sur 597 »). */
  publicationIssues?: number;
}

/** Numéros les plus récents d'un pays (parutions de la semaine, du mois…). */
export async function latestIssues(country: string, limit = 18): Promise<IssueTile[]> {
  const today = new Date().toISOString().slice(0, 10);
  const r = await rows<IssueTile & { publicationTitle: string }>(
    `SELECT i.issuecode, i.publicationcode, i.number, i.title, i.date, i.img, i.stories,
            p.title AS publicationTitle
     FROM issue i LEFT JOIN publication_label p ON p.code = i.publicationcode
     WHERE i.countrycode = ? AND i.date <= ? AND i.date >= '1900'
     ORDER BY i.date DESC LIMIT ?`,
    [country, today, limit * 2],
  );
  // Une publication très prolifique (quotidiens) ne doit pas occuper toute l'étagère.
  const perPub = new Map<string, number>();
  const out: IssueTile[] = [];
  for (const x of r) {
    const n = perPub.get(x.publicationcode) ?? 0;
    if (n >= 3) continue;
    perPub.set(x.publicationcode, n + 1);
    out.push(x);
    if (out.length >= limit) break;
  }
  return out;
}

/** Numéros d'une liste de codes (collection), avec leur publication. */
export async function issueTiles(codes: string[]): Promise<IssueTile[]> {
  const out: IssueTile[] = [];
  for (let i = 0; i < codes.length; i += 300) {
    const part = codes.slice(i, i + 300);
    out.push(
      ...(await rows<IssueTile>(
        `SELECT i.issuecode, i.publicationcode, i.number, i.title, i.date, i.img, i.stories,
                p.title AS publicationTitle, p.issues AS publicationIssues
         FROM issue i LEFT JOIN publication_label p ON p.code = i.publicationcode
         WHERE i.issuecode IN (${placeholders(part.length)})`,
        part,
      )),
    );
  }
  return out;
}
