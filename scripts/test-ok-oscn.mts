import { searchOkOscn } from "../lib/us-records/ok-oscn.ts";
import { parseUsRecordsQuery } from "../lib/us-records/query-parse.ts";
import { searchUsCourt } from "../lib/us-records/orchestrator.ts";

const parsed = parseUsRecordsQuery("James Williams, OK");
const hits = await searchOkOscn(parsed, 5);
console.log(
  "OSCN direct",
  hits.length,
  hits.map((h) => ({ docket: h.docketNumber, name: h.caseName })),
);

const court = await searchUsCourt("James Williams, OK");
console.log("orchestrator", {
  cases: court.cases.length,
  sources: court.sources,
  sample: court.cases.slice(0, 2).map((c) => c.docketNumber),
});
