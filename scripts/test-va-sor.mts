import { fetchWithTimeout } from "../lib/fetch-with-timeout.ts";
import { parseUsRecordsQuery } from "../lib/us-records/query-parse.ts";
import { searchVaSexOffenderRegistry } from "../lib/us-records/va-sor.ts";

async function main() {
  const q = process.argv[2] || "John Smith, Fairfax County, VA";
  console.log("query:", q);
  const parsed = parseUsRecordsQuery(q);
  console.log("parsed:", parsed);

  const t0 = Date.now();
  const hits = await searchVaSexOffenderRegistry(parsed, 5);
  console.log(`ok in ${Date.now() - t0}ms, hits=${hits.length}`);
  for (const hit of hits.slice(0, 3)) {
    console.log("-", hit.name, "|", hit.subtitle, "|", hit.source.deepLink);
  }
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
