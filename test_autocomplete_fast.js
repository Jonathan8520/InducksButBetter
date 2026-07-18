import { createClient } from "@libsql/client";

const client = createClient({
  url: "libsql://inducks-full-wizyx.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicm8iLCJpYXQiOjE3ODQ0MDMyNTksImlkIjoiMDE5Zjc2YjUtNzIwMS03YzYwLWI3ZmMtNzMwMGNiNDBkYzhlIiwia2lkIjoiWlAwSl9YbEFNbDFqZlk5S0JJRlVSby05ZFN3SUM3UGpLT3p2YTFFcnd1MCIsInJpZCI6IjU2NzBmMjQ5LTU4NWYtNDMxMC1hMWQ1LTY5YzdlYzMyY2M0MyJ9.y860hAHoj9ex3oXS6q3ORTt2HLmS_eQyrkrUrsFgghaRNf1SreFHiPynRTq_rBNmJHv4opOmdMdxOWYjx0eQBA"
});

async function main() {
  const q = "F DBG";
  const start = Date.now();
  try {
    const result = await client.execute({
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
          COALESCE(sh.title, 'Sans titre') as storyname
        FROM MatchedStories s
        JOIN inducks_storyheader sh ON s.storyheadercode = sh.storyheadercode
        ORDER BY s.storycode ASC
      `,
      args: [`${q}%`]
    });
    console.log("Time:", Date.now() - start, "ms");
    console.log(result.rows);
  } catch (e) {
    console.error(e);
  }
}
main();
