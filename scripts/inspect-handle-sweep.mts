import { readFileSync } from "node:fs";

const d = JSON.parse(readFileSync("data/handle-sweep.json", "utf8")) as Record<
  string,
  Record<string, unknown>
>;

const by: Record<string, number> = {};
let sampleRu: unknown;
let sampleMsg: unknown;

for (const [k, v] of Object.entries(d)) {
  if (!v || typeof v !== "object") continue;
  if (!("url" in v) && !("urlMain" in v)) continue;
  const t = String(v.errorType ?? "?");
  by[t] = (by[t] ?? 0) + 1;
  if (t === "response_url" && !sampleRu) sampleRu = { k, v };
  if (t === "message" && !sampleMsg) sampleMsg = { k, v };
}

console.log(by);
console.log("ru", JSON.stringify(sampleRu, null, 2).slice(0, 900));
console.log("msg", JSON.stringify(sampleMsg, null, 2).slice(0, 900));
