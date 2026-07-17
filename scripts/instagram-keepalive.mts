/**
 * Instagram session keep-alive / auto-relogin.
 * Run via pm2 cron, e.g.:
 *   pm2 start scripts/instagram-keepalive.mts --name ig-keepalive --interpreter npx --interpreter-args tsx --cron "0 */4 * * *" --no-autorestart
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
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
}

const root = process.cwd();
loadEnvFile(resolve(root, ".env.local"));
loadEnvFile("/var/www/anya-secrets/instagram.env");

const { ensureInstagramSession, probeInstagramSessionAlive } = await import(
  "../lib/instagram-reauth"
);

const alive = await probeInstagramSessionAlive();
console.log(`[ig-keepalive] session_alive=${alive}`);

if (alive) {
  process.exit(0);
}

const result = await ensureInstagramSession({ force: true });
console.log(
  `[ig-keepalive] refreshed=${result.refreshed} ok=${result.ok} msg=${result.message ?? ""}`,
);
process.exit(result.ok ? 0 : 2);
