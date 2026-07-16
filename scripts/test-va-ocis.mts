import { parseUsRecordsQuery } from "../lib/us-records/query-parse.ts";
import { searchVaOcis } from "../lib/us-records/va-ocis.ts";

const q = process.argv[2] || "Shray Gupta, VA";
const parsed = parseUsRecordsQuery(q);
console.log("query:", q);
console.log("parsed:", parsed);

const hits = await searchVaOcis(parsed, 10);
console.log(`hits=${hits.length}`);
for (const hit of hits) {
  console.log("-", hit.docketNumber, "|", hit.caseName, "|", hit.court);
}
