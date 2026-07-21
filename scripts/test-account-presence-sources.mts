import { searchAccountPresence } from "../lib/account-presence/index.ts";
import { searchHandleSweep } from "../lib/handle-sweep/search.ts";
import { searchEmailPresence } from "../lib/email-presence/index.ts";
import { getHandleSweepSites } from "../lib/handle-sweep/sites.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("== handle-sweep sites ==");
assert(getHandleSweepSites().length >= 400, "expected 400+ handle sweep sites");
console.log("sites", getHandleSweepSites().length);

console.log("== handle-sweep octocat (bounded via full search) ==");
const sweep = await searchHandleSweep({ query: "octocat" });
console.log({
  checked: sweep.checked,
  found: sweep.count,
  ms: sweep.durationMs,
  sample: sweep.found.slice(0, 5).map((h) => h.siteName),
});
assert(sweep.found.some((h) => /github/i.test(h.siteName)), "github expected");

console.log("== account presence web-profiles only ==");
const webOnly = await searchAccountPresence({
  query: "octocat",
  sources: ["web-profiles"],
  category: "coding",
});
console.log({
  sources: webOnly.sources.map((s) => `${s.label}:${s.count}/${s.checked}`),
  ms: webOnly.durationMs,
});
assert(webOnly.sources[0]?.id === "web-profiles", "web-profiles source");

console.log("== email presence (gravatar-friendly) ==");
const email = await searchEmailPresence({
  query: "example@gmail.com",
});
console.log({
  checked: email.checked,
  found: email.count,
  rateLimited: email.rateLimited,
  sites: email.found.map((h) => h.siteName),
  ms: email.durationMs,
  source: email.sources[0]?.label,
});
assert(email.sources[0]?.label === "Email Presence", "branded source label");
assert(!JSON.stringify(email).toLowerCase().includes("holehe"), "no holehe leak");
assert(!JSON.stringify(webOnly).toLowerCase().includes("sherlock"), "no sherlock leak");
assert(!JSON.stringify(webOnly).toLowerCase().includes("nebula"), "no nebula leak");

console.log("\nALL TESTS PASSED");
