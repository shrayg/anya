// Instagram session keep-alive / auto-relogin.
// Calls the running Next app (avoids importing server-only modules via tsx).
// PM2 example:
//   pm2 start scripts/instagram-keepalive.mts --name ig-keepalive \
//     --interpreter npx --interpreter-args tsx \
//     --cron "0 */4 * * *" --no-autorestart
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

const secret = process.env.INSTAGRAM_CRON_SECRET?.trim();
if (!secret) {
  console.error(
    "[ig-keepalive] INSTAGRAM_CRON_SECRET is not set in secrets/.env.local",
  );
  process.exit(2);
}

const base =
  process.env.INSTAGRAM_KEEPALIVE_URL?.trim() ||
  "http://127.0.0.1:3000/api/internal/instagram-keepalive";

const response = await fetch(base, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-anya-cron-secret": secret,
  },
  body: "{}",
});

const text = await response.text();
let payload: Record<string, unknown> = {};
try {
  payload = JSON.parse(text) as Record<string, unknown>;
} catch {
  payload = { raw: text.slice(0, 300) };
}

console.log(
  `[ig-keepalive] http=${response.status} ok=${payload.ok} alive=${payload.alive} refreshed=${payload.refreshed} msg=${payload.message ?? payload.error ?? ""}`,
);

process.exit(response.ok && payload.ok !== false ? 0 : 2);
