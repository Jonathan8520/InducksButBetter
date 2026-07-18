import { createClient } from "@libsql/client";
import { buildAdvancedSearchQuery } from "./src/lib/searchService.js";

const client = createClient({
  url: "libsql://inducks-full-wizyx.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicm8iLCJpYXQiOjE3ODQ0MDMyNTksImlkIjoiMDE5Zjc2YjUtNzIwMS03YzYwLWI3ZmMtNzMwMGNiNDBkYzhlIiwia2lkIjoiWlAwSl9YbEFNbDFqZlk5S0JJRlVSby05ZFN3SUM3UGpLT3p2YTFFcnd1MCIsInJpZCI6IjU2NzBmMjQ5LTU4NWYtNDMxMC1hMWQ1LTY5YzdlYzMyY2M0MyJ9.y860hAHoj9ex3oXS6q3ORTt2HLmS_eQyrkrUrsFgghaRNf1SreFHiPynRTq_rBNmJHv4opOmdMdxOWYjx0eQBA"
});

async function main() {
  const q = buildAdvancedSearchQuery({ storycode: "F DBG" });
  console.log("Running COUNT query...");
  const startCount = Date.now();
  try {
    const rsCount = await client.execute({ sql: q.countQuery, args: q.countParams });
    console.log("Count time:", Date.now() - startCount, "ms");
  } catch (e) {
    console.error(e);
  }

  console.log("Running MAIN query...");
  const startMain = Date.now();
  try {
    const rsMain = await client.execute({ sql: q.query, args: q.params });
    console.log("Main time:", Date.now() - startMain, "ms");
    console.log("Rows:", rsMain.rows.length);
  } catch (e) {
    console.error(e);
  }
}

main();
