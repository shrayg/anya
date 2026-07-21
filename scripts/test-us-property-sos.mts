import { parseUsRecordsQuery } from "../lib/us-records/query-parse";
import { searchFlSunbiz } from "../lib/us-records/fl-sunbiz";
import {
  searchNycAcris,
  searchNycPluto,
  searchPhillyOpa,
} from "../lib/us-records/us-property-open";

async function run(label: string, work: () => Promise<Array<{ name: string; subtitle?: string }>>) {
  try {
    const hits = await work();
    console.log(label, hits.length, hits.slice(0, 3).map((h) => `${h.name} | ${h.subtitle || ""}`));
  } catch (e) {
    console.log(label, "ERR", e instanceof Error ? e.message : e);
  }
}

const apple = parseUsRecordsQuery("Apple Inc, FL");
const smithNy = parseUsRecordsQuery("Smith, NY");
const smithPa = parseUsRecordsQuery("Smith, PA");

await run("Sunbiz", () => searchFlSunbiz(apple, 5));
await run("PLUTO", () => searchNycPluto(smithNy, 3));
await run("ACRIS", () => searchNycAcris(smithNy, 3));
await run("Philly", () => searchPhillyOpa(smithPa, 3));
