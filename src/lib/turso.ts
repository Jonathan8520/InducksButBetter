import { createClient } from "@libsql/client/web";

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
  const result = await tursoClient.execute({
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
  const result = await tursoClient.execute({
    sql: `
      SELECT personcode, fullname, nationalitycountrycode, fullname as displayname 
      FROM inducks_person 
      WHERE fullname LIKE ? OR personcode LIKE ? 
      ORDER BY numberofindexedissues DESC 
      LIMIT 10
    `,
    args: [`%${q}%`, `%${q}%`]
  });
  return result.rows;
}

export async function autocompleteStorycode(q: string, lang: string = 'fr') {
  if (!q || q.trim().length < 2) return [];
  const result = await tursoClient.execute({
    sql: `
      WITH MatchedStories AS (
        SELECT storycode, storyheadercode
        FROM inducks_story
        WHERE storycode LIKE ?
        ORDER BY storycode ASC
        LIMIT 15
      )
      SELECT DISTINCT
        s.storycode as storycode,
        s.storycode as id,
        COALESCE((
          SELECT e.title
          FROM inducks_entry e
          JOIN inducks_issue i ON e.issuecode = i.issuecode
          JOIN inducks_storyversion sv_t ON e.storyversioncode = sv_t.storyversioncode
          JOIN inducks_publication pub ON i.publicationcode = pub.publicationcode
          WHERE sv_t.storycode = s.storycode
            AND e.title IS NOT NULL AND e.title != ''
          ORDER BY CASE WHEN pub.languagecode = ? THEN 0 ELSE 1 END, e.entrycode
          LIMIT 1
        ), sh.title, 'Sans titre') as storyname
      FROM MatchedStories s
      JOIN inducks_storyheader sh ON s.storyheadercode = sh.storyheadercode
      ORDER BY s.storycode ASC
    `,
    args: [`${q.trim()}%`, lang]
  });
  return result.rows;
}

export async function autocompletePublisher(q: string) {
  const like = `%${q}%`;
  const result = await tursoClient.execute({
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
