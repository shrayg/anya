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
const base = (process.env.BREACHHUB_BASE_URL || "https://breachhub.org").replace(
  /\/$/,
  "",
);

async function check(path: string, qs = "") {
  const url =
    `${base}${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}` +
    (qs ? `&${qs}` : "");
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    const text = await res.text();
    console.log(
      `${res.ok ? "OK  " : "FAIL"} ${path} ${res.status} ${Date.now() - t0}ms ${text.slice(0, 200).replace(/\s+/g, " ")}`,
    );
  } catch (e) {
    console.log(
      `FAIL ${path} ERR ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

await check("/api/ping");
await check("/api/ipinfo", "ip=8.8.8.8");
await check("/api/oathnet/ip-info", "ip=8.8.8.8");
await check("/api/oathnet/breach", "query=test@example.com");
await check("/api/seekria/email-osint", "query=test@example.com");
await check("/api/seeknow/network/email-check", "email=test@example.com");
await check("/api/proxynova/comb", "query=test@example.com");
