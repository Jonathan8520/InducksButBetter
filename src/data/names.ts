/**
 * Résolution groupée des noms (auteurs, personnages, publications). Ces tables sont petites
 * et très demandées : un cache mémoire évite de les relire d'une page à l'autre.
 */
import { placeholders, rows } from "../db/client";
import { dataLanguages } from "../lib/inducks";

const people = new Map<string, string>();
const characters = new Map<string, string>();
const publications = new Map<string, { title: string; countrycode: string }>();

async function resolve<T>(
  cache: Map<string, T>,
  codes: Iterable<string>,
  load: (missing: string[]) => Promise<[string, T][]>,
): Promise<Map<string, T>> {
  const wanted = [...new Set([...codes].filter(Boolean))];
  const missing = wanted.filter((c) => !cache.has(c));
  for (let i = 0; i < missing.length; i += 400) {
    const part = missing.slice(i, i + 400);
    for (const [k, v] of await load(part)) cache.set(k, v);
  }
  const out = new Map<string, T>();
  for (const c of wanted) {
    const v = cache.get(c);
    if (v !== undefined) out.set(c, v);
  }
  return out;
}

export function personNames(codes: Iterable<string>) {
  return resolve(people, codes, async (part) => {
    const r = await rows<{ code: string; name: string }>(
      `SELECT code, name FROM person WHERE code IN (${placeholders(part.length)})`,
      part,
    );
    return r.map((x) => [x.code, x.name || x.code]);
  });
}

export function characterNames(codes: Iterable<string>) {
  const [lang] = dataLanguages();
  return resolve(characters, codes, async (part) => {
    const r = await rows<{ code: string; name: string }>(
      `SELECT c.code,
              COALESCE((SELECT n.name FROM character_name n
                        WHERE n.code = c.code AND n.lang = ?
                        ORDER BY n.preferred DESC LIMIT 1), c.name) AS name
       FROM character c WHERE c.code IN (${placeholders(part.length)})`,
      [lang, ...part],
    );
    return r.map((x) => [x.code, x.name || x.code]);
  });
}

export function publicationTitles(codes: Iterable<string>) {
  return resolve(publications, codes, async (part) => {
    const r = await rows<{ code: string; title: string; countrycode: string }>(
      `SELECT code, title, countrycode FROM publication WHERE code IN (${placeholders(part.length)})`,
      part,
    );
    return r.map((x) => [x.code, { title: x.title || x.code, countrycode: x.countrycode }]);
  });
}

/** À appeler quand la langue change : les noms de personnages sont localisés. */
export function resetLocalizedNames() {
  characters.clear();
}
