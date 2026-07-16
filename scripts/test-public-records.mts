import { parseUsRecordsQuery } from "../lib/us-records/query-parse.ts";
import { searchFbiWanted } from "../lib/us-records/fbi-wanted.ts";
import { searchInterpolRedNotices } from "../lib/us-records/interpol.ts";
import { searchStateRecordsDirectory } from "../lib/us-records/orchestrator.ts";
import { searchUnSanctions } from "../lib/us-records/un-sanctions.ts";

const name = process.argv[2] || "Smith";
const parsed = parseUsRecordsQuery(name);
console.log("parsed", parsed);

for (const [label, fn] of [
  ["fbi", () => searchFbiWanted(parsed, 3)],
  ["interpol", () => searchInterpolRedNotices(parsed, 3)],
  ["un", () => searchUnSanctions(parsed, 3)],
] as const) {
  try {
    const hits = await fn();
    console.log(label, hits.length, hits[0]?.name || "(none)");
  } catch (e) {
    console.log(label, "ERR", e instanceof Error ? e.message : e);
  }
}

const dir = await searchStateRecordsDirectory(name);
console.log("state portals", dir.count, dir.portals[0]?.title);
