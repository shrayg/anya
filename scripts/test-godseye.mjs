import { readFileSync } from "fs";

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) continue;

      const index = trimmed.indexOf("=");

      if (index === -1) continue;

      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore missing env file
  }
}

loadEnv();

const pub = process.env.GODSEYE_API_KEY ?? "";
const exp = process.env.GODSEYE_EXPORT_API_KEY ?? "";

console.log(
  "GODSEYE_API_KEY:",
  pub
    ? `${pub.slice(0, 8)}...${pub.slice(-4)} (len ${pub.length})`
    : "MISSING",
);
console.log(
  "GODSEYE_EXPORT_API_KEY:",
  exp
    ? `${exp.slice(0, 6)}...${exp.slice(-4)} (len ${exp.length})`
    : "MISSING",
);

const {
  fetchGodsEyeIngressCheck,
  fetchGodsEyeSearch,
  fetchGodsEyeFivemDetailed,
  fetchGodsEyeEmailReport,
  sanitizeGodsEyeSearch,
} = await import("../lib/godseye.ts");

const tests = [
  ["ingress-check", () => fetchGodsEyeIngressCheck()],
  [
    "search/roblox convictve",
    async () => {
      try {
        return await fetchGodsEyeSearch("roblox", "convictve", 30_000);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  ],
  [
    "fivem/accounts",
    () => fetchGodsEyeFivemDetailed("accounts", "1213987478122536992"),
  ],
  ["email-report", () => fetchGodsEyeEmailReport("test@example.com")],
];

for (const [name, run] of tests) {
  const start = Date.now();
  const result = await run();
  const ms = Date.now() - start;

  console.log(`\n--- ${name} (${ms}ms) ---`);

  if (result && typeof result === "object" && "ok" in result) {
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          status: result.status,
          code: result.code,
          error: result.error,
          dataKeys: result.data ? Object.keys(result.data).slice(0, 12) : [],
        },
        null,
        2,
      ),
    );
    continue;
  }

  if (result && typeof result === "object" && "error" in result && !("success" in result)) {
    console.log(JSON.stringify(result, null, 2));
    continue;
  }

  const sanitized =
    result && typeof result === "object"
      ? sanitizeGodsEyeSearch(result)
      : result;

  console.log(
    JSON.stringify(
      {
        success: result?.success,
        error: result?.error,
        message: result?.message,
        code: result?.code,
        count: sanitized?.count,
        sampleKeys:
          sanitized?.results?.[0] && typeof sanitized.results[0] === "object"
            ? Object.keys(sanitized.results[0]).slice(0, 10)
            : [],
      },
      null,
      2,
    ),
  );
}
