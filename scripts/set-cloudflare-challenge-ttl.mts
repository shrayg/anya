/**
 * Apply Cloudflare Challenge Passage (challenge_ttl) for anyaint.com.
 *
 * Desired value: 7200 seconds (2 hours) — see infra/cloudflare/zone-settings.json
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... npx tsx scripts/set-cloudflare-challenge-ttl.mts
 *
 * Token needs Zone Settings Write for the zone (or Account-wide Zone edit).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ZONE_SETTINGS_PATH = resolve(
  process.cwd(),
  "infra/cloudflare/zone-settings.json",
);

type ZoneSettingsFile = {
  zoneId: string;
  zoneName?: string;
  settings: {
    challenge_ttl: {
      value: number;
      label?: string;
    };
  };
};

function loadDotEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
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
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadDotEnvLocal();

const config = JSON.parse(
  readFileSync(ZONE_SETTINGS_PATH, "utf8"),
) as ZoneSettingsFile;

const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const zoneId =
  process.env.CLOUDFLARE_ZONE_ID?.trim() || config.zoneId;
const desired = config.settings.challenge_ttl.value;

if (!token) {
  console.error(
    "Missing CLOUDFLARE_API_TOKEN. Add it to .env.local or the environment.",
  );
  process.exit(1);
}

if (![300, 900, 1800, 2700, 3600, 7200, 10800, 14400, 28800, 57600, 86400, 604800, 2592000, 31536000].includes(desired)) {
  console.error(`Invalid challenge_ttl value: ${desired}`);
  process.exit(1);
}

const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/challenge_ttl`;

async function main() {
  const currentRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const currentJson = (await currentRes.json()) as {
    success?: boolean;
    result?: { value?: number; id?: string };
    errors?: Array<{ message?: string }>;
  };

  if (!currentRes.ok || !currentJson.success) {
    console.error(
      "GET challenge_ttl failed:",
      currentJson.errors?.map((e) => e.message).join("; ") ||
        currentRes.status,
    );
    process.exit(1);
  }

  const before = currentJson.result?.value;
  console.log(
    `Zone ${zoneId}${config.zoneName ? ` (${config.zoneName})` : ""}`,
  );
  console.log(`Current challenge_ttl: ${before}`);
  console.log(
    `Desired challenge_ttl: ${desired} (${config.settings.challenge_ttl.label ?? "custom"})`,
  );

  if (before === desired) {
    console.log("Already up to date — no PATCH needed.");
    return;
  }

  const patchRes = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value: desired }),
  });
  const patchJson = (await patchRes.json()) as {
    success?: boolean;
    result?: { value?: number };
    errors?: Array<{ message?: string }>;
  };

  if (!patchRes.ok || !patchJson.success) {
    console.error(
      "PATCH challenge_ttl failed:",
      patchJson.errors?.map((e) => e.message).join("; ") || patchRes.status,
    );
    process.exit(1);
  }

  console.log(`Updated challenge_ttl → ${patchJson.result?.value}`);
}

void main();
