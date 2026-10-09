import { one, rows } from "../db/client";
import type { IssueTile } from "./issues";

export interface PublicationRow {
  code: string;
  countrycode: string;
  lang: string | null;
  title: string;
  size: string | null;
  comment: string | null;
  circulation: string | null;
  fake: number | null;
  issues: number;
  first: string | null;
  last: string | null;
  img: string | null;
}

const PUB_COLUMNS = `code, countrycode, lang, title, size, comment, circulation, fake, issues,
  first, last, img`;

export interface PublicationDetail extends PublicationRow {
  names: string[];
  publishers: { id: string; name: string; issues: number; first: string | null; last: string | null }[];
}

export async function publicationDetail(code: string): Promise<PublicationDetail | null> {
  const pub = await one<PublicationRow>(`SELECT ${PUB_COLUMNS} FROM publication WHERE code = ?`, [code]);
  if (!pub) return null;
  const [names, publishers] = await Promise.all([
    rows<{ name: string }>("SELECT name FROM publication_name WHERE code = ?", [code]),
    rows<{ id: string; name: string; issues: number; first: string | null; last: string | null }>(
      `SELECT x.publisherid AS id, COALESCE(p.name, x.publisherid) AS name, x.issues, x.first, x.last
       FROM publisher_publication x LEFT JOIN publisher p ON p.id = x.publisherid
       WHERE x.code = ? ORDER BY x.first`,
      [code],
    ),
  ]);
  return { ...pub, names: names.map((n) => n.name).filter((n) => n !== pub.title), publishers };
}

/** Tous les numéros d'une publication, dans l'ordre du code (donc de numérotation). */
export function publicationIssues(code: string): Promise<IssueTile[]> {
  return rows<IssueTile>(
    `SELECT issuecode, publicationcode, number, title, date, img, stories FROM issue
     WHERE issuecode >= ? AND issuecode < ? AND publicationcode = ?`,
    [code + " ", code + "!", code],
  );
}

export function countryPublications(country: string): Promise<PublicationRow[]> {
  return rows<PublicationRow>(
    `SELECT ${PUB_COLUMNS} FROM publication WHERE countrycode = ? ORDER BY issues DESC`,
    [country],
  );
}

export interface CountryRow {
  code: string;
  name: string;
  lang: string | null;
  publications: number;
  issues: number;
  stories: number;
}

export function countries(): Promise<CountryRow[]> {
  return rows<CountryRow>(
    `SELECT code, name, lang, publications, issues, stories FROM country
     WHERE publications > 0 ORDER BY issues DESC`,
  );
}

export function country(code: string): Promise<CountryRow | null> {
  return one<CountryRow>(
    "SELECT code, name, lang, publications, issues, stories FROM country WHERE code = ?",
    [code],
  );
}

export interface PublisherDetail {
  id: string;
  name: string;
  issues: number;
  publications: number;
  list: (PublicationRow & { pubIssues: number; pubFirst: string | null; pubLast: string | null })[];
}

export async function publisherDetail(id: string): Promise<PublisherDetail | null> {
  const p = await one<{ id: string; name: string; issues: number; publications: number }>(
    "SELECT id, name, issues, publications FROM publisher WHERE id = ?",
    [id],
  );
  if (!p) return null;
  const list = await rows<PublicationRow & { pubIssues: number; pubFirst: string | null; pubLast: string | null }>(
    `SELECT p.code, p.countrycode, p.lang, p.title, p.size, p.comment, p.circulation, p.fake,
            p.issues, p.first, p.last, p.img,
            x.issues AS pubIssues, x.first AS pubFirst, x.last AS pubLast
     FROM publisher_publication x JOIN publication p ON p.code = x.code
     WHERE x.publisherid = ? ORDER BY x.issues DESC`,
    [id],
  );
  return { ...p, list };
}
