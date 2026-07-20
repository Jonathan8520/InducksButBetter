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

export async function getStoryDetail(storycode: string, lang: string = "fr") {
  // 1. Core story info
  const coreResult = await executeQuery({
    sql: `
      SELECT s.storycode, s.firstpublicationdate, s.storyheadercode, s.storycomment, s.title,
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

  // Get best version/thumb
  const versionResult = await executeQuery({
    sql: `
      SELECT sv.storyversioncode, sv.kind, sv.entirepages, sv.brokenpagenumerator, sv.brokenpagedenominator, sv.plotsummary,
        COALESCE(
          (SELECT eu.sitecode || '|' || eu.url
           FROM inducks_entry e_img
           JOIN inducks_entryurl eu ON e_img.entrycode = eu.entrycode
           WHERE e_img.storyversioncode = sv.storyversioncode
             AND eu.sitecode IN ('webusers', 'thumbnails', 'thumbnails2', 'thumbnails3')
           ORDER BY CASE WHEN eu.sitecode = 'webusers' THEN 0 ELSE 1 END LIMIT 1),
          NULL
        ) as story_thumb
      FROM inducks_storyversion sv
      WHERE sv.storycode = ?
      ORDER BY sv.storyversioncode ASC
      LIMIT 1
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
      SELECT DISTINCT app_c.charactercode, COALESCE(cn.charactername, c.charactername) as charactername, app_c.appearancecomment, COALESCE(cn.characternamecomment, c.charactercomment, '') as charactercomment
      FROM inducks_appearance app_c
      JOIN inducks_character c ON app_c.charactercode = c.charactercode
      LEFT JOIN inducks_charactername cn ON app_c.charactercode = cn.charactercode AND cn.languagecode = ? AND cn.preferred = 'Y'
      WHERE app_c.storyversioncode IN (SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
      ORDER BY app_c.number ASC
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
      SELECT DISTINCT 
        e.entrycode,
        i.issuecode, 
        i.issuenumber, 
        p.publicationcode, 
        p.title as publication_title, 
        p.countrycode, 
        c.countryname,
        e.position,
        e.title as entry_title
      FROM inducks_entry e
      JOIN inducks_issue i ON e.issuecode = i.issuecode
      JOIN inducks_publication p ON i.publicationcode = p.publicationcode
      LEFT JOIN inducks_country c ON p.countrycode = c.countrycode
      WHERE e.storyversioncode IN (SELECT storyversioncode FROM inducks_storyversion WHERE storycode = ?)
      ORDER BY p.countrycode ASC, i.oldestdate ASC, i.issuecode ASC
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
  // 1. Core issue details
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

  if (coreResult.rows.length === 0) return null;
  const issue = coreResult.rows[0];

  // 2. Cover / thumbnail
  const thumbResult = await executeQuery({
    sql: `
      SELECT eu.sitecode || '|' || eu.url as issue_thumb
      FROM inducks_entryurl eu
      WHERE eu.entrycode = (
        SELECT entrycode FROM inducks_entry WHERE issuecode = ? ORDER BY position ASC LIMIT 1
      )
    `,
    args: [issuecode]
  });

  const thumb = thumbResult.rows[0]?.issue_thumb || null;

  // 3. Contained stories (index)
  const storiesResult = await executeQuery({
    sql: `
      SELECT 
        e.entrycode,
        e.position,
        e.entirepages,
        e.title as entry_title,
        s.storycode,
        s.title as original_title,
        (SELECT GROUP_CONCAT(p_w.fullname, ', ') FROM inducks_storyjob sj_w JOIN inducks_person p_w ON sj_w.personcode = p_w.personcode WHERE sj_w.storyversioncode = e.storyversioncode AND sj_w.plotwritartink IN ('w', 'p', 'wa', 'pw')) as writers,
        (SELECT GROUP_CONCAT(p_a.fullname, ', ') FROM inducks_storyjob sj_a JOIN inducks_person p_a ON sj_a.personcode = p_a.personcode WHERE sj_a.storyversioncode = e.storyversioncode AND sj_a.plotwritartink IN ('a', 'i', 'pa', 'wa')) as artists
      FROM inducks_entry e
      LEFT JOIN inducks_storyversion sv ON e.storyversioncode = sv.storyversioncode
      LEFT JOIN inducks_story s ON sv.storycode = s.storycode
      WHERE e.issuecode = ?
      ORDER BY e.position ASC
    `,
    args: [issuecode]
  });

  return {
    ...issue,
    issue_thumb: thumb,
    stories: storiesResult.rows
  };
}

