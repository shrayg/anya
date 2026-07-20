import { searchUsernameAccounts } from "../lib/username-accounts/search.ts";
import {
  sanitizeUsernameForAccounts,
  USERNAME_ACCOUNTS_INVALID_MESSAGE,
} from "../lib/username-accounts/username.ts";
import { getUsernameAccountSites } from "../lib/username-accounts/sites.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("== unit ==");
assert(getUsernameAccountSites().length === 223, "expected 223 sites");
assert(sanitizeUsernameForAccounts("octocat") === "octocat", "sanitize ok");
assert(sanitizeUsernameForAccounts("@Octocat") === "Octocat", "strip @");
assert(sanitizeUsernameForAccounts("https://x.com") === null, "reject url");
assert(sanitizeUsernameForAccounts("../x") === null, "reject path");
console.log("unit ok");

console.log("== live coding category (octocat) ==");
const coding = await searchUsernameAccounts({
  query: "octocat",
  category: "coding",
});
console.log(
  JSON.stringify(
    {
      checked: coding.checked,
      found: coding.count,
      durationMs: coding.durationMs,
      errors: coding.errors,
      sites: coding.found.map((h) => h.siteName),
      sample: coding.found.slice(0, 5).map((h) => ({
        site: h.siteName,
        status: h.statusCode,
        url: h.url,
      })),
    },
    null,
    2,
  ),
);

assert(coding.checked >= 10, "coding category should check multiple sites");
assert(
  coding.found.some((h) => /github/i.test(h.siteName)),
  "expected GitHub hit for octocat",
);

console.log("== live social category (small sample via github-known handle) ==");
const social = await searchUsernameAccounts({
  query: "octocat",
  category: "social",
});
console.log(
  JSON.stringify(
    {
      checked: social.checked,
      found: social.count,
      durationMs: social.durationMs,
      errors: social.errors,
      top: social.found.slice(0, 8).map((h) => h.siteName),
    },
    null,
    2,
  ),
);

console.log("== invalid input ==");
let threw = false;
try {
  await searchUsernameAccounts({ query: "bad/name" });
} catch (err) {
  threw = err instanceof Error && err.message === USERNAME_ACCOUNTS_INVALID_MESSAGE;
}
assert(threw, "invalid username should throw");
console.log("invalid ok");

console.log("\nALL TESTS PASSED");
