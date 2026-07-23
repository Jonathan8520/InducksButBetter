import { ftsPrefix, ftsAvailable } from "./fts";
import { normalizedLike, normalizeText } from "./normalize";

export interface SearchFilters {
  title?: string;
  description?: string;
  includeComments?: boolean | string;
  storycode?: string;
  charactercode?: string[] | string;
  excludeCharactercode?: string[] | string;
  personRoles?: { id: string; code: string; role: string }[];
  excludePersoncode?: string[] | string;
  publisherid?: string;
  kind?: string[] | string;
  pagesMin?: number;
  pagesMax?: number;
  pagesExact?: string | number;
  rowsperpage?: string;
  panelsperstrip?: string;
  stripsperpage?: string;
  language?: string[] | string;
  country?: string[] | string;
  herocode?: string[] | string;
  onlyCollection?: boolean;
  dateAfter?: string;
  dateBefore?: string;
  nationality?: string[] | string;
  universes?: string[] | string;
  subseriescode?: string[] | string;
  noOtherCharacters?: boolean | string;
  sort?: string;
  page?: number | string;
  indexingIncomplete?: boolean | string;
  multipleParts?: boolean | string;
  hasImage?: 'all' | 'yes' | 'no';
  lang?: string;
}

export interface SearchQueryResponse {
  query: string;
  countQuery: string;
  params: any[];
  countParams: any[];
  pageSize: number;
  page: number;
}

export interface StorycodeCandidate {
  unpacked: string;
  packed: string;
}

/**
 * Resolves a storycode search string into potential COA (Inducks) storycode candidates.
 * Replicates the "smart search" heuristics of Inducks' coa/util14-storycode.php.
 * 
 * @param code The raw storycode typed by the user.
 * @returns An array of unpacked and packed (alphanumeric lowercase) candidates.
 */
export function getStorycodeCandidates(code: string): StorycodeCandidate[] {
  let h = code.trim();
  h = h.replace(/\s+/g, ' ');

  const candidates: string[] = [h];

  // Heuristics matching Inducks COA util14-storycode.php
  let heuristic = h;
  
  // 1. Normalize common publication prefix aliases
  heuristic = heuristic.replace(/^w?\s?us\s/i, "W US "); // e.g. "US 1" -> "W US 1"
  heuristic = heuristic.replace(/^w?\s?os\s/i, "W OS "); // e.g. "OS 1" -> "W OS 1"
  heuristic = heuristic.replace(/^w?\s?wdcs/i, "W WDC ");
  heuristic = heuristic.replace(/^w?\s?dda/i, "W OS ");
  
  heuristic = heuristic.replace(/\s+/g, ' ');
  
  // 2. Map old Dell Giant (W US) codes to their corresponding W OS issue number
  heuristic = heuristic.replace(/^w us\s?1[ a-z-]*$/i, "W OS 386");
  heuristic = heuristic.replace(/^w us\s?2[ a-z-]*$/i, "W OS 456");
  heuristic = heuristic.replace(/^w us\s?3[ a-z-]*$/i, "W OS 495");
  
  // 3. Remove trailing publication indicator suffix: W ([a-z ]+ [0-9]+)( |-)[a-z]+ -> W \1
  const wMatch = heuristic.match(/^w ([a-z ]+\s?[0-9]+)(?: |-)[a-z]+/i);
  if (wMatch) {
    heuristic = "W " + wMatch[1];
  }
  
  // 4. Ensure space between country prefix and issue number: ^(.)([0-9]) -> \1 \2
  heuristic = heuristic.replace(/^([a-z])([0-9])/i, "$1 $2");
  
  // 5. Map Italian Topolino series prefix: ^j -> I
  heuristic = heuristic.replace(/^j\s/i, "I ");
  
  // 6. Strip leading zeros from issue numbers
  heuristic = heuristic.replace(/^([hs]\s.*\s)0+/i, "$1");
  heuristic = heuristic.replace(/^(w\s.*[a-z].*\s)0+/i, "$1");
  
  // 7. Normalize French PM (Parade du Journal de Mickey) and strip parts suffixes
  heuristic = heuristic.replace(/f\s?pm/i, "F PM");
  heuristic = heuristic.replace(/^(f\s[a-z]{2}\s[0-9]{5})[acde]/i, "$1");
  
  // 8. Italian Topolino shortcut: "I 123" or "I T 123" -> "I TL 123"
  if (/^I [0-9]/i.test(heuristic)) {
    heuristic = heuristic.replace(/^I\s/i, "I TL ");
  }
  if (/^I T\s/i.test(heuristic)) {
    heuristic = heuristic.replace(/^I T\s/i, "I TL ");
  }
  
  // 9. Dutch Donald Duck weekly (H) date format conversions
  if (/^H ([0-9]{4})$/i.test(heuristic)) {
    const digits = heuristic.substring(2);
    heuristic = "H " + digits[0] + digits[1] + "0" + digits[2] + digits[3];
  }
  
  heuristic = heuristic.replace(/^W FC/i, "W OS");
  heuristic = heuristic.replace(/^([A-Za-z]+)-/i, "$1 ");
  
  // 10. Dutch HJR / HLN to H code conversions (e.g. HJR 1984 -> H 19084)
  const hjr4Match = heuristic.match(/^HJR ([0-9]{4})$/i);
  if (hjr4Match) {
    heuristic = "H " + hjr4Match[1].substring(0, 2) + "0" + hjr4Match[1].substring(2);
  } else {
    const hjr5Match = heuristic.match(/^HJR ([0-9]{5})$/i);
    if (hjr5Match) {
      heuristic = "H " + hjr5Match[1];
    } else {
      const hln4Match = heuristic.match(/^HLN ([0-9]{4})$/i);
      if (hln4Match) {
        heuristic = "H " + hln4Match[1].substring(0, 2) + "0" + hln4Match[1].substring(2);
      } else {
        const hln5Match = heuristic.match(/^HLN ([0-9]{5})$/i);
        if (hln5Match) {
          heuristic = "H " + hln5Match[1];
        }
      }
    }
  }
  
  heuristic = heuristic.replace(/^HJR\s/i, "H ");
  heuristic = heuristic.replace(/^HLN\s/i, "H ");
  heuristic = heuristic.replace(/^W M\s?M\s?O\s?S/i, "W OS");
  heuristic = heuristic.replace(/^W D\s?D\s?O\s?S/i, "W OS");
  
  heuristic = heuristic.replace(/^IS\s/i, "I ");
  heuristic = heuristic.replace(/^WM\s/i, "W ");
  heuristic = heuristic.replace(/^wdc/i, "W WDC");

  if (heuristic !== h) {
    candidates.push(heuristic);
  }


  // Pack the candidates: remove all whitespace, convert to lowercase, and strip special chars
  const seen = new Set<string>();
  const out: StorycodeCandidate[] = [];

  for (const c of candidates) {
    const packed = c.replace(/\s+/g, '').toLowerCase().replace(/[^a-z0-9\-]/g, '');
    if (!seen.has(packed)) {
      seen.add(packed);
      out.push({ unpacked: c, packed });
    }
  }

  return out;
}

