/** Minuscules sans accents : la même transformation que `norm()` dans scripts/build_db.py. */
export function norm(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en")
    .replace(/ß/g, "ss");
}

/** Code d'histoire compacté : minuscules, sans espaces (colonne story_code.code). */
export const packCode = (code: string) => code.toLowerCase().replace(/\s+/g, "");

/**
 * Transforme une saisie libre en requête FTS5 sûre : chaque mot entre guillemets (aucun
 * opérateur ne passe), le dernier en préfixe pour suggérer pendant la frappe.
 */
export function ftsWords(input: string, prefixLast = true): string | null {
  const words = norm(input)
    .replace(/["*^:()]/g, " ")
    .split(/[\s\-–—_,.;!?'’/\\]+/u)
    .filter((w) => w.length > 0);
  if (!words.length) return null;
  return words
    .map((w, i) => (prefixLast && i === words.length - 1 ? `"${w}"*` : `"${w}"`))
    .join(" ");
}

/** Requête pour une table FTS trigramme : sous-chaîne, au moins 3 caractères. */
export function ftsTrigram(input: string): string | null {
  const q = norm(input).replace(/"/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 3) return null;
  return `"${q}"`;
}

/** Échappe pour une expression régulière. */
export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Découpe un texte autour des occurrences des mots de la requête (insensible aux accents). */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const words = norm(query)
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (!words.length || !text) return [{ text, hit: false }];
  const n = norm(text);
  // Le texte normalisé garde les mêmes indices que l'original tant qu'aucun caractère ne
  // change de longueur (ß excepté) : suffisant pour surligner des titres.
  if (n.length !== text.length) return [{ text, hit: false }];
  const re = new RegExp(words.map(escapeRe).join("|"), "g");
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of n.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: text.slice(last, i), hit: false });
    parts.push({ text: text.slice(i, i + m[0].length), hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}

/** Initiales pour les avatars monogrammes. */
export function initials(name: string): string {
  const parts = name
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .split(/[\s-]+/)
    .filter((p) => /\p{L}/u.test(p));
  if (!parts.length) return name.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Teinte stable dérivée d'un code (avatars, couvertures absentes). */
export function hue(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return h % 360;
}
