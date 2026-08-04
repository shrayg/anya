import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import "server-only";

export const INSTAGRAM_ENV_KEYS = [
  "INSTAGRAM_SESSION_ID",
  "INSTAGRAM_CSRF_TOKEN",
  "INSTAGRAM_DS_USER_ID",
  "INSTAGRAM_MID",
  "INSTAGRAM_IG_DID",
  "INSTAGRAM_DATR",
] as const;

export type InstagramEnvKey = (typeof INSTAGRAM_ENV_KEYS)[number];

export type InstagramSessionInput = Partial<Record<InstagramEnvKey, string>>;

/** Durable secrets path on the VPS (outside the git checkout). */
export function resolveInstagramSecretsPath(): string {
  return (
    process.env.ANYA_INSTAGRAM_SECRETS_PATH?.trim() ||
    "/var/www/anya-secrets/instagram.env"
  );
}

/** JSON pool of extra Instagram sessions (gitignored / outside checkout on VPS). */
export function resolveInstagramAccountsPath(): string {
  return (
    process.env.ANYA_INSTAGRAM_ACCOUNTS_PATH?.trim() ||
    (process.env.ANYA_INSTAGRAM_SECRETS_PATH?.trim()
      ? process.env.ANYA_INSTAGRAM_SECRETS_PATH.replace(
          /instagram\.env$/i,
          "instagram-accounts.json",
        )
      : "") ||
    `${process.cwd()}/.instagram-accounts.json`
  );
}

function sanitizeValue(raw: string): string {
  let value = raw.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value;
}

export function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();

    out[key] = sanitizeValue(trimmed.slice(eq + 1));
  }

  return out;
}

export function mergeEnvContents(
  existing: string,
  updates: Record<string, string>,
): string {
  const lines = existing ? existing.split(/\r?\n/) : [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) {
      out.push(line);
      continue;
    }
    const key = line.split("=", 1)[0]?.trim() ?? "";

    if (key && key in updates) {
      out.push(`${key}=${updates[key]}`);
      seen.add(key);
      continue;
    }
    out.push(line);
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key) && value) {
      out.push(`${key}=${value}`);
    }
  }

  return `${out
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
    .join("\n")
    .trimEnd()}\n`;
}

export function normalizeInstagramSessionInput(
  input: InstagramSessionInput,
): Record<string, string> {
  const updates: Record<string, string> = {};

  for (const key of INSTAGRAM_ENV_KEYS) {
    const value = input[key]?.trim();

    if (!value) continue;
    updates[key] = sanitizeValue(value);
  }

  return updates;
}

export function writeInstagramSessionFiles(input: InstagramSessionInput): {
  secretsPath: string;
  localPath: string;
  keysWritten: string[];
} {
  const updates = normalizeInstagramSessionInput(input);

  if (!updates.INSTAGRAM_SESSION_ID) {
    throw new Error("INSTAGRAM_SESSION_ID is required.");
  }

  const secretsPath = resolveInstagramSecretsPath();

  mkdirSync(dirname(secretsPath), { recursive: true });
  const previousSecrets = existsSync(secretsPath)
    ? readFileSync(secretsPath, "utf8")
    : "";

  writeFileSync(secretsPath, mergeEnvContents(previousSecrets, updates), {
    encoding: "utf8",
    mode: 0o600,
  });

  const localPath = `${process.cwd()}/.env.local`;
  const previousLocal = existsSync(localPath)
    ? readFileSync(localPath, "utf8")
    : "";

  writeFileSync(localPath, mergeEnvContents(previousLocal, updates), {
    encoding: "utf8",
    mode: 0o600,
  });

  // Keep process.env hot for the current Node process until restart.
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;
  }

  return {
    secretsPath,
    localPath,
    keysWritten: Object.keys(updates),
  };
}

export type InstagramAccountFileEntry = {
  label: string;
  sessionId: string;
  csrfToken?: string;
  dsUserId?: string;
  mid?: string;
  igDid?: string;
  datr?: string;
  proxyUrl?: string;
};

/** Persist the rotating Instagram account pool (JSON file, not committed). */
export function writeInstagramAccountsFile(
  accounts: InstagramAccountFileEntry[],
): { path: string; count: number } {
  const path = resolveInstagramAccountsPath();

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(accounts, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return { path, count: accounts.length };
}

export function readInstagramSessionStatus(): {
  configured: boolean;
  keysPresent: string[];
  secretsPath: string;
  secretsFileExists: boolean;
} {
  const secretsPath = resolveInstagramSecretsPath();
  const keysPresent = INSTAGRAM_ENV_KEYS.filter((key) =>
    Boolean(process.env[key]?.trim()),
  );

  return {
    configured: Boolean(process.env.INSTAGRAM_SESSION_ID?.trim()),
    keysPresent: [...keysPresent],
    secretsPath,
    secretsFileExists: existsSync(secretsPath),
  };
}
