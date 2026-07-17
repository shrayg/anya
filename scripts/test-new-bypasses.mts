import { searchDallasWanted } from "../lib/us-records/dallas-wanted.ts";
import { searchFlHover } from "../lib/us-records/fl-hover.ts";
import { searchOkOscn } from "../lib/us-records/ok-oscn.ts";
import {
  searchUsCourt,
  searchWantedPersons,
} from "../lib/us-records/orchestrator.ts";
import { parseUsRecordsQuery } from "../lib/us-records/query-parse.ts";

const dallas = await searchDallasWanted(parseUsRecordsQuery("John Smith, TX"), 5);
console.log(
  "dallas",
  dallas.length,
  dallas.slice(0, 2).map((h) => ({ name: h.name, sub: h.subtitle })),
);

const oscn = await searchOkOscn(parseUsRecordsQuery("James Williams, OK"), 3);
console.log(
  "oscn",
  oscn.length,
  oscn.map((h) => h.docketNumber),
);

try {
  const hover = await searchFlHover(parseUsRecordsQuery("John Smith, FL"), 3);
  console.log("hover", hover.length, hover[0]?.caseName);
} catch (e) {
  console.log("hover ERR", e instanceof Error ? e.message : e);
}

const wanted = await searchWantedPersons("John Smith, TX");
console.log("wanted module", {
  count: wanted.count,
  dallas: wanted.people.filter((p) => p.source.id === "dallas-wanted").length,
  sources: wanted.sources,
});

const court = await searchUsCourt("James Williams, OK");
console.log("court ok", court.cases.length, court.sources);
