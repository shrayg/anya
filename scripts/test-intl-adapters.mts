import { parseUsRecordsQuery } from "../lib/us-records/query-parse";
import {
  searchCaSanctions,
  searchEuSanctions,
  searchUkSanctions,
} from "../lib/us-records/intl-sanctions";
import {
  searchAuDfat,
  searchChSeco,
} from "../lib/us-records/intl-sanctions-bulk";
import {
  searchEuMostWanted,
  searchWorldBankDebarred,
} from "../lib/us-records/intl-wanted-debarment";
import { searchNoBrreg } from "../lib/us-records/no-brreg";
import { searchSecEdgar } from "../lib/us-records/sec-edgar";
import { searchTxTdcj } from "../lib/us-records/tx-tdcj";

async function run(
  label: string,
  work: () => Promise<Array<{ name: string; subtitle?: string }>>,
) {
  try {
    const hits = await work();
    console.log(
      label,
      hits.length,
      hits.slice(0, 3).map((h) => `${h.name}${h.subtitle ? ` | ${h.subtitle}` : ""}`),
    );
  } catch (err) {
    console.log(label, "ERR", err instanceof Error ? err.message : err);
  }
}

async function main() {
  const putin = parseUsRecordsQuery("Vladimir Putin");
  const haq = parseUsRecordsQuery("Mian Abdul Haq");
  const equinor = parseUsRecordsQuery("Equinor, NO");
  const apple = parseUsRecordsQuery("Apple Inc");
  const tymo = parseUsRecordsQuery("Tymoshchuk");
  const garcia = parseUsRecordsQuery("Jose Garcia, TX");

  await run("EU", () => searchEuSanctions(putin, 3));
  await run("UK", () => searchUkSanctions(haq, 3));
  await run("CA", () => searchCaSanctions(putin, 3));
  await run("AU", () => searchAuDfat(putin, 3));
  await run("SECO", () => searchChSeco(putin, 3));
  await run("WB", () =>
    searchWorldBankDebarred(parseUsRecordsQuery("Construction"), 3),
  );
  await run("Brreg", () => searchNoBrreg(equinor, 3));
  await run("EDGAR", () => searchSecEdgar(apple, 3));
  await run("ENFAST", () => searchEuMostWanted(tymo, 5));
  await run("TDCJ", () => searchTxTdcj(garcia, 3));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