/**
 * Vérifie que chaque `?` de la requête a bien un paramètre en face.
 *
 * Les requêtes sont assemblées par concaténation et leurs paramètres sont positionnels :
 * ajouter ou retirer un `?` sans toucher au tableau décale silencieusement TOUS les
 * paramètres suivants, ce qui produit des résultats faux plutôt qu'une erreur. Ce contrôle
 * transforme cette classe de bug en échec immédiat et lisible.
 *
 * Les `?` situés dans un commentaire SQL (`--`) sont ignorés, tout comme ceux d'un
 * littéral entre apostrophes.
 */
function countPlaceholders(sql: string): number {
  let count = 0;
  let inString = false;
  let inComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inComment) {
      if (ch === "\n") inComment = false;
      continue;
    }
    if (inString) {
      if (ch === "'") inString = false;
      continue;
    }
    if (ch === "'") inString = true;
    else if (ch === "-" && sql[i + 1] === "-") inComment = true;
    else if (ch === "?") count++;
  }
  return count;
}

/**
 * Encadre un préfixe par deux bornes, pour remplacer `col LIKE 'prefix%'` par
 * `col >= lo AND col < hi` — toujours servi par un index, sans dépendre de la collation.
 *
 * La borne haute incrémente le dernier caractère du préfixe. Les storycodes compactés
 * n'utilisent que `[a-z0-9-]`, donc il n'y a pas de cas limite en fin d'alphabet à traiter
 * ici — mais la borne reste correcte au-delà, puisque la comparaison est binaire.
 */
export function packedPrefixRange(prefix: string): [string, string] {
  if (!prefix) return ["", "￿"];
  const last = prefix.charCodeAt(prefix.length - 1);
  return [prefix, prefix.slice(0, -1) + String.fromCharCode(last + 1)];
}

function assertParamCount(r: SearchQueryResponse, label: string): void {
  const expected = countPlaceholders(r.query);
  if (expected !== r.params.length) {
    throw new Error(
      `${label}: ${expected} marqueurs '?' dans la requête pour ${r.params.length} paramètres. ` +
      `Un décalage positionnel donnerait des résultats faux.`,
    );
  }
  const expectedCount = countPlaceholders(r.countQuery);
  if (expectedCount !== r.countParams.length) {
    throw new Error(
      `${label} (count): ${expectedCount} marqueurs '?' pour ${r.countParams.length} paramètres.`,
    );
  }
}

/**
 * Voie rapide « une seule entité, tri par date ».
 *
 * Cliquer un personnage, ou chercher les histoires d'un auteur, produit une recherche dont
 * le SEUL filtre est un charactercode ou un personcode, avec le tri par défaut (date). Dans
 * ce cas, character_stories / person_stories — groupées sur (code, date, storycode) — sont
 * DÉJÀ triées : les 24 premières lignes se lisent d'un bloc.
 *
 * La forme générale, elle, ramène TOUS les storycodes de l'entité (13 000+ pour Donald Duck)
 * puis va chercher la date de chacun dans inducks_story pour trier : mesuré à 430 et 582
 * requêtes HTTP. Par la table groupée : 1 et 5. Le gain n'existe que lorsque AUCUN autre
 * filtre ne restreint le résultat — sinon on retombe sur la forme générale.
 *
 * Renvoie null si la recherche ne se réduit pas à ce cas.
 */
