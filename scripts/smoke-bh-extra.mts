import { readFileSync } from "node:fs";
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const t = line.trim(); if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("="); if (i < 0) continue;
      const k = t.slice(0, i).trim(); let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}
const key = process.env.BREACHHUB_API_KEY!;
for (const path of ["/api/snusbase/combo-lookup?query=test@example.com", "/api/datavoid/recovery?query=test@example.com", "/api/leakcheck/email?query=test@example.com"]) {
  const url = "https://breachhub.org" + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    console.log((res.ok?"OK  ":"FAIL") + " " + path.split("?")[0] + " " + res.status + " " + (Date.now()-t0) + "ms " + text.slice(0,160).replace(/\s+/g," "));
  } catch (e) { console.log("FAIL " + path + " " + (e as Error).message); }
}
