import { createClient } from "@libsql/client/web";
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

// Polyfill for autocomplete queries
export async function autocompleteCharacter(q: string, lang: string = 'fr') {
  if (!q || q.length < 2) return [];
  const result = await executeQuery({
    sql: `
      SELECT c.charactercode, COALESCE(cn.charactername, c.charactername) as charactername,
              (SELECT cu.sitecode || '|' || cu.url 
              FROM inducks_characterurl cu 
              WHERE cu.charactercode = c.charactercode 
              ORDER BY CASE WHEN cu.sitecode = 'webusers' THEN 0 ELSE 1 END 
              LIMIT 1) as imageUrl
      FROM inducks_character c
      LEFT JOIN inducks_charactername cn ON c.charactercode = cn.charactercode AND cn.languagecode = ?
      WHERE (COALESCE(cn.charactername, c.charactername) LIKE ? OR c.charactercode LIKE ?)
      GROUP BY c.charactercode
      ORDER BY MAX(COALESCE(cn.preferred, 0)) DESC, charactername ASC
      LIMIT 10
    `,
    args: [lang, `%${q}%`, `%${q}%`]
  });
  return result.rows;
}

export async function autocompletePerson(q: string) {
  if (!q || q.length < 2) return [];
  const result = await executeQuery({
    sql: `
      SELECT personcode, fullname, nationalitycountrycode, fullname as displayname 
      FROM inducks_person 
      WHERE fullname LIKE ? OR personcode LIKE ? 
      GROUP BY personcode
      ORDER BY MAX(numberofindexedissues) DESC 
      LIMIT 10
    `,
    args: [`%${q}%`, `%${q}%`]
  });
  return result.rows;
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
        (SELECT eu.sitecode || '|' || eu.url
         FROM inducks_storyversion sv_img
         JOIN inducks_entry e_img ON sv_img.storyversioncode = e_img.storyversioncode
         JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
         WHERE sv_img.storycode = s.storycode
           AND eu.sitecode IN ('webusers', 'thumbnails', 'thumbnails2', 'thumbnails3')
         ORDER BY CASE WHEN eu.sitecode = 'webusers' THEN 0 ELSE 1 END LIMIT 1) as story_thumb
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
  const like = `%${q}%`;
  const result = await executeQuery({
    sql: `
      SELECT DISTINCT p.publicationcode as value, pn.publicationname || ' (' || p.publicationcode || ')' as label
      FROM inducks_publication p
      JOIN inducks_publicationname pn ON p.publicationcode = pn.publicationcode
      WHERE pn.publicationname LIKE ? OR p.publicationcode LIKE ?
      ORDER BY pn.publicationname
      LIMIT 10
    `,
    args: [like, like]
  });
  return result.rows.map((r: any) => ({
    publicationcode: r.value,
    publicationname: r.label
  }));
}