function tryClusteredEntitySearch(
  filters: SearchFilters,
  pageSize: number,
  offset: number,
  lang: string,
): SearchQueryResponse | null {
  // Aucun autre champ restrictif ne doit être posé.
  const restricting: (keyof SearchFilters)[] = [
    "title", "description", "storycode", "excludeCharactercode", "excludePersoncode",
    "publisherid", "kind", "pagesMin", "pagesMax", "pagesExact", "language", "country",
    "herocode", "onlyCollection", "dateAfter", "dateBefore", "nationality", "universes",
    "subseriescode", "noOtherCharacters", "indexingIncomplete", "multipleParts",
    "panelsperstrip", "stripsperpage",
  ];
  const isSet = (v: unknown) =>
    Array.isArray(v) ? v.filter(Boolean).length > 0 : v !== undefined && v !== "" && v !== false;
  if (restricting.some((k) => isSet(filters[k]))) return null;
  if (filters.hasImage && filters.hasImage !== "all") return null;

  const sort = filters.sort || "pubdate_desc";
  if (sort !== "pubdate_desc" && sort !== "pubdate_asc") return null;
  const dir = sort === "pubdate_asc" ? "ASC" : "DESC";

  // Exactement un personnage, OU exactement un auteur sans rôle précis.
  const chars = (Array.isArray(filters.charactercode)
    ? filters.charactercode
    : filters.charactercode ? [filters.charactercode] : []).map(String).map(c => c.trim()).filter(Boolean);
  const roles = (filters.personRoles || []).filter(pr => pr.code && String(pr.code).trim());
  const anyRole = roles.length === 1 && (!roles[0].role || roles[0].role === "any");

  let table: string, keyCol: string, keyVal: string;
  if (chars.length === 1 && roles.length === 0) {
    table = "character_stories"; keyCol = "charactercode"; keyVal = chars[0];
  } else if (anyRole && chars.length === 0) {
    table = "person_stories"; keyCol = "personcode"; keyVal = roles[0].code.trim();
  } else {
    return null;
  }

  const query = `
    WITH StoryIds AS (
      SELECT storycode FROM ${table}
      WHERE ${keyCol} = ?
      ORDER BY firstpublicationdate ${dir}, storycode ${dir}
      LIMIT ? OFFSET ?
    )
    SELECT
      c.storycode,
      COALESCE(NULLIF(i.story_title, ''), c.storycode) as story_title,
      NULLIF(i.series_title, '')   as series_title,
      NULLIF(i.description, '')     as full_description,
      NULLIF(i.character_list, '')  as character_list,
      NULLIF(c.publication_list, '') as publication_list,
      NULLIF(c.creators, '')        as creators,
      NULLIF(c.story_thumb, '')     as story_thumb,
      NULL as hero_name,
      c.kind, c.entirepages, c.brokenpagenumerator, c.brokenpagedenominator,
      c.rowsperpage, c.firstpublicationdate
    FROM StoryIds ids
    JOIN story_card c ON c.storycode = ids.storycode
    LEFT JOIN story_card_i18n i ON i.storycode = ids.storycode AND i.languagecode = ?
    ORDER BY c.firstpublicationdate ${dir}, c.storycode ${dir}
  `;
  // COUNT DISTINCT storycode : character_stories a une ligne par (code, date, storycode),
  // donc un storycode apparaît une seule fois par entité — COUNT(*) suffit.
  const countQuery = `SELECT COUNT(*) as total FROM ${table} WHERE ${keyCol} = ?`;

  const result = {
    query, countQuery,
    params: [keyVal, pageSize, offset, lang],
    countParams: [keyVal],
    pageSize, page: Math.floor(offset / pageSize) + 1,
  };
  assertParamCount(result, "tryClusteredEntitySearch");
  return result;
}

