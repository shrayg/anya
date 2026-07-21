import { searchEmailPresence } from "../lib/email-presence/index.ts";

const email = process.argv[2]?.trim() || "indoshray@gmail.com";
const result = await searchEmailPresence({ query: email });

console.log(
  JSON.stringify(
    {
      email: result.email,
      checked: result.checked,
      count: result.count,
      rateLimited: result.rateLimited,
      errors: result.errors,
      durationMs: result.durationMs,
      profiles: result.found
        .filter((f) => f.profileUrl)
        .map((f) => ({ site: f.siteName, url: f.profileUrl, others: f.others })),
      presence: result.found
        .filter((f) => !f.profileUrl)
        .map((f) => ({ site: f.siteName, others: f.others })),
      warning: result.warning,
    },
    null,
    2,
  ),
);
