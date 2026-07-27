import { readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

const key = process.env.BREACHHUB_API_KEY!;
const res = await fetch(
  `https://breachhub.org/api/ipinfo?key=${encodeURIComponent(key)}&ip=8.8.8.8`,
  { signal: AbortSignal.timeout(15_000) },
);
const j = await res.json();
console.log(JSON.stringify(j, null, 2).slice(0, 2000));