export function buildAdvancedSearchQuery(filters: SearchFilters): SearchQueryResponse {
  const pageSize = Math.max(1, parseInt(String(filters.rowsperpage || "24"), 10) || 24);
  const page = Math.max(1, parseInt(String(filters.page || "1"), 10) || 1);
  const offset = (page - 1) * pageSize;

  // Voie rapide pour « un personnage » / « un auteur » seul, triés par date (cf. plus haut).
  const fast = tryClusteredEntitySearch(filters, pageSize, offset, filters.lang || "fr");
  if (fast) return fast;

  const where: string[] = [];
  const svWhere: string[] = [];
  const p: any[] = [];
  const lang = filters.lang || "fr";

  if (filters.storycode) {
    const code = filters.storycode.trim();
    
    // Check if we should do a basic prefix search or a smart search
    let inducksCodesOnly = false;
    if (code.length === 1 || (code.length <= 3 && (/^X/i.test(code) || /^[a-zA-Z]C/i.test(code)))) {
      inducksCodesOnly = true;
    }

    if (inducksCodesOnly) {
      const prefix = code.toUpperCase();
      const prefixEnd = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
      where.push("s.storycode >= ? AND s.storycode < ?");
      p.push(prefix, prefixEnd);

      // storycode_packed est calculée au build (lower(replace(storycode,' ',''))).
      // La forme précédente enveloppait la colonne dans REPLACE(), ce qui neutralisait
      // tout index et imposait un parcours des 355 404 histoires à chaque recherche.
      // On compare par intervalle plutôt qu'avec LIKE 'x%' : l'optimisation de LIKE en
      // parcours d'intervalle est conditionnée par la collation de l'index et le réglage
      // case_sensitive_like, alors qu'un intervalle explicite est toujours indexable.
      const stripped = prefix.replace(/\s+/g, '').toLowerCase();
      const [lo, hi] = packedPrefixRange(stripped);
      where.push("(s.storycode_packed >= ? AND s.storycode_packed < ?)");
      p.push(lo, hi);
    } else {
      const candidates = getStorycodeCandidates(code);
      if (candidates.length > 0) {
        const rangeClauses: string[] = [];
        const likeClauses: string[] = [];
        
        for (const cand of candidates) {
          const parts = cand.unpacked.split(/\s+/).filter(Boolean);
          if (parts.length > 0) {
            const prefixParts = parts.slice(0, 2);
            const prefix = prefixParts.join(' ').toUpperCase();
            const prefixEnd = prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
            
            rangeClauses.push("(s.storycode >= ? AND s.storycode < ?)");
            p.push(prefix, prefixEnd);
          }
          
          // getStorycodeCandidates produit déjà la forme compactée en minuscules,
          // exactement celle stockée dans storycode_packed.
          const [lo, hi] = packedPrefixRange(cand.packed);
          likeClauses.push("(s.storycode_packed >= ? AND s.storycode_packed < ?)");
          p.push(lo, hi);
        }
        
        if (rangeClauses.length > 0) {
          where.push("(" + rangeClauses.join(" OR ") + ")");
        }
        if (likeClauses.length > 0) {
          where.push("(" + likeClauses.join(" OR ") + ")");
        }
      }
    }
  }

  if (filters.title) {
    // Le filtre par titre était la dernière recherche en `LIKE '%mot%'` : mesurée dans un
    // vrai navigateur, elle balayait les titres de 355 404 histoires ET de 2 023 554
    // parutions, et ne rendait pas la main. Les trois tables FTS5 la remplacent.
    //
    // Trois sources, parce qu'une histoire porte trois titres possibles : celui de la
    // série (storyheader), le sien propre, et celui imprimé dans chaque parution.
    const match = ftsAvailable() ? ftsPrefix(filters.title) : null;
    if (match) {
      // UNION, et surtout PAS un OR entre trois IN portant sur des colonnes différentes :
      // mesuré, cette forme est inindexable — SQLite matérialise les trois listes puis
      // balaie les 355 404 histoires (`SCAN s`). Réunies en une seule liste sur storycode,
      // les trois branches sont chacune servies par son index et `s` est sondée par clé.
      where.push(`s.storycode IN (
        SELECT storycode FROM fts_story WHERE fts_story MATCH ?
        UNION
        SELECT sh_s.storycode FROM fts_storyheader fh
          JOIN inducks_story sh_s ON sh_s.storyheadercode = fh.storyheadercode
          WHERE fts_storyheader MATCH ?
        UNION
        SELECT storycode FROM fts_entrytitle WHERE fts_entrytitle MATCH ?
      )`);
      p.push(match, match, match);
    } else {
      // Repli sur LIKE quand les tables FTS5 sont absentes (base importée localement).
      where.push("(EXISTS (SELECT 1 FROM inducks_storyheader sh WHERE sh.storyheadercode = s.storyheadercode AND sh.title LIKE ?) OR EXISTS (SELECT 1 FROM inducks_entry e_t JOIN inducks_storyversion sv_t ON e_t.storyversioncode = sv_t.storyversioncode WHERE sv_t.storycode = s.storycode AND e_t.title LIKE ?))");
      p.push(`%${filters.title}%`, `%${filters.title}%`);
    }
  }

  if (filters.description) {
    let descClause = "(sv.plotsummary LIKE ? OR EXISTS (SELECT 1 FROM inducks_storydescription sd WHERE sd.storyversioncode = sv.storyversioncode AND sd.desctext LIKE ?))";
    p.push(`%${filters.description}%`, `%${filters.description}%`);
    if (filters.includeComments === "true" || filters.includeComments === true) {
      descClause = "(sv.plotsummary LIKE ? OR s.storycomment LIKE ? OR EXISTS (SELECT 1 FROM inducks_storydescription sd WHERE sd.storyversioncode = sv.storyversioncode AND sd.desctext LIKE ?))";
      p.push(`%${filters.description}%`);
    }
    svWhere.push(descClause);
  }

  if (filters.kind) {
    const kinds = (Array.isArray(filters.kind) ? filters.kind : String(filters.kind).split(",")).map(k => k.trim()).filter(Boolean);
    if (kinds.length > 0) {
      svWhere.push(`sv.kind IN (${kinds.map(() => "?").join(",")})`);
      p.push(...kinds);
    }
  }

  if (filters.charactercode) {
    const codes = (Array.isArray(filters.charactercode) ? filters.charactercode : String(filters.charactercode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      codes.forEach(code => {
        // Lu dans character_stories, groupée par charactercode : les storycodes d'un
        // personnage sont contigus. La forme précédente joignait inducks_appearance
        // (1,7 M lignes) à storyversion, ce qui, pour Donald Duck, renvoyait vers des
        // milliers de lignes dispersées — mesuré à 1 038 requêtes HTTP.
        where.push(`s.storycode IN (SELECT storycode FROM character_stories WHERE charactercode = ?)`);
        p.push(code);
      });
    }
  }

  if (filters.herocode) {
    const codes = (Array.isArray(filters.herocode) ? filters.herocode : String(filters.herocode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      codes.forEach(code => {
        where.push(`s.storycode IN (SELECT sv_h.storycode FROM inducks_appearance app_h JOIN inducks_storyversion sv_h ON sv_h.storyversioncode = app_h.storyversioncode WHERE app_h.charactercode = ? AND app_h.number = 0)`);
        p.push(code);
      });
    }
  }

  if (filters.excludeCharactercode) {
    const codes = (Array.isArray(filters.excludeCharactercode) ? filters.excludeCharactercode : String(filters.excludeCharactercode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      svWhere.push(`NOT EXISTS (SELECT 1 FROM inducks_appearance app_ex WHERE app_ex.storyversioncode = sv.storyversioncode AND app_ex.charactercode IN (${codes.map(() => "?").join(",")}))`);
      p.push(...codes);
    }
  }

  if (filters.universes && Array.isArray(filters.universes)) {
    const universes = filters.universes.filter(u => u && String(u).trim());
    if (universes.length > 0) {
      where.push(`s.storycode IN (SELECT sv_u.storycode FROM inducks_ucrelation ucr JOIN inducks_appearance app_u ON app_u.charactercode = ucr.charactercode JOIN inducks_storyversion sv_u ON sv_u.storyversioncode = app_u.storyversioncode WHERE app_u.number = 0 AND ucr.universecode IN (${universes.map(() => "?").join(",")}))`);
      p.push(...universes);
    }
  }

  if (filters.noOtherCharacters === true || String(filters.noOtherCharacters) === "true") {
    const selectedCharCodes = [
      ...(Array.isArray(filters.charactercode || []) ? (filters.charactercode || []) : String(filters.charactercode || "").split(",")),
      ...(Array.isArray(filters.herocode || []) ? (filters.herocode || []) : String(filters.herocode || "").split(","))
    ].map(c => c.trim()).filter(Boolean);
    const distinctSelectedCount = new Set(selectedCharCodes).size;
    if (distinctSelectedCount > 0) {
      where.push(`EXISTS (SELECT 1 FROM inducks_storyversion sv_no WHERE sv_no.storycode = s.storycode AND (SELECT COUNT(DISTINCT charactercode) FROM inducks_appearance app_count WHERE app_count.storyversioncode = sv_no.storyversioncode) = ?)`);
      p.push(distinctSelectedCount);
    }
  }

  if (filters.personRoles && Array.isArray(filters.personRoles)) {
    const roles = filters.personRoles.filter(pr => pr.code && String(pr.code).trim());
    if (roles.length > 0) {
      roles.forEach(pr => {
        // Le rôle est passé en paramètre lié (jamais concaténé). L'interface le contraint
        // à un jeu fermé (any|p|w|a|i), mais rien ne garantit qu'un futur appelant fera de
        // même.
        if (!pr.role || pr.role === 'any') {
          // Cas courant : n'importe quel rôle. person_stories est groupée par personcode,
          // donc les storycodes d'un auteur sont contigus — au lieu de balayer storyjob
          // (2,1 M lignes) pour un auteur prolifique. Mesuré : 1 796 -> quelques requêtes.
          where.push(`s.storycode IN (SELECT storycode FROM person_stories WHERE personcode = ?)`);
          p.push(pr.code.trim());
        } else {
          // Rôle précis : la sélectivité vient du rôle, on garde storyjob.
          svWhere.push(`EXISTS (SELECT 1 FROM inducks_storyjob sj WHERE sj.storyversioncode = sv.storyversioncode AND sj.personcode = ? AND sj.plotwritartink LIKE ?)`);
          p.push(pr.code.trim(), `%${pr.role}%`);
        }
      });
    }
  }

  if (filters.excludePersoncode) {
    const codes = (Array.isArray(filters.excludePersoncode) ? filters.excludePersoncode : String(filters.excludePersoncode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      svWhere.push(`NOT EXISTS (SELECT 1 FROM inducks_storyjob sj_ex WHERE sj_ex.storyversioncode = sv.storyversioncode AND sj_ex.personcode IN (${codes.map(() => "?").join(",")}))`);
      p.push(...codes);
    }
  }

  if (filters.nationality) {
    const nationalities = (Array.isArray(filters.nationality) ? filters.nationality : String(filters.nationality).split(",")).map(n => n.trim()).filter(Boolean);
    if (nationalities.length > 0) {
      svWhere.push(`EXISTS (SELECT 1 FROM inducks_storyjob sj_n JOIN inducks_person p_n ON sj_n.personcode = p_n.personcode WHERE sj_n.storyversioncode = sv.storyversioncode AND p_n.nationalitycountrycode IN (${nationalities.map(() => "?").join(",")}))`);
      p.push(...nationalities);
    }
  }

  if (filters.publisherid) {
    // inducks_publishingjob relie un ÉDITEUR à un NUMÉRO : ses colonnes sont
    // publisherid^issuecode^publishingjobcomment. Le filtre interrogeait une colonne
    // `storyversioncode` qui n'existe pas sur cette table — il ne renvoyait donc jamais
    // rien. Le lien correct passe par les parutions de l'histoire.
    svWhere.push(`EXISTS (
      SELECT 1 FROM inducks_entry e_pub
      JOIN inducks_publishingjob pjob ON pjob.issuecode = e_pub.issuecode
      WHERE e_pub.storyversioncode = sv.storyversioncode AND pjob.publisherid = ?
    )`);
    p.push(filters.publisherid);
  }

  if (filters.country || filters.language) {
    const countries = (Array.isArray(filters.country) ? filters.country : [filters.country || ""]).filter(Boolean);
    const languages = (Array.isArray(filters.language) ? filters.language : [filters.language || ""]).filter(Boolean);

    if (countries.length > 0 || languages.length > 0) {
      if (countries.length > 0) {
        const actualCountries = countries.filter(c => c !== 'UNPUBLISHED');
        const hasUnpublished = countries.includes('UNPUBLISHED');

        const parts = [];
        if (actualCountries.length > 0) {
          parts.push(`EXISTS (SELECT 1 FROM inducks_entry e_c JOIN inducks_issue i_c ON e_c.issuecode = i_c.issuecode JOIN inducks_publication p_c ON i_c.publicationcode = p_c.publicationcode WHERE e_c.storyversioncode = sv.storyversioncode AND p_c.countrycode IN (${actualCountries.map(() => "?").join(",")}))`);
          p.push(...actualCountries);
        }
        if (hasUnpublished) {
          parts.push(`NOT EXISTS (SELECT 1 FROM inducks_entry e_unpub WHERE e_unpub.storyversioncode = sv.storyversioncode)`);
        }

        if (parts.length > 0) {
          svWhere.push(`(${parts.join(" OR ")})`);
        }
      }
      if (languages.length > 0) {
        svWhere.push(`EXISTS (SELECT 1 FROM inducks_entry e_l JOIN inducks_issue i_l ON e_l.issuecode = i_l.issuecode JOIN inducks_publication p_l ON i_l.publicationcode = p_l.publicationcode WHERE e_l.storyversioncode = sv.storyversioncode AND p_l.languagecode IN (${languages.map(() => "?").join(",")}))`);
        p.push(...languages);
      }
    }
  }

  if (filters.hasImage && filters.hasImage !== 'all') {
    const existsClause = `EXISTS (SELECT 1 FROM story_thumb st_img WHERE st_img.storycode = sv.storycode AND st_img.url IS NOT NULL AND st_img.url != '')`;
    if (filters.hasImage === 'yes') {
      svWhere.push(existsClause);
    } else if (filters.hasImage === 'no') {
      svWhere.push(`NOT ${existsClause}`);
    }
  }

  if (filters.pagesExact) {
    svWhere.push("sv.entirepages = ?");
    p.push(parseInt(String(filters.pagesExact), 10));
  } else {
    if (filters.pagesMin) { svWhere.push("sv.entirepages >= ?"); p.push(parseInt(String(filters.pagesMin), 10)); }
    if (filters.pagesMax) { svWhere.push("sv.entirepages <= ?"); p.push(parseInt(String(filters.pagesMax), 10)); }
  }

  if (filters.dateAfter) { where.push("s.firstpublicationdate >= ?"); p.push(filters.dateAfter); }
  if (filters.dateBefore) { where.push("s.firstpublicationdate <= ?"); p.push(filters.dateBefore); }

  if (filters.stripsperpage && filters.stripsperpage !== 'all') {
    svWhere.push("sv.rowsperpage = ?");
    p.push(parseInt(String(filters.stripsperpage), 10));
  }
  if (filters.panelsperstrip && filters.panelsperstrip !== 'all') {
    svWhere.push("sv.columnsperpage = ?");
    p.push(parseInt(String(filters.panelsperstrip), 10));
  }

  if (filters.indexingIncomplete === "true" || filters.indexingIncomplete === true) {
    where.push(`(NOT EXISTS (SELECT 1 FROM inducks_storyversion sv_i JOIN inducks_appearance app_i ON sv_i.storyversioncode = app_i.storyversioncode WHERE sv_i.storycode = s.storycode) OR EXISTS (SELECT 1 FROM inducks_storyversion sv_i JOIN inducks_appearance app_i ON sv_i.storyversioncode = app_i.storyversioncode WHERE sv_i.storycode = s.storycode AND app_i.charactercode = '?'))`);
  }

  if (filters.multipleParts === "true" || filters.multipleParts === true) {
    svWhere.push(`EXISTS (SELECT 1 FROM inducks_entry e_p WHERE e_p.storyversioncode = sv.storyversioncode AND e_p.part IS NOT NULL AND e_p.part != '')`);
  }

  if (filters.subseriescode) {
    const codes = (Array.isArray(filters.subseriescode) ? filters.subseriescode : String(filters.subseriescode).split(",")).map(c => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      where.push(`EXISTS (SELECT 1 FROM inducks_storysubseries ss WHERE ss.storycode = s.storycode AND ss.subseriescode IN (${codes.map(() => "?").join(",")}))`);
      p.push(...codes);
    }
  }

  if (svWhere.length > 0) {
    where.push(`EXISTS (SELECT 1 FROM inducks_storyversion sv WHERE sv.storycode = s.storycode AND ${svWhere.join(" AND ")})`);
  }

  if (filters.onlyCollection) {
    try {
      const saved = localStorage.getItem("inducks_collection_issues");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        where.push(`EXISTS (SELECT 1 FROM inducks_entry c_entry JOIN inducks_storyversion c_sv ON c_entry.storyversioncode = c_sv.storyversioncode WHERE c_sv.storycode = s.storycode AND c_entry.issuecode IN (SELECT value FROM json_each(?)))`);
        p.push(JSON.stringify(parsed));
      } else {
        where.push("1 = 0");
      }
    } catch (e) {
      where.push("1 = 0");
    }
  }

  const sort = String(filters.sort || "pubdate_desc");
  let orderBy = "s.firstpublicationdate DESC, s.storycode ASC";
  // Ordre de la requête EXTERNE, exprimé sur story_card / story_card_i18n. Il est déclaré
  // explicitement plutôt que dérivé de `orderBy` par substitution d'alias : plusieurs tris
  // s'appuient sur des jointures (sh_sort) ou des sous-requêtes qui n'existent que dans le
  // CTE, et une substitution aveugle transformerait aussi `ids.` en `idc.`.
  let cardOrderBy = "c.firstpublicationdate DESC, c.storycode ASC";
  let sortJoins = "";
  
  const isPreciseStorycodeSearch = filters.storycode && String(filters.storycode).trim().split(/\s+/).length >= 2;
  
  if (sort === "pubdate_asc") {
    orderBy = "s.firstpublicationdate ASC, s.storycode ASC";
    cardOrderBy = "c.firstpublicationdate ASC, c.storycode ASC";
  } else if (sort === "title_az") {
    sortJoins = "LEFT JOIN inducks_storyheader sh_sort ON s.storyheadercode = sh_sort.storyheadercode";
    orderBy = "sh_sort.title ASC, s.storycode ASC";
    cardOrderBy = "i.story_title ASC, c.storycode ASC";
  } else if (sort === "title_za") {
    sortJoins = "LEFT JOIN inducks_storyheader sh_sort ON s.storyheadercode = sh_sort.storyheadercode";
    orderBy = "sh_sort.title DESC, s.storycode ASC";
    cardOrderBy = "i.story_title DESC, c.storycode ASC";
  } else if (sort === "pages_desc") {
    orderBy = "(SELECT MAX(entirepages) FROM inducks_storyversion WHERE storycode = s.storycode) DESC, s.storycode ASC";
    cardOrderBy = "c.entirepages DESC, c.storycode ASC";
  } else if (sort === "pages_asc") {
    orderBy = "(SELECT MIN(entirepages) FROM inducks_storyversion WHERE storycode = s.storycode) ASC, s.storycode ASC";
    cardOrderBy = "c.entirepages ASC, c.storycode ASC";
  } else if (sort === "published_most") {
    orderBy = "s.entry_count DESC, s.storycode ASC";
    cardOrderBy = "c.entry_count DESC, c.storycode ASC";
  } else if (sort === "published_least") {
    orderBy = "s.entry_count ASC, s.storycode ASC";
    cardOrderBy = "c.entry_count ASC, c.storycode ASC";
  } else if (sort === "pubdate_desc" && isPreciseStorycodeSearch) {
    // Optimization: if searching for a precise storycode, order by length to prioritize exact matches
    orderBy = "LENGTH(s.storycode) ASC, s.storycode ASC";
    cardOrderBy = "LENGTH(c.storycode) ASC, c.storycode ASC";
  }

  const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
  const countQuery = `SELECT COUNT(s.storycode) as total FROM inducks_story s ${whereSql}`;

  // La totalité du contenu d'une carte de résultat est PRÉ-ASSEMBLÉE au build, dans
  // story_card (part commune) et story_card_i18n (part linguistique).
  //
  // Ce que remplace cette requête : dix sous-requêtes corrélées exécutées POUR CHAQUE ligne
  // affichée, qui touchaient des lignes dispersées dans inducks_appearance (1,7 M),
  // inducks_entry (2,0 M) et inducks_storyjob (2,1 M). Mesuré : 1 525 pages en 1 309 plages
  // contiguës, soit 1,2 page par plage — un accès quasi parfaitement aléatoire, donc ~29 s
  // rien qu'en latence d'aller-retour. Sur la carte assemblée : 165 pages, 126 requêtes.
  //
  // Le sens de lecture est inversé : on résout d'abord les 24 identifiants de la page, puis
  // on lit 24 cartes contiguës — au lieu de rayonner depuis chaque ligne vers six tables.
  const mainQuery = `
    WITH StoryIds AS (
      SELECT s.storycode
      FROM inducks_story s
      ${sortJoins}
      ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    )
    SELECT
      c.storycode,
      COALESCE(NULLIF(i.story_title, ''), c.storycode) as story_title,
      NULLIF(i.series_title, '')                       as series_title,
      NULLIF(i.description, '')                        as full_description,
      NULLIF(i.character_list, '')                     as character_list,
      NULLIF(c.publication_list, '')                   as publication_list,
      NULLIF(c.creators, '')                           as creators,
      NULLIF(c.story_thumb, '')                        as story_thumb,
      NULL                                             as hero_name,
      c.kind,
      c.entirepages,
      c.brokenpagenumerator,
      c.brokenpagedenominator,
      c.rowsperpage,
      c.firstpublicationdate
    FROM StoryIds ids
    JOIN story_card c ON c.storycode = ids.storycode
    LEFT JOIN story_card_i18n i
           ON i.storycode = ids.storycode AND i.languagecode = ?
    ORDER BY ${cardOrderBy}
  `;

  // Un seul `lang` désormais : la carte pré-assemblée porte déjà les libellés traduits,
  // il ne reste que le choix de la ligne dans story_card_i18n. Les cinq précédents
  // servaient les sous-requêtes corrélées qui viennent de disparaître.
  const result = {
    query: mainQuery,
    countQuery,
    params: [...p, pageSize, offset, lang],
    countParams: p,
    pageSize,
    page,
  };
  assertParamCount(result, "buildAdvancedSearchQuery");
  return result;
}

export interface PublicationsSearchFilters {
  country?: string;
  title?: string;
  /** Code exact issu d'une suggestion. Prime sur `title`, et permet une égalité indexée. */
  publicationcode?: string;
  issuenumber?: string;
  dateAfter?: string;
  dateBefore?: string;
  publisherid?: string;
  indexer?: string;
  collects?: boolean | string;
  specificTitle?: string;
  pages?: number;
  price?: string;
  attached?: string;
  size?: string;
  sort?: string;
  page?: number | string;
  rowsperpage?: string;
  lang?: string;
}

export function buildPublicationsSearchQuery(filters: PublicationsSearchFilters): SearchQueryResponse {
  const pageSize = Math.max(1, parseInt(String(filters.rowsperpage || "24"), 10) || 24);
  const page = Math.max(1, parseInt(String(filters.page || "1"), 10) || 1);
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const p: any[] = [];

  if (filters.country) {
    where.push("p.countrycode = ?");
    p.push(filters.country);
  }

  // Une suggestion choisie donne le code exact : égalité sur la clé primaire de
  // inducks_publication, au lieu de balayer la table avec quatre LIKE '%...%'.
  if (filters.publicationcode) {
    where.push("p.publicationcode = ?");
    p.push(filters.publicationcode.trim());
  } else if (filters.title) {
    // Recherche texte libre (l'utilisateur n'a pas choisi de suggestion). L'index plein
    // texte trigram sur la colonne normalisée ramène d'abord les codes de publication qui
    // correspondent, puis on filtre les numéros dessus. La forme précédente — quatre
    // LIKE '%...%' sur des colonnes normalisées — balayait la table : mesurée à 444
    // requêtes HTTP. FTS insensible aux accents comme à la casse (« geant » -> « Géant »).
    const term = normalizeText(filters.title);
    const match = ftsAvailable() && term.length >= 3 ? term : null;
    if (match) {
      where.push(
        "p.publicationcode IN (SELECT publicationcode FROM fts_publication WHERE fts_publication MATCH ?)",
      );
      p.push(`"${match.replace(/"/g, '""')}"`);
    } else {
      // Repli : terme trop court pour le trigram, ou base locale sans tables FTS.
      const like = normalizedLike(filters.title);
      where.push("(p.title_norm LIKE ? OR p.publicationcode LIKE ?)");
      p.push(like, like);
    }
  }

  if (filters.issuenumber) {
    where.push("i.issuenumber = ?");
    p.push(filters.issuenumber.trim());
  }

  if (filters.dateAfter) {
    where.push("i.oldestdate >= ?");
    p.push(filters.dateAfter.trim());
  }

  if (filters.dateBefore) {
    where.push("i.oldestdate <= ?");
    p.push(filters.dateBefore.trim());
  }

  if (filters.publisherid) {
    // Réorienté : on part des numéros de cet éditeur plutôt que de balayer les 258 551
    // numéros en évaluant un EXISTS pour chacun.
    where.push(`i.issuecode IN (SELECT pj.issuecode FROM inducks_publishingjob pj WHERE pj.publisherid = ?)`);
    p.push(filters.publisherid.trim());
  }

  if (filters.indexer) {
    const like = `%${filters.indexer.trim()}%`;
    where.push(`EXISTS (
      SELECT 1 FROM inducks_issuejob ij 
      JOIN inducks_person per ON ij.personcode = per.personcode 
      WHERE ij.issuecode = i.issuecode AND ij.inxtransletcol = 'i' AND per.fullname LIKE ?
    )`);
    p.push(like);
  }

  if (filters.collects === true || filters.collects === "true") {
    where.push(`EXISTS (
      SELECT 1 FROM inducks_issuecollecting ic 
      WHERE ic.collectingissuecode = i.issuecode
    )`);
  }

  if (filters.specificTitle) {
    // « Titre spécifique du numéro » : le titre propre donné à UN numéro (rare, ex. un
    // hors-série thématique). La forme précédente — i.title LIKE '%...%' — balayait les
    // 258 551 numéros (`SCAN i`) et ne rendait jamais la main : c'est le champ signalé
    // comme « infini ». fts_issue (unicode61 remove_diacritics 2) sert la même recherche
    // par l'index plein texte, accents et casse transparents.
    //
    // À NE PAS confondre avec le titre d'une HISTOIRE : « La vie trépidante d'Onc' Picsou »
    // est un titre imprimé en parution, qui se cherche par le champ « Titre » de la
    // recherche d'histoires (fts_entrytitle), pas ici.
    const match = ftsAvailable() ? ftsPrefix(filters.specificTitle) : null;
    if (match) {
      where.push("i.issuecode IN (SELECT issuecode FROM fts_issue WHERE fts_issue MATCH ?)");
      p.push(match);
    } else {
      // Repli sans FTS (base importée localement) : la colonne normalisée reste indexable
      // et rend la recherche insensible aux accents comme à la casse.
      where.push("i.title_norm LIKE ?");
      p.push(normalizedLike(filters.specificTitle));
    }
  }

  if (filters.pages !== undefined) {
    where.push("i.pages = ?");
    p.push(filters.pages);
  }

  if (filters.price) {
    where.push("i.price LIKE ?");
    p.push(`%${filters.price.trim()}%`);
  }

  if (filters.attached) {
    where.push("i.attached LIKE ?");
    p.push(`%${filters.attached.trim()}%`);
  }

  if (filters.size) {
    where.push("i.size LIKE ?");
    p.push(`%${filters.size.trim()}%`);
  }

  const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  let orderBy = "p.countrycode ASC, i.issuecode ASC";
  const sort = filters.sort || "country_code";
  if (sort === "date_asc") {
    orderBy = "i.oldestdate ASC, i.issuecode ASC";
  } else if (sort === "date_desc") {
    orderBy = "i.oldestdate DESC, i.issuecode ASC";
  } else if (sort === "pages_asc") {
    orderBy = "i.pages ASC, i.issuecode ASC";
  } else if (sort === "pages_desc") {
    orderBy = "i.pages DESC, i.issuecode ASC";
  }

  const countQuery = `
    SELECT COUNT(*) as total
    FROM inducks_issue i
    JOIN inducks_publication p ON i.publicationcode = p.publicationcode
    LEFT JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
    ${whereClause}
  `;

  const mainQuery = `
    WITH MatchedIssues AS (
      SELECT i.issuecode
      FROM inducks_issue i
      JOIN inducks_publication p ON i.publicationcode = p.publicationcode
      LEFT JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    )
    SELECT 
      i.issuecode, 
      i.issuenumber, 
      i.title as issue_title, 
      i.pages, 
      i.price, 
      i.attached, 
      i.size, 
      i.oldestdate,
      p.publicationcode, 
      p.countrycode, 
      p.languagecode, 
      pn.publicationname as series_title,
      (SELECT iu.sitecode || '|' || iu.url 
       FROM inducks_issueurl iu 
       WHERE iu.issuecode = i.issuecode 
       ORDER BY CASE WHEN iu.sitecode = 'webusers' THEN 0 ELSE 1 END LIMIT 1) as issue_thumb,
      (SELECT pub.publishername 
       FROM inducks_publishingjob pj 
       JOIN inducks_publisher pub ON pj.publisherid = pub.publisherid 
       WHERE pj.issuecode = i.issuecode LIMIT 1) as publishername
    FROM MatchedIssues mi
    JOIN inducks_issue i ON mi.issuecode = i.issuecode
    JOIN inducks_publication p ON i.publicationcode = p.publicationcode
    LEFT JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
    ORDER BY ${orderBy}
  `;

  const result = {
    query: mainQuery,
    countQuery,
    params: [...p, pageSize, offset],
    countParams: p,
    pageSize,
    page,
  };
  assertParamCount(result, "buildPublicationsSearchQuery");
  return result;
}
