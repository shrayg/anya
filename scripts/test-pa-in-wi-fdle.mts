import { searchInMycase } from "../lib/us-records/in-mycase";
import { searchWiCcap } from "../lib/us-records/wi-ccap";
import { searchPaUjs } from "../lib/us-records/pa-ujs";
import { searchFlFdle } from "../lib/us-records/fl-fdle";
import { parseUsRecordsQuery } from "../lib/us-records/query-parse";

async function main() {
  const tests = [
    {
      label: "IN",
      run: () => searchInMycase(parseUsRecordsQuery("James Williams, IN"), 3),
    },
    {
      label: "WI",
      run: () => searchWiCcap(parseUsRecordsQuery("John Smith, WI"), 3),
    },
    {
      label: "PA",
      run: () =>
        searchPaUjs(
          parseUsRecordsQuery("John Smith, Philadelphia, PA"),
          3,
        ),
    },
    {
      label: "FDLE",
      run: () => searchFlFdle(parseUsRecordsQuery("Robert Smith, FL"), 3),
    },
  ] as const;

  for (const t of tests) {
    try {
      const hits = await t.run();
      console.log(
        t.label,
        hits.length,
        hits
          .slice(0, 3)
          .map((h) =>
            "caseName" in h
              ? `${(h as { docketNumber?: string }).docketNumber} | ${(h as { caseName: string }).caseName}`
              : `${(h as { name: string }).name}`,
          ),
      );
    } catch (err) {
      console.log(t.label, "ERR", err instanceof Error ? err.message : err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
