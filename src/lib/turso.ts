import { createClient } from "@libsql/client/web";
import { ftsSubstring, ftsAvailable, disableFts, TRIGRAM_MIN } from "./fts"
import { normalizeText } from "./normalize"
import { executeQuery } from "./db";

const url = import.meta.env.VITE_TURSO_DATABASE_URL || "libsql://dummy.turso.io";
const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN || "";

if (!import.meta.env.VITE_TURSO_DATABASE_URL) {
  console.warn("VITE_TURSO_DATABASE_URL is not set. Database queries will fail.");
}

export const tursoClient = createClient({
  url,
  authToken,
});

// Use local API instead
// export const tursoClient = {
//   execute: async (query: { sql: string, args?: any[] } | string) => {
//     const sql = typeof query === 'string' ? query : query.sql;
//     const args = typeof query === 'string' ? [] : (query.args || []);
//     const res = await fetch('/api/sql', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ query: sql, args })
//     });
//     if (!res.ok) throw new Error("API error: " + res.statusText);
//     const json = await res.json();
//     if (!json.success) throw new Error(json.error);
//     return { rows: json.rows };
//   }
// };

/**
 * Exécute la variante plein texte, et retombe sur la variante LIKE si les tables FTS5 sont
 * absentes — c'est le cas d'une base construite localement depuis les fichiers ISV, où
 * seule la CI produit l'index plein texte.
 */
async function withFtsFallback<T>(
  fts: (() => Promise<T>) | null,
  like: () => Promise<T>,
): Promise<T> {
  if (fts && ftsAvailable()) {
    try {
      return await fts();
    } catch (err) {
      // Une table FTS manquante est définitif pour la session : inutile de repayer
      // l'échec à chaque frappe.
      if (String(err).includes("no such table")) disableFts();
      else throw err;
    }
  }
  return like();
}

export async function autocompleteCharacter(q: string, lang: string = 'fr') {
  if (!q || q.length < 2) return [];
  const match = ftsSubstring(q);

  // `imageUrl` reste exposée pour ne pas changer la forme attendue par les composants,
  // mais la sous-requête sur inducks_characterurl a disparu : cette table est vide dans le
  // dump Inducks (28 octets, l'en-tête seul), l'expression valait donc toujours NULL.
  return withFtsFallback(
    match ? async () => (await executeQuery({
      sql: `
        SELECT c.charactercode,
               COALESCE(MAX(cn.charactername), c.charactername) as charactername,
               NULL as imageUrl
        FROM fts_character f
        JOIN inducks_character c ON c.charactercode = f.charactercode
        LEFT JOIN inducks_charactername cn
          ON cn.charactercode = c.charactercode AND cn.languagecode = ?
        WHERE fts_character MATCH ?
        GROUP BY c.charactercode
        ORDER BY MAX(COALESCE(cn.preferred, 0)) DESC, c.appearancecount DESC
        LIMIT 10
      `,
      args: [lang, match]
    })).rows : null,
    async () => (await executeQuery({
      sql: `
        SELECT c.charactercode,
               COALESCE(MAX(cn.charactername), c.charactername) as charactername,
               NULL as imageUrl
        FROM inducks_character c
        LEFT JOIN inducks_charactername cn
          ON cn.charactercode = c.charactercode AND cn.languagecode = ?
        WHERE c.charactername LIKE ? OR c.charactercode LIKE ?
        GROUP BY c.charactercode
        ORDER BY MAX(COALESCE(cn.preferred, 0)) DESC, c.charactername ASC
        LIMIT 10
      `,
      args: [lang, `%${q}%`, `%${q}%`]
    })).rows,
  );
}

