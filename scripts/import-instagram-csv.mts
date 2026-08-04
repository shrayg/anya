/**
 * Import G2G-style Instagram credential CSV → cookie pool.
 *
 * Usage:
 *   npx tsx scripts/import-instagram-csv.mts "C:\path\to\accounts.csv"
 *   npx tsx scripts/import-instagram-csv.mts "C:\path\to\accounts.csv" --limit=5
 *
 * Writes `.instagram-accounts.json` (gitignored) and a sanitized report.
 * Never overwrites the primary INSTAGRAM_SESSION_* cookies.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ProxyAgent } from "undici";

// Scripts are not Next Server Components — stub the guard package.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

const envPath = resolve(process.cwd(), ".env.local");

for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = value;
}

type CsvAccount = {
  id: string;
  username: string;
  password: string;
  totpSecret?: string;
};

type ImportRowResult = {
  username: string;
  ok: boolean;
  probeOk?: boolean;
  twoFactor?: boolean;
  checkpoint?: boolean;
  error?: string;
  dsUserId?: string;
};

function parseCsv(path: string): CsvAccount[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const rows: CsvAccount[] = [];

  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const id = (cols[0] ?? "").trim();
    let username = (cols[1] ?? "").trim().replace(/^'+/, "");
    const password = (cols[3] ?? "").trim();
    // G2G dumps often put the authenticator seed in Question or Answer.
    const secretRaw = [(cols[5] ?? "").trim(), (cols[6] ?? "").trim()]
      .find((value) => /[A-Z0-9]{4}\s+[A-Z0-9]{4}/i.test(value) || value.length >= 16);
    const totpSecret = secretRaw
      ? secretRaw.replace(/\s+/g, "").toUpperCase()
      : undefined;

    if (!username || !password) continue;
    rows.push({ id, username, password, totpSecret });
  }

  return rows;
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function probeCookies(input: {
  sessionId: string;
  csrfToken?: string;
  dsUserId?: string;
  mid?: string;
  igDid?: string;
  datr?: string;
  proxyUrl?: string;
}): Promise<boolean> {
  const { fetchWithTimeout } = await import("../lib/fetch-with-timeout");
  const cookie = [
    `sessionid=${input.sessionId}`,
    input.csrfToken ? `csrftoken=${input.csrfToken}` : null,
    input.dsUserId ? `ds_user_id=${input.dsUserId}` : null,
    input.mid ? `mid=${input.mid}` : null,
    input.igDid ? `ig_did=${input.igDid}` : null,
    input.datr ? `datr=${input.datr}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const proxyUrl =
    input.proxyUrl ||
    process.env.INSTAGRAM_PROXY_URL?.trim() ||
    process.env.OSINT_RESIDENTIAL_PROXY_URL?.trim() ||
    "";
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  try {
    const response = await fetchWithTimeout(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(
        (input.dsUserId ? "instagram" : "instagram"),
      )}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "*/*",
          "X-IG-App-ID": "936619743392459",
          "X-CSRFToken": input.csrfToken || "",
          "X-Requested-With": "XMLHttpRequest",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          Cookie: cookie,
          Referer: "https://www.instagram.com/",
        },
        cache: "no-store",
        timeoutMs: 15_000,
        dispatcher,
      },
    );

    if (response.status === 401 || response.status === 403) return false;
    if (response.status === 429) return true;
    const text = await response.text();
    if (/require_login|login_required|Please wait a few minutes/i.test(text)) {
      return false;
    }
    // SecFetch / soft blocks still mean the session cookie was accepted enough to route.
    if (/SecFetch Policy/i.test(text)) return true;
    return response.ok || response.status === 400;
  } catch {
    return false;
  }
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error(
    'Usage: npx tsx scripts/import-instagram-csv.mts "<csv-path>" [--limit=N] [--delay-ms=8000]',
  );
  process.exit(1);
}

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const delayArg = process.argv.find((arg) => arg.startsWith("--delay-ms="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const delayMs = delayArg ? Number(delayArg.split("=")[1]) : 8_000;

const accounts = parseCsv(csvPath).slice(0, Number.isFinite(limit) ? limit : undefined);
const proxyUrl =
  process.env.INSTAGRAM_PROXY_URL?.trim() ||
  process.env.OSINT_RESIDENTIAL_PROXY_URL?.trim() ||
  undefined;
const forceDirect = process.argv.includes("--direct");
const effectiveProxy = forceDirect ? "" : proxyUrl || undefined;

console.log(
  `Importing ${accounts.length} Instagram accounts${effectiveProxy ? " via residential proxy" : " DIRECT (no proxy)"}…`,
);

const { loginInstagramWeb } = await import("../lib/instagram-login");
const { writeInstagramAccountsFile, resolveInstagramAccountsPath } =
  await import("../lib/instagram-session-store");

type PoolAccount = {
  label: string;
  sessionId: string;
  csrfToken?: string;
  dsUserId?: string;
  mid?: string;
  igDid?: string;
  datr?: string;
  proxyUrl?: string;
};

const existingPath = resolveInstagramAccountsPath();
let pool: PoolAccount[] = [];
try {
  const raw = readFileSync(existingPath, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    pool = parsed.filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as PoolAccount).sessionId === "string",
    ) as PoolAccount[];
  }
} catch {
  pool = [];
}

