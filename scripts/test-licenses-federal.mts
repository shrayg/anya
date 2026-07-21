import {
  searchCalBarLicense,
  searchDeaFugitives,
  searchFaaAircraft,
  searchFccUls,
  searchTxTdlrLicense,
  searchUsptoPtab,
  searchWaDohLicense,
  parseUsRecordsQuery,
} from "@/lib/us-records";

async function main() {
  const wa = await searchWaDohLicense(parseUsRecordsQuery("John Smith, WA"), 3);
  console.log(
    "wa",
    wa.map((r) => `${r.name} | ${r.subtitle}`),
  );

  const cal = await searchCalBarLicense(
    parseUsRecordsQuery("John Smith, CA"),
    3,
  );
  console.log(
    "calbar",
    cal.map((r) => `${r.name} | ${r.subtitle}`),
  );

  try {
    const tdlr = await searchTxTdlrLicense(
      parseUsRecordsQuery("Smith, TX"),
      3,
    );
    console.log(
      "tdlr",
      tdlr.map((r) => `${r.name} | ${r.subtitle}`),
    );
  } catch (err) {
    console.log("tdlr err", (err as Error).message);
  }

  const dea = await searchDeaFugitives(parseUsRecordsQuery("Guzman"), 5);
  console.log(
    "dea",
    dea.map((r) => r.name),
  );

  try {
    const faa = await searchFaaAircraft(
      parseUsRecordsQuery("Smith FAA aircraft"),
      2,
    );
    console.log("faa", faa.length, faa.map((r) => r.name));
  } catch (err) {
    console.log("faa err", (err as Error).message);
  }

  try {
    const fcc = await searchFccUls(parseUsRecordsQuery("Smith FCC ULS"), 2);
    console.log("fcc", fcc.map((r) => r.name));
  } catch (err) {
    console.log("fcc err", (err as Error).message);
  }

  try {
    const ptab = await searchUsptoPtab(
      parseUsRecordsQuery("Samsung USPTO patent"),
      2,
    );
    console.log("ptab", ptab.map((r) => r.name));
  } catch (err) {
    console.log("ptab err", (err as Error).message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
