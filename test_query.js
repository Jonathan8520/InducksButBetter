import { createClient } from "@libsql/client";

const client = createClient({
  url: "libsql://inducks-full-wizyx.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicm8iLCJpYXQiOjE3ODQ0MDMyNTksImlkIjoiMDE5Zjc2YjUtNzIwMS03YzYwLWI3ZmMtNzMwMGNiNDBkYzhlIiwia2lkIjoiWlAwSl9YbEFNbDFqZlk5S0JJRlVSby05ZFN3SUM3UGpLT3p2YTFFcnd1MCIsInJpZCI6IjU2NzBmMjQ5LTU4NWYtNDMxMC1hMWQ1LTY5YzdlYzMyY2M0MyJ9.y860hAHoj9ex3oXS6q3ORTt2HLmS_eQyrkrUrsFgghaRNf1SreFHiPynRTq_rBNmJHv4opOmdMdxOWYjx0eQBA"
});

async function main() {
  console.log("Running query...");
  const start = Date.now();
  try {
    const rs = await client.execute("SELECT s.storycode, s.firstpublicationdate FROM inducks_story s WHERE s.storycode LIKE 'F %DBG%' ORDER BY s.firstpublicationdate DESC, s.storycode ASC LIMIT 24 OFFSET 0");
    console.log("Time:", Date.now() - start, "ms");
    console.log(rs.rows);
  } catch (e) {
    console.error(e);
  }
}

main();
