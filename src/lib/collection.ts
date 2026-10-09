/**
 * Ma collection : les numéros possédés, importés depuis l'export Inducks, et les histoires
 * qu'ils contiennent (calculées une fois après l'import, pour filtrer les recherches sans
 * relire la base).
 */
import { createStore } from "./store";

export interface Collection {
  issues: string[];
  /** sid des histoires présentes dans au moins un numéro possédé. */
  stories: number[];
  /** Date de la dernière analyse, pour signaler une analyse incomplète. */
  analyzed: string | null;
  updated: string | null;
}

export const collection = createStore<Collection>("ibb.collection", {
  issues: [],
  stories: [],
  analyzed: null,
  updated: null,
});

/**
 * L'export Inducks donne une ligne par numéro : `pays^code^type^commentaire`
 *
 *     fr^PM  272^^
 *     be^MMN   8^digital^
 *
 * L'issuecode est « pays/code » avec le remplissage d'espaces intérieur conservé tel quel ;
 * seules les extrémités sont nettoyées. Une ligne qui contient déjà un « / » est un
 * issuecode complet.
 */
export function parseCollection(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split(/[\n;]+/)) {
    const fields = line.split("^");
    const first = fields[0]?.trim();
    if (!first) continue;
    if (first.includes("/")) {
      out.add(first);
      continue;
    }
    const code = (fields[1] ?? "").replace(/\s+$/, "").replace(/^\s+/, "");
    if (!code || (first === "country" && code === "entrycode")) continue;
    out.add(`${first}/${code}`);
  }
  return [...out];
}

let ownedSet: Set<string> | null = null;
let ownedFor: string[] | null = null;
export function ownsIssue(issuecode: string): boolean {
  const issues = collection.get().issues;
  if (ownedFor !== issues) {
    ownedSet = new Set(issues);
    ownedFor = issues;
  }
  return ownedSet!.has(issuecode);
}

/**
 * Liste de numéros compactée pour une liste de recherche : « 1-3, 5, 7-8, HS 1 ».
 * Seuls les numéros entiers qui se suivent sont regroupés ; l'ordre d'entrée est gardé.
 */
export function compactNumbers(numbers: string[]): string {
  const out: string[] = [];
  let start: number | null = null;
  let prev: number | null = null;
  const flush = () => {
    if (start === null || prev === null) return;
    out.push(start === prev ? String(start) : `${start}-${prev}`);
    start = prev = null;
  };
  for (const raw of numbers) {
    const n = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null;
    if (n !== null && prev !== null && n === prev + 1) {
      prev = n;
      continue;
    }
    flush();
    if (n !== null) start = prev = n;
    else out.push(raw.trim());
  }
  flush();
  return out.join(", ");
}
