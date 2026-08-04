import { TOTP } from "otpauth";
import { createCipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import "server-only";

import sodium from "libsodium-wrappers";
import { ProxyAgent } from "undici";

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  mergeEnvContents,
  parseEnvFile,
  resolveInstagramSecretsPath,
  writeInstagramSessionFiles,
  type InstagramSessionInput,
} from "@/lib/instagram-session-store";

const LOGIN_TIMEOUT_MS = 30_000;
const APP_ID = "936619743392459";

export type InstagramCredentials = {
  username: string;
  password: string;
  totpSecret?: string;
  proxyUrl?: string;
};

export type InstagramLoginResult = {
  cookies: InstagramSessionInput;
  userId?: string;
  username?: string;
  checkpoint: boolean;
  twoFactor: boolean;
  message?: string;
};

function browserLoginHeaders(csrf?: string, cookie?: string): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "X-IG-App-ID": APP_ID,
    "X-Requested-With": "XMLHttpRequest",
    "X-ASBD-ID": "129477",
    "X-IG-WWW-Claim": "0",
    Origin: "https://www.instagram.com",
    Referer: "https://www.instagram.com/accounts/login/",
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (csrf) {
    headers["X-CSRFToken"] = csrf;
    headers["X-Instagram-AJAX"] = "1";
  }
  if (cookie) headers.Cookie = cookie;

  return headers;
}

function parseSetCookie(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};

  if (!header) return out;
  const parts = header.split(/,(?=\s*[^;=]+=[^;]+)/);

  for (const part of parts) {
    const first = part.split(";")[0]?.trim();

    if (!first || !first.includes("=")) continue;
    const eq = first.indexOf("=");

    out[first.slice(0, eq)] = first.slice(eq + 1);
  }

  return out;
}

function collectCookies(response: Response, jar: Record<string, string>) {
  const anyHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof anyHeaders.getSetCookie === "function") {
    for (const line of anyHeaders.getSetCookie()) {
      Object.assign(jar, parseSetCookie(line));
    }

    return;
  }
  Object.assign(jar, parseSetCookie(response.headers.get("set-cookie")));
}

function jarToHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Instagram browser password encryption (#PWD_INSTAGRAM_BROWSER:10:...).
 * AES-256-GCM + libsodium sealed box of the AES key.
 */
export async function encryptInstagramBrowserPassword(
  password: string,
  keyId: number,
  publicKeyHex: string,
  version = 10,
): Promise<string> {
  await sodium.ready;
  const timestamp = Math.floor(Date.now() / 1000);
  const aesKey = new Uint8Array(randomBytes(32));
  const iv = new Uint8Array(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    aesKey as unknown as import("node:crypto").CipherKey,
    iv as unknown as import("node:crypto").BinaryLike,
  );

  cipher.setAAD(new Uint8Array(Buffer.from(String(timestamp), "utf8")));
  const encrypted = new Uint8Array(
    Buffer.concat([
      cipher.update(password, "utf8") as unknown as Uint8Array,
      cipher.final() as unknown as Uint8Array,
    ]),
  );
  const tag = new Uint8Array(cipher.getAuthTag());
  const publicKey = Uint8Array.from(Buffer.from(publicKeyHex, "hex"));
  const encryptedKey = sodium.crypto_box_seal(aesKey, publicKey);

  const header = new Uint8Array([
    1,
    keyId & 0xff,
    encryptedKey.length & 0xff,
    (encryptedKey.length >> 8) & 0xff,
  ]);
  const payload = new Uint8Array(
    header.length + encryptedKey.length + tag.length + encrypted.length,
  );
  let offset = 0;

  payload.set(header, offset);
  offset += header.length;
  payload.set(encryptedKey, offset);
  offset += encryptedKey.length;
  payload.set(tag, offset);
  offset += tag.length;
  payload.set(encrypted, offset);

  return `#PWD_INSTAGRAM_BROWSER:${version}:${timestamp}:${Buffer.from(payload).toString("base64")}`;
}

async function fetchLoginEncryptionParams(
  jar: Record<string, string>,
): Promise<{
  keyId: number;
  publicKey: string;
  version: number;
  csrf: string;
}> {
  const response = await fetchWithTimeout(
    "https://www.instagram.com/data/shared_data/",
    {
      headers: browserLoginHeaders(jar.csrftoken, jarToHeader(jar)),
      cache: "no-store",
      timeoutMs: LOGIN_TIMEOUT_MS,
    },
  );

  collectCookies(response, jar);

  let keyId = 0;
  let publicKey = "";
  let version = 10;

  if (response.ok) {
    try {
      const data = (await response.json()) as {
        encryption?: {
          key_id?: string | number;
          public_key?: string;
          version?: string | number;
        };
        config?: { csrf_token?: string };
      };

      keyId = Number(data.encryption?.key_id ?? 0);
      publicKey = String(data.encryption?.public_key ?? "");
      version = Number(data.encryption?.version ?? 10);
      if (data.config?.csrf_token) jar.csrftoken = data.config.csrf_token;
    } catch {
      // continue to HTML scrape
    }
  }

  if (!publicKey || !keyId) {
    const page = await fetchWithTimeout(
      "https://www.instagram.com/accounts/login/",
      {
        headers: browserLoginHeaders(undefined, jarToHeader(jar)),
        cache: "no-store",
        timeoutMs: LOGIN_TIMEOUT_MS,
      },
    );

    collectCookies(page, jar);
    const html = await page.text();
    const keyIdMatch = html.match(/"key_id"\s*:\s*"?(\d+)"?/);
    const pubMatch = html.match(/"public_key"\s*:\s*"([a-f0-9]+)"/i);
    const verMatch = html.match(/"version"\s*:\s*"?(\d+)"?/);

    if (keyIdMatch) keyId = Number(keyIdMatch[1]);
    if (pubMatch) publicKey = pubMatch[1];
    if (verMatch) version = Number(verMatch[1]);
    const csrfMatch = html.match(/"csrf_token"\s*:\s*"([^"]+)"/);

    if (csrfMatch) jar.csrftoken = csrfMatch[1];
  }

  if (!jar.csrftoken) {
    jar.csrftoken = randomBytes(16).toString("hex");
  }

  if (!publicKey || !keyId) {
    throw new Error(
      "Could not load Instagram login encryption keys. Try again shortly.",
    );
  }

  return { keyId, publicKey, version, csrf: jar.csrftoken };
}

