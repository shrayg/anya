import {
  searchCaRcmpSor,
  searchIrsEoNonprofit,
  searchKaneIlProperty,
  searchNationalSor,
  searchNysDos,
  parseUsRecordsQuery,
} from "@/lib/us-records";
import { searchNsopw } from "@/lib/us-records/nsopw";

async function main() {
  const ca = await searchNationalSor("Keith Constantin, Canada");
  console.log("CA national", {
    sources: ca.sources,
    errors: ca.errors,
    people: ca.people.map((p) => p.name),
  });

  const us = await searchNationalSor("John Smith, VA");
  console.log("US national", {
    sources: us.sources,
    errors: us.errors,
    count: us.count,
    sample: us.people.slice(0, 3).map((p) => `${p.name} [${p.source.label}]`),
  });

  const open = await searchNsopw(parseUsRecordsQuery("John Smith"), 5);
  console.log(
    "NSOPW no-state",
    open.length,
    open.map((p) => `${p.name}/${p.state}`),
  );

  console.log(
    "nys",
    (await searchNysDos(parseUsRecordsQuery("Smith LLC, NY"), 2)).map(
      (r) => r.name,
    ),
  );
  console.log(
    "eo",
    (await searchIrsEoNonprofit(parseUsRecordsQuery("Habitat, VA"), 2)).map(
      (r) => r.name,
    ),
  );
  console.log(
    "kane",
    (
      await searchKaneIlProperty(
        parseUsRecordsQuery("Johnson, Kane County, IL"),
        2,
      )
    ).map((r) => r.name),
  );
  console.log(
    "rcmp cue",
    (await searchCaRcmpSor(parseUsRecordsQuery("Watts, Canada"), 2)).map(
      (r) => r.name,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