export async function autocompletePerson(q: string) {
  if (!q || q.length < 2) return [];
  const match = ftsSubstring(q);

  return withFtsFallback(
    match ? async () => (await executeQuery({
      sql: `
        SELECT p.personcode, p.fullname, p.nationalitycountrycode,
               p.fullname as displayname
        FROM fts_person f
        JOIN inducks_person p ON p.personcode = f.personcode
        WHERE fts_person MATCH ?
        ORDER BY p.numberofindexedissues DESC
        LIMIT 10
      `,
      args: [match]
    })).rows : null,
    async () => (await executeQuery({
      sql: `
        SELECT personcode, fullname, nationalitycountrycode, fullname as displayname
        FROM inducks_person
        WHERE fullname LIKE ? OR personcode LIKE ?
        ORDER BY numberofindexedissues DESC
        LIMIT 10
      `,
      args: [`%${q}%`, `%${q}%`]
    })).rows,
  );
}

export async function autocompleteStorycode(q: string, lang: string = 'fr') {
  if (!q || q.trim().length < 2) return [];
  const qUpper = q.trim().toUpperCase();
  const qUpperEnd = qUpper.slice(0, -1) + String.fromCharCode(qUpper.charCodeAt(qUpper.length - 1) + 1);
  const result = await executeQuery({
    sql: `
      WITH MatchedStories AS (
        SELECT storycode, storyheadercode, title as story_title
        FROM inducks_story
        WHERE storycode >= ? AND storycode < ?
        ORDER BY storycode ASC
        LIMIT 15
      )
      SELECT
        s.storycode as storycode,
        s.storycode as id,
        MAX(COALESCE(s.story_title, sh.title, 'Sans titre')) as storyname,
        -- story_thumb est précalculée au build : une ligne par storycode, déjà arbitrée
        -- selon la même priorité (webusers d'abord). Remplace trois jointures et un tri
        -- sur les 2,7 M de lignes d'inducks_entryurl.
        (SELECT st.sitecode || '|' || st.url
         FROM story_thumb st WHERE st.storycode = s.storycode) as story_thumb
      FROM MatchedStories s
      LEFT JOIN inducks_storyheader sh ON s.storyheadercode = sh.storyheadercode
      GROUP BY s.storycode
      ORDER BY s.storycode ASC
    `,
    args: [qUpper, qUpperEnd]
  });
  return result.rows;
}

export async function autocompletePublisher(q: string) {
  const like = `%${q}%`;
  const result = await executeQuery({
    sql: `
      SELECT publisherid, publishername
      FROM (
        SELECT publisherid, publishername
        FROM inducks_publisher
        WHERE publishername LIKE ? OR publisherid LIKE ?

        UNION

        SELECT DISTINCT publisherid, publisherid as publishername
        FROM inducks_publishingjob
        WHERE publisherid LIKE ?
      )
      ORDER BY publishername
      LIMIT 10
    `,
    args: [like, like, like]
  });
  return result.rows;
}

export async function autocompletePublicationTitle(q: string) {
  const term = normalizeText(q);
  if (!term) return [];

  // Voie rapide : FTS5 trigram sur la colonne normalisée. La variante LIKE '%...%'
  // imposait un parcours d'index, mesuré à 292 requêtes HTTP par frappe — l'essentiel de
  // la lenteur ressentie sur ce formulaire. Le trigram exige au moins 3 caractères.
  const rows = await withFtsFallback(
    term.length >= TRIGRAM_MIN
      ? async () => (await executeQuery({
          sql: `
            SELECT p.publicationcode as value,
                   COALESCE(pn.publicationname, p.title, p.publicationcode)
                     || ' (' || p.publicationcode || ')' as label,
                   COALESCE(pn.publicationname, p.title, p.publicationcode) as sortkey
            FROM fts_publication f
            JOIN inducks_publication p ON p.publicationcode = f.publicationcode
            LEFT JOIN inducks_publicationname pn ON pn.publicationcode = p.publicationcode
            WHERE fts_publication MATCH ?
            ORDER BY sortkey
            LIMIT 10
          `,
          args: [ftsSubstring(term)]
        })).rows
      : null,
    // Repli : base locale sans tables FTS, ou terme trop court pour le trigram.
    // inducks_publicationname ne couvre que 148 des 7 281 publications, d'où le LEFT JOIN
    // et la recherche sur p.title, absente de la version d'origine.
    async () => (await executeQuery({
      sql: `
        SELECT DISTINCT p.publicationcode as value,
               COALESCE(pn.publicationname, p.title, p.publicationcode)
                 || ' (' || p.publicationcode || ')' as label,
               COALESCE(pn.publicationname, p.title, p.publicationcode) as sortkey
        FROM inducks_publication p
        LEFT JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
        WHERE p.title_norm LIKE ? OR p.publicationcode LIKE ?
        ORDER BY sortkey
        LIMIT 10
      `,
      args: [`%${term}%`, `%${term}%`]
    })).rows,
  );

  return rows.map((r: any) => ({
    publicationcode: r.value,
    publicationname: r.label
  }));
}