function generateTotp(secret: string): string {
  const totp = new TOTP({
    secret: secret.replace(/\s+/g, ""),
    digits: 6,
    period: 30,
    algorithm: "SHA1",
  });

  return totp.generate();
}

export function loadInstagramCredentials(): InstagramCredentials | null {
  const secretsPath = resolveInstagramSecretsPath();
  const fromFile = existsSync(secretsPath)
    ? parseEnvFile(readFileSync(secretsPath, "utf8"))
    : {};

  const username =
    process.env.INSTAGRAM_USERNAME?.trim() ||
    fromFile.INSTAGRAM_USERNAME?.trim() ||
    "";
  const password =
    process.env.INSTAGRAM_PASSWORD?.trim() ||
    fromFile.INSTAGRAM_PASSWORD?.trim() ||
    "";

  if (!username || !password) return null;

  return {
    username,
    password,
    totpSecret:
      process.env.INSTAGRAM_TOTP_SECRET?.trim() ||
      fromFile.INSTAGRAM_TOTP_SECRET?.trim() ||
      undefined,
    proxyUrl:
      process.env.INSTAGRAM_PROXY_URL?.trim() ||
      fromFile.INSTAGRAM_PROXY_URL?.trim() ||
      undefined,
  };
}

export function writeInstagramCredentials(input: {
  username: string;
  password: string;
  totpSecret?: string;
  proxyUrl?: string;
}): void {
  const secretsPath = resolveInstagramSecretsPath();
  const existing = existsSync(secretsPath)
    ? readFileSync(secretsPath, "utf8")
    : "";
  const updates: Record<string, string> = {
    INSTAGRAM_USERNAME: input.username,
    INSTAGRAM_PASSWORD: input.password,
  };

  if (input.totpSecret) updates.INSTAGRAM_TOTP_SECRET = input.totpSecret;
  if (input.proxyUrl) updates.INSTAGRAM_PROXY_URL = input.proxyUrl;

  mkdirSync(dirname(secretsPath), { recursive: true });
  writeFileSync(secretsPath, mergeEnvContents(existing, updates), {
    encoding: "utf8",
    mode: 0o600,
  });

  process.env.INSTAGRAM_USERNAME = input.username;
  process.env.INSTAGRAM_PASSWORD = input.password;
  if (input.totpSecret) process.env.INSTAGRAM_TOTP_SECRET = input.totpSecret;
  if (input.proxyUrl) process.env.INSTAGRAM_PROXY_URL = input.proxyUrl;
}

/**
 * Full Instagram web login.
 * Pass `{ persist: false }` when importing a pool so primary session is not overwritten.
 */
