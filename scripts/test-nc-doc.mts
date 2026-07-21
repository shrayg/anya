import { searchNcDocInmate, parseUsRecordsQuery } from "@/lib/us-records";

try {
  const hits = await searchNcDocInmate(
    parseUsRecordsQuery("John Smith, NC"),
    5,
  );
  console.log(
    "nc",
    hits.length,
    hits.map((h) => `${h.name} | ${h.subtitle}`),
  );
} catch (err) {
  console.log("nc err", (err as Error).message);
}