export async function getStoryDetail(storycode: string, lang: string = "fr") {
  // 1. Core story info
  const coreResult = await executeQuery({
    sql: `
      SELECT s.storycode, s.firstpublicationdate, s.storyheadercode, s.storycomment,
        s.title, s.title as story_title,
        COALESCE(
          (SELECT sn.subseriesname FROM inducks_storysubseries ss JOIN inducks_subseriesname sn ON ss.subseriescode = sn.subseriescode WHERE ss.storycode = s.storycode ORDER BY CASE WHEN sn.languagecode = ? THEN 0 ELSE 1 END, sn.preferred DESC LIMIT 1),
          (SELECT sh.title FROM inducks_storyheader sh WHERE sh.storyheadercode = s.storyheadercode LIMIT 1)
        ) as series_title
      FROM inducks_story s
      WHERE s.storycode = ?
    `,
    args: [lang, storycode]
  });

  if (coreResult.rows.length === 0) return null;
  const story = coreResult.rows[0];

  // Version de référence : lue dans story_card, qui a figé au build la version choisie
  // (MIN storyversioncode) avec tout ce dont la fiche a besoin. La forme précédente,
  // `ORDER BY storyversioncode LIMIT 1` sur inducks_storyversion, imposait un tri
  // temporaire faute d'index dans ce sens — mesuré à 86 requêtes HTTP par fiche.
  const versionResult = await executeQuery({
    sql: `
      SELECT storyversioncode, kind, entirepages, brokenpagenumerator, brokenpagedenominator,
             plotsummary, story_thumb
      FROM story_card WHERE storycode = ?
    `,
    args: [storycode]
  });

  const version = versionResult.rows[0] || {};

  // 2. Creators list
  const creatorsResult = await executeQuery({
    sql: `
      SELECT DISTINCT sj.plotwritartink as role, p.personcode, p.fullname
      FROM inducks_storyjob sj
      JOIN inducks_person p ON sj.personcode = p.personcode
      WHERE sj.storyversioncode IN (SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
    `,
    args: [storycode]
  });

  // 3. Characters list
  const charactersResult = await executeQuery({
    sql: `
      -- story_characters est groupée par storycode et embarque déjà le nom par défaut :
      -- il ne reste que la jointure de traduction, sur une table minuscule.
      SELECT sc.charactercode,
             COALESCE(cn.charactername, sc.charactername) as charactername,
             sc.appearancecomment,
             COALESCE(cn.characternamecomment, sc.charactercomment, '') as charactercomment
      FROM story_characters sc
      LEFT JOIN inducks_charactername cn
        ON cn.charactercode = sc.charactercode AND cn.languagecode = ? AND cn.preferred = 'Y'
      WHERE sc.storycode = ?
      ORDER BY sc.number ASC
    `,
    args: [lang, storycode]
  });

  // 4. Descriptions in all languages
  const descriptionsResult = await executeQuery({
    sql: `
      SELECT sd.languagecode, sd.desctext
      FROM inducks_storydescription sd
      WHERE sd.storyversioncode IN (SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
    `,
    args: [storycode]
  });

  // 5. Publications list
  const publicationsResult = await executeQuery({
    sql: `
      -- story_publications est précalculée et physiquement groupée par storycode : les
      -- parutions d'une histoire tiennent sur quelques pages contiguës. La forme
      -- précédente (entry -> issue -> publication à la volée) dispersait les lectures sur
      -- des centaines de pages — mesuré à 448 pages et 358 requêtes HTTP pour une seule
      -- fiche, contre 9 et 9 avec cette table.
      SELECT
        sp.entrycode,
        sp.issuecode,
        sp.issuenumber,
        sp.publicationcode,
        p.title as publication_title,
        sp.countrycode,
        c.countryname,
        sp.position,
        sp.entry_title
      FROM story_publications sp
      LEFT JOIN inducks_publication p ON sp.publicationcode = p.publicationcode
      LEFT JOIN inducks_country c ON sp.countrycode = c.countrycode
      WHERE sp.storycode = ?
      ORDER BY sp.countrycode ASC, sp.oldestdate ASC, sp.issuecode ASC
    `,
    args: [storycode]
  });

  return {
    ...story,
    ...version,
    creators: creatorsResult.rows,
    characters: charactersResult.rows,
    descriptions: descriptionsResult.rows,
    publications: publicationsResult.rows
  };
}