export async function loginInstagramWeb(
  credentials?: InstagramCredentials,
  options?: { persist?: boolean },
): Promise<InstagramLoginResult> {
  const creds = credentials ?? loadInstagramCredentials();
  const persist = options?.persist !== false;

  if (!creds) {
    throw new Error(
      "Instagram username/password are not configured. Set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD in /var/www/anya-secrets/instagram.env",
    );
  }

  // Route the login through a residential proxy when configured — datacenter
  // IPs almost always trigger a checkpoint on password login.
  // Explicit empty string disables proxy (import --direct).
  const proxyUrl =
    creds.proxyUrl === ""
      ? ""
      : creds.proxyUrl || process.env.INSTAGRAM_PROXY_URL?.trim() || "";
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  const jar: Record<string, string> = {};

  const warm = await fetchWithTimeout("https://www.instagram.com/", {
    headers: browserLoginHeaders(),
    cache: "no-store",
    timeoutMs: LOGIN_TIMEOUT_MS,
    redirect: "manual",
    dispatcher,
  });

  collectCookies(warm, jar);

  const enc = await fetchLoginEncryptionParams(jar);
  const encPassword = await encryptInstagramBrowserPassword(
    creds.password,
    enc.keyId,
    enc.publicKey,
    enc.version,
  );

  const body = new URLSearchParams({
    username: creds.username,
    enc_password: encPassword,
    queryParams: "{}",
    optIntoOneTap: "false",
  });

  const loginResponse = await fetchWithTimeout(
    "https://www.instagram.com/api/v1/web/accounts/login/ajax/",
    {
      method: "POST",
      headers: browserLoginHeaders(enc.csrf, jarToHeader(jar)),
      body,
      cache: "no-store",
      timeoutMs: LOGIN_TIMEOUT_MS,
      dispatcher,
    },
  );

  collectCookies(loginResponse, jar);

  const payload = (await loginResponse.json().catch(() => ({}))) as {
    authenticated?: boolean;
    userId?: string;
    user?: boolean;
    status?: string;
    message?: string;
    two_factor_required?: boolean;
    checkpoint_url?: string;
    two_factor_info?: {
      two_factor_identifier?: string;
      totp_two_factor_on?: boolean;
    };
  };

  if (payload.two_factor_required) {
    if (!creds.totpSecret) {
      return {
        cookies: {},
        checkpoint: false,
        twoFactor: true,
        message:
          "Instagram requires 2FA. Add INSTAGRAM_TOTP_SECRET (authenticator seed) to secrets and retry.",
      };
    }

    const code = generateTotp(creds.totpSecret);
    const tfBody = new URLSearchParams({
      username: creds.username,
      verificationCode: code,
      identifier: payload.two_factor_info?.two_factor_identifier ?? "",
      queryParams: "{}",
    });

    const tfResponse = await fetchWithTimeout(
      "https://www.instagram.com/api/v1/web/accounts/login/ajax/two_factor/",
      {
        method: "POST",
        headers: browserLoginHeaders(jar.csrftoken, jarToHeader(jar)),
        body: tfBody,
        cache: "no-store",
        timeoutMs: LOGIN_TIMEOUT_MS,
        dispatcher,
      },
    );

    collectCookies(tfResponse, jar);
    const tfPayload = (await tfResponse.json().catch(() => ({}))) as {
      authenticated?: boolean;
      userId?: string;
      message?: string;
    };

    if (!tfPayload.authenticated && !jar.sessionid) {
      return {
        cookies: {},
        checkpoint: Boolean(payload.checkpoint_url),
        twoFactor: true,
        message: tfPayload.message || "Instagram 2FA verification failed.",
      };
    }
  }

  if (payload.checkpoint_url && !jar.sessionid) {
    return {
      cookies: {},
      checkpoint: true,
      twoFactor: false,
      message:
        "Instagram issued a checkpoint/challenge for this login (common on VPS IPs). Complete it once in a browser, then retry — or route via INSTAGRAM_PROXY_URL (residential).",
    };
  }

  if (!jar.sessionid && !payload.authenticated) {
    throw new Error(
      payload.message ||
        "Instagram login failed. Check username/password or complete any security challenge in a browser.",
    );
  }

  const cookies: InstagramSessionInput = {
    INSTAGRAM_SESSION_ID: jar.sessionid,
    INSTAGRAM_CSRF_TOKEN: jar.csrftoken,
    INSTAGRAM_DS_USER_ID: jar.ds_user_id,
    INSTAGRAM_MID: jar.mid,
    INSTAGRAM_IG_DID: jar.ig_did,
    INSTAGRAM_DATR: jar.datr,
  };

  if (!cookies.INSTAGRAM_SESSION_ID) {
    throw new Error(
      "Instagram login succeeded but no sessionid cookie was returned.",
    );
  }

  if (persist) {
    writeInstagramSessionFiles(cookies);
  }

  return {
    cookies,
    userId: payload.userId || jar.ds_user_id,
    username: creds.username,
    checkpoint: false,
    twoFactor: false,
    message: persist
      ? "Logged in and session cookies refreshed."
      : "Logged in (cookies not persisted to primary session).",
  };
}