const byLabel = new Map(pool.map((entry) => [entry.label, entry]));
const report: ImportRowResult[] = [];

for (let index = 0; index < accounts.length; index++) {
  const account = accounts[index]!;
  const label = account.username;
  process.stdout.write(`[${index + 1}/${accounts.length}] @${label} … `);

  try {
    const result = await loginInstagramWeb(
      {
        username: account.username,
        password: account.password,
        totpSecret: account.totpSecret,
        proxyUrl: effectiveProxy,
      },
      { persist: false },
    );

    if (result.twoFactor || result.checkpoint || !result.cookies.INSTAGRAM_SESSION_ID) {
      console.log(
        result.twoFactor
          ? "2FA required"
          : result.checkpoint
            ? "checkpoint"
            : result.message || "no session",
      );
      report.push({
        username: label,
        ok: false,
        twoFactor: result.twoFactor,
        checkpoint: result.checkpoint,
        error: result.message,
      });
    } else {
      const sessionId = result.cookies.INSTAGRAM_SESSION_ID!;
      const entry: PoolAccount = {
        label,
        sessionId,
        csrfToken: result.cookies.INSTAGRAM_CSRF_TOKEN,
        dsUserId: result.cookies.INSTAGRAM_DS_USER_ID || result.userId,
        mid: result.cookies.INSTAGRAM_MID,
        igDid: result.cookies.INSTAGRAM_IG_DID,
        datr: result.cookies.INSTAGRAM_DATR,
        proxyUrl: effectiveProxy,
      };

      const probeOk = await probeCookies(entry);
      byLabel.set(label, entry);
      console.log(probeOk ? "ok + probe" : "logged in, probe soft-fail");
      report.push({
        username: label,
        ok: true,
        probeOk,
        dsUserId: entry.dsUserId,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`fail: ${message.slice(0, 120)}`);
    report.push({ username: label, ok: false, error: message });
  }

  if (index < accounts.length - 1) await sleep(delayMs);
}

const finalPool = [...byLabel.values()];
const written = writeInstagramAccountsFile(finalPool);
const reportPath = resolve(process.cwd(), ".instagram-import-report.json");
writeFileSync(
  reportPath,
  `${JSON.stringify(
    {
      importedAt: new Date().toISOString(),
      csvPath,
      attempted: accounts.length,
      ok: report.filter((row) => row.ok).length,
      probeOk: report.filter((row) => row.probeOk).length,
      failed: report.filter((row) => !row.ok).length,
      poolSize: finalPool.length,
      accountsPath: written.path,
      results: report,
    },
    null,
    2,
  )}\n`,
  { encoding: "utf8" },
);

console.log("\nDone.");
console.log(`  Pool accounts: ${finalPool.length} → ${written.path}`);
console.log(`  OK: ${report.filter((row) => row.ok).length}`);
console.log(`  Probe OK: ${report.filter((row) => row.probeOk).length}`);
console.log(`  Failed: ${report.filter((row) => !row.ok).length}`);
console.log(`  Report: ${reportPath}`);
