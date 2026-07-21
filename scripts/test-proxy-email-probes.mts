/**
 * Smoke-test proxy-backed email probes (Snapchat / TikTok / Facebook / Instagram / LinkedIn).
 * Loads .env.local via dotenv if present.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const {
  isResidentialProxyConfigured,
  residentialProxyHostLabel,
} = await import("../lib/residential-proxy.ts");
const { probeInstagram, probeLinkedIn } = await import(
  "../lib/email-presence/probes.ts"
);
const {
  probeSnapchat,
  probeTikTok,
  probeFacebook,
  probeDiscord,
} = await import("../lib/email-presence/probes-extra.ts");

const email = process.argv[2]?.trim() || "indoshray@gmail.com";

console.log(
  JSON.stringify({
    proxyConfigured: isResidentialProxyConfigured(),
    proxyHost: residentialProxyHostLabel(),
  }),
);

const probes = [
  ["Instagram", probeInstagram],
  ["LinkedIn", probeLinkedIn],
  ["Snapchat", probeSnapchat],
  ["TikTok", probeTikTok],
  ["Facebook", probeFacebook],
  ["Discord", probeDiscord],
] as const;

for (const [name, fn] of probes) {
  const started = Date.now();
  try {
    const result = await fn(email);
    console.log(
      JSON.stringify({
        name,
        ms: Date.now() - started,
        exists: result.exists,
        rateLimit: result.rateLimit,
        error: Boolean(result.error),
        profileUrl: result.profileUrl,
        others: result.others,
      }),
    );
  } catch (err) {
    console.log(
      JSON.stringify({
        name,
        ms: Date.now() - started,
        thrown: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
