import { searchInMycase } from "../lib/us-records/in-mycase";
import { searchWiCcap } from "../lib/us-records/wi-ccap";
import { parseUsRecordsQuery } from "../lib/us-records/query-parse";

async function main() {
  const inQ = parseUsRecordsQuery("James Williams, IN");
  const wiQ = parseUsRecordsQuery("John Smith, WI");

  console.log("IN…");
  const inHits = await searchInMycase(inQ, 5);
  console.log(
    "IN",
    inHits.length,
    inHits.map((h) => `${h.docketNumber} | ${h.caseName}`).slice(0, 5),
  );

  console.log("WI…");
  const wiHits = await searchWiCcap(wiQ, 5);
  console.log(
    "WI",
    wiHits.length,
    wiHits.map((h) => `${h.docketNumber} | ${h.caseName}`).slice(0, 5),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
