/**
 * Recherche instantanée (palette de commande) : quelques résultats de chaque sorte, en
 * parallèle, chacun servi par un index dédié pour répondre pendant la frappe.
 */
import { one, placeholders, rows } from "../db/client";
import { dataLanguages } from "../lib/inducks";
import { ftsTrigram, ftsWords, norm, packCode } from "../lib/text";
import { storyCards, type StoryCard } from "./stories";

export interface OmniResults {
  stories: StoryCard[];
  issues: { issuecode: string; publicationcode: string; number: string; title: string | null; date: string | null; img: string | null; publicationTitle: string }[];
  people: { code: string; name: string; nationality: string | null; stories: number }[];
  characters: { code: string; name: string; stories: number }[];
  publications: { code: string; title: string; countrycode: string; issues: number; img: string | null }[];
  series: { code: string; name: string; stories: number }[];
}

const empty: OmniResults = { stories: [], issues: [], people: [], characters: [], publications: [], series: [] };

async function storiesByCode(q: string): Promise<number[]> {
  const packed = packCode(q);
  if (packed.length < 2 || !/\d/.test(packed)) return [];
  const r = await rows<{ sid: number }>(
    "SELECT DISTINCT sid FROM story_code WHERE code >= ? AND code < ? LIMIT 6",
    [packed, packed + "￿"],
  );
  return r.map((x) => x.sid);
}

async function storiesByTitle(q: string, limit = 6): Promise<number[]> {
  const match = ftsWords(q, true);
  if (!match) return [];
  const r = await rows<{ sid: number }>(
    `SELECT r.sid FROM (SELECT rowid FROM fts_story WHERE fts_story MATCH ? ORDER BY rowid LIMIT ?) t
     JOIN story_rank r ON r.rank = t.rowid ORDER BY t.rowid`,
    [match, limit],
  );
  return r.map((x) => x.sid);
}

async function people(q: string) {
  const match = ftsTrigram(q);
  if (match) {
    return rows<OmniResults["people"][number]>(
      `SELECT p.code, p.name, p.nationality, p.stories FROM person p
       WHERE p.code IN (SELECT key FROM fts_person WHERE fts_person MATCH ? LIMIT 200)
       ORDER BY p.stories DESC LIMIT 5`,
      [match],
    );
  }
  return rows<OmniResults["people"][number]>(
    "SELECT code, name, nationality, stories FROM person WHERE code = ? COLLATE NOCASE LIMIT 1",
    [q.trim()],
  );
}

async function characters(q: string) {
  const [lang] = dataLanguages();
  const match = ftsTrigram(q);
  const base = `SELECT c.code,
      COALESCE((SELECT n.name FROM character_name n WHERE n.code = c.code AND n.lang = ?
                ORDER BY n.preferred DESC LIMIT 1), c.name) AS name, c.stories
    FROM character c`;
  if (match) {
    return rows<OmniResults["characters"][number]>(
      `${base} WHERE c.code IN (SELECT key FROM fts_character WHERE fts_character MATCH ? LIMIT 300)
       AND c.stories > 0 ORDER BY c.stories DESC LIMIT 5`,
      [lang, match],
    );
  }
  return rows<OmniResults["characters"][number]>(`${base} WHERE c.code = ? COLLATE NOCASE`, [
    lang,
    q.trim(),
  ]);
}

async function publications(q: string) {
  const match = ftsTrigram(q);
  if (!match) {
    return rows<OmniResults["publications"][number]>(
      "SELECT code, title, countrycode, issues, img FROM publication WHERE code = ? COLLATE NOCASE",
      [q.trim()],
    );
  }
  return rows<OmniResults["publications"][number]>(
    `SELECT code, title, countrycode, issues, img FROM publication
     WHERE code IN (SELECT key FROM fts_publication WHERE fts_publication MATCH ? LIMIT 200)
     ORDER BY issues DESC LIMIT 5`,
    [match],
  );
}

async function series(q: string) {
  const match = ftsTrigram(q);
  if (!match) return [];
  const [lang] = dataLanguages();
  return rows<OmniResults["series"][number]>(
    `SELECT s.code, COALESCE((SELECT n.name FROM subseries_name n WHERE n.code = s.code AND n.lang = ?
              ORDER BY n.preferred DESC LIMIT 1), s.name, s.code) AS name, s.stories
     FROM subseries s WHERE s.code IN (SELECT key FROM fts_subseries WHERE fts_subseries MATCH ?)
     ORDER BY s.stories DESC LIMIT 4`,
    [lang, match],
  );
}

