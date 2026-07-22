/**
 * normalize.ts — Repli des accents et de la casse pour la recherche.
 *
 * POURQUOI : le `LIKE` de SQLite ne replie la casse que pour l'ASCII. « picsou » trouve
 * bien « Picsou », mais **« géant » ne trouve pas « Géant »** : le é accentué reste
 * sensible à la casse. Chercher « Super picsou géant » ne renvoyait donc rien, alors que
 * la publication existe.
 *
 * La base stocke des colonnes `*_norm` calculées au build par la même transformation
 * (`scripts/build_db.py`, fonction `normalize`). Les deux DOIVENT rester identiques :
 * une divergence ne casse rien visiblement, elle fait juste disparaître des résultats.
 *
 * Effet secondaire voulu : la recherche devient insensible aux accents dans les deux sens.
 * « geant » trouve « Géant », et « Géant » trouve « geant ».
 */

/**
 * Minuscules, accents retirés.
 *
 * `casefold` n'existe pas en JavaScript ; `toLowerCase` en est l'équivalent pratique ici.
 * `NFD` sépare la lettre de son accent, et l'intervalle U+0300-U+036F couvre les
 * diacritiques combinants — c'est ce qui transforme « é » en « e ».
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Motif `LIKE` sur une colonne normalisée : `%terme%`, le terme étant lui-même normalisé. */
export function normalizedLike(term: string): string {
  return `%${normalizeText(term)}%`;
}
