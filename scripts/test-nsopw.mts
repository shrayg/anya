import { parseUsRecordsQuery } from "../lib/us-records/query-parse";
import { searchNsopw } from "../lib/us-records/nsopw";
import { searchNationalSor } from "../lib/us-records/orchestrator";

const q = parseUsRecordsQuery("John Smith, VA");
console.log("parsed", q);
const hits = await searchNsopw(q, 5);
console.log(
  "NSOPW",
  hits.length,
  hits.map((h) => `${h.name} | ${h.subtitle} | ${h.source.deepLink?.slice(0, 60)}`),
);

const national = await searchNationalSor("John Smith, VA");
console.log(
  "national",
  national.count,
  national.sources,
  national.errors,
  national.people.slice(0, 3).map((p) => `${p.name} [${p.source.label}]`),
);