export async function getIssueDetail(issuecode: string) {
  let issue = null;
  try {
    const coreResult = await executeQuery({
      sql: `
        SELECT 
          i.issuecode,
          i.issuenumber,
          i.oldestdate,
          i.pages,
          i.price,
          i.size,
          i.attached,
          p.title as publication_title,
          p.countrycode,
          c.countryname
        FROM inducks_issue i
        JOIN inducks_publication p ON i.publicationcode = p.publicationcode
        LEFT JOIN inducks_country c ON p.countrycode = c.countrycode
        WHERE i.issuecode = ?
      `,
      args: [issuecode]
    });
    if (coreResult.rows.length > 0) issue = coreResult.rows[0];
  } catch (e) {
    console.warn("Could not fetch issue with publication join, trying fallback", e);
  }

  if (!issue) {
    const fallbackResult = await executeQuery({
      sql: `
        SELECT 
          i.issuecode,
          i.issuenumber,
          i.oldestdate,
          i.pages,
          i.price,
          i.size,
          i.attached,
          i.publicationcode as publication_title,
          i.publicationcode as countrycode,
          i.publicationcode as countryname
        FROM inducks_issue i
        WHERE i.issuecode = ?
      `,
      args: [issuecode]
    });
    if (fallbackResult.rows.length === 0) return null;
    issue = fallbackResult.rows[0] as any;
    const parts = (issue.countrycode as string || "").split('/');
    if (parts.length > 0) {
      issue.countrycode = parts[0];
      issue.countryname = parts[0].toUpperCase();
    }
  }

  // 2. Cover / thumbnail
  const thumbResult = await executeQuery({
    sql: `
      -- issue_thumb : une ligne par numéro, la couverture, arbitrée au build.
      SELECT it.sitecode || '|' || it.url as issue_thumb
      FROM issue_thumb it WHERE it.issuecode = ?
    `,
    args: [issuecode]
  });

  const thumb = thumbResult.rows[0]?.issue_thumb || null;

  // 3. Contained stories (index)
  // Tout est pré-assemblé dans issue_stories, groupée par (issuecode, position) : le
  // sommaire d'un numéro est une lecture contiguë. La forme précédente joignait chaque
  // entrée à storyversion et story, plus deux GROUP_CONCAT corrélés pour les crédits —
  // mesuré à 78 requêtes HTTP sur un gros numéro.
  const storiesResult = await executeQuery({
    sql: `
      SELECT entrycode, position, entirepages, entry_title,
             storycode, story_title as original_title, writers, artists
      FROM issue_stories
      WHERE issuecode = ?
      ORDER BY position ASC
    `,
    args: [issuecode]
  });

  return {
    ...issue,
    issue_thumb: thumb,
    stories: storiesResult.rows
  };
}

