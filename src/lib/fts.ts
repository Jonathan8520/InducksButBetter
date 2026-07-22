/**
 * fts.ts — Construction des motifs de recherche FTS5.
 *
 * Les tables FTS5 de la base sont bâties avec deux tokenizers, pour deux usages distincts
 * (cf. scripts/schema_spec.py) :
 *
 *   trigram    sur les colonnes de CODES, où l'utilisateur cherche au milieu d'une chaîne
 *              (`charactercode LIKE '%x%'` dans l'ancien code). Seul tokenizer capable de
 *              retrouver une sous-chaîne arbitraire. Exige au moins 3 caractères.
 *
 *   unicode61  sur le texte naturel, avec `remove_diacritics 2` : les accents deviennent
 *              transparents, ce qui compte sur un corpus fr/de/it/es/pt. Ne sait faire que
 *              du préfixe.
 *
 * La syntaxe de requête FTS5 a ses propres métacaractères (`"`, `*`, `-`, `:`, `^`, `NEAR`,
 * `AND`, `OR`…). Une saisie utilisateur passée telle quelle provoque au mieux une erreur de
 * syntaxe, au pire une requête qui ne veut plus dire ce qu'on croit. Tout terme est donc
 * mis entre guillemets — ce qui, en FTS5, en fait une chaîne littérale — après doublement
 * des guillemets internes.
 */

/** Longueur minimale exploitable par le tokenizer trigram. */
export const TRIGRAM_MIN = 3;

/** Met un terme entre guillemets FTS5, en neutralisant ses guillemets internes. */
function quote(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

/**
 * Motif de recherche par sous-chaîne, pour une table en tokenizer `trigram`.
 * Renvoie `null` si le terme est trop court : l'appelant doit alors retomber sur un LIKE
 * (acceptable, les tables concernées comptent quelques milliers de lignes).
 */
export function ftsSubstring(term: string): string | null {
  const cleaned = term.trim();
  if (cleaned.length < TRIGRAM_MIN) return null;
  return quote(cleaned);
}

/**
 * Motif de recherche par préfixe, pour une table en tokenizer `unicode61`.
 * Chaque mot saisi doit être présent (conjonction implicite de FTS5), le dernier étant
 * traité comme un préfixe pour que la recherche réagisse à la frappe.
 */
export function ftsPrefix(term: string): string | null {
  const words = term.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words.map((w, i) => (i === words.length - 1 ? `${quote(w)}*` : quote(w))).join(" ");
}

/**
 * Indique si la recherche plein texte est disponible.
 *
 * La base locale importée depuis les fichiers ISV ne contient pas les tables FTS5 : elles
 * sont construites par la CI. Les appelants doivent donc conserver un chemin de repli.
 */
export function ftsAvailable(): boolean {
  return ftsSupported;
}

let ftsSupported = true;

/** Désactive le chemin FTS pour la session (appelé si une requête FTS échoue). */
export function disableFts(): void {
  ftsSupported = false;
}