/**
 * « PM 272 », « fr/PM 272 », « Picsou Magazine 272 » : une publication suivie d'un numéro.
 * La publication est cherchée par code puis par titre ; le numéro par l'index
 * (publication, numéro).
 */
async function issues(q: string) {
  const m = q.trim().match(/^(.+?)[\s#nº°.]*(\d[\w\-./]*)$/i);
  if (!m) return [];
  const pubPart = m[1].trim();
  const number = m[2];
  if (!pubPart) return [];
  let pubs: string[] = [];
  if (pubPart.includes("/")) {
    pubs = [pubPart];
  } else if (/^[A-Za-z0-9]{1,6}$/.test(pubPart)) {
    // Code court sans pays : on essaie le pays de l'interface d'abord, puis tous.
    const r = await rows<{ code: string }>(
      `SELECT code FROM publication WHERE code LIKE ? ORDER BY issues DESC LIMIT 6`,
      [`%/${pubPart}`],
    );
    pubs = r.map((x) => x.code).filter((c) => c.split("/")[1]?.toLowerCase() === pubPart.toLowerCase());
  }
  const match = ftsTrigram(pubPart);
  if (match && pubs.length < 3) {
    const r = await rows<{ code: string }>(
      `SELECT code FROM publication_label WHERE code IN
         (SELECT key FROM fts_publication WHERE fts_publication MATCH ? LIMIT 100)
       ORDER BY issues DESC LIMIT 4`,
      [match],
    );
    pubs.push(...r.map((x) => x.code).filter((c) => !pubs.includes(c)));
  }
  if (!pubs.length) return [];
  const [lang] = dataLanguages();
  const preferred = pubs.sort((a, b) => Number(b.startsWith(lang + "/")) - Number(a.startsWith(lang + "/")));
  return rows<OmniResults["issues"][number]>(
    `SELECT i.issuecode, i.publicationcode, i.number, i.title, i.date, i.img, p.title AS publicationTitle
     FROM issue i JOIN publication_label p ON p.code = i.publicationcode
     WHERE i.publicationcode IN (${placeholders(preferred.length)}) AND i.number = ?
     LIMIT 5`,
    [...preferred.slice(0, 6), number],
  );
}

export async function omniSearch(input: string): Promise<OmniResults> {
  const q = input.trim();
  if (!q) return empty;
  const [byCode, byTitle, p, c, pubs, s, iss] = await Promise.all([
    storiesByCode(q),
    storiesByTitle(q),
    people(q),
    characters(q),
    publications(q),
    series(q),
    issues(q),
  ]);
  const sids = [...new Set([...byCode, ...byTitle])].slice(0, 8);
  const stories = await storyCards(sids);
  // Une saisie qui ressemble à un code d'histoire fait remonter les correspondances exactes.
  const nq = norm(q);
  stories.sort((a, b) => {
    const ea = packCode(a.storycode) === packCode(q) || norm(a.title) === nq ? 0 : 1;
    const eb = packCode(b.storycode) === packCode(q) || norm(b.title) === nq ? 0 : 1;
    return ea - eb;
  });
  return { stories, issues: iss, people: p, characters: c, publications: pubs, series: s };
}

/** Correspondance exacte d'un code d'histoire (« W OS 386-02 », « wos386-02 »). */
export async function exactStoryCode(q: string): Promise<string | null> {
  const r = await one<{ storycode: string }>(
    `SELECT s.storycode FROM story_code c JOIN story s ON s.sid = c.sid WHERE c.code = ? LIMIT 1`,
    [packCode(q)],
  );
  return r?.storycode ?? null;
}

/** Suggestions pour les filtres (personnages, auteurs) de la recherche avancée. */
export async function suggestPeople(q: string) {
  return people(q);
}
export async function suggestCharacters(q: string) {
  return characters(q);
}
export async function suggestCountries(q: string) {
  const r = await rows<{ code: string; name: string; issues: number }>(
    "SELECT code, name, issues FROM country WHERE publications > 0 ORDER BY issues DESC",
  );
  const nq = norm(q);
  return r.filter((c) => !nq || norm(c.name).includes(nq) || c.code === nq);
}
