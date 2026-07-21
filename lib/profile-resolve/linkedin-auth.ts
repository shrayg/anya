/**
 * Operator LinkedIn password login → fresh `li_at` / `JSESSIONID`.
 *
 * Uses the same `uas/authenticate` path as unofficial LinkedIn clients.
 * Verified 2026-07-21: `{ login_result: "PASS" }` mints a working session.
 *
 * Credentials: LINKEDIN_EMAIL + LINKEDIN_PASSWORD (env or secrets file).
 * Never log password values.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const UA_APP =
  "LinkedIn/8.8.1 CFNetwork/711.3.18 Darwin/14.5.0";
const UA_WEB =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type LinkedInLoginResult = {
  ok: boolean;
  liAt: string | null;
  jsessionId: string | null;
  loginResult: string | null;
  challengeUrl: string | null;
  detail?: string;
  persisted: boolean;
};

function secretsPath(): string {
  return (
    process.env.ANYA_LINKEDIN_SECRETS_PATH?.trim() ||
    "/var/www/anya-secrets/linkedin.env"
  );
}

function loadSecretsFile(): Record<string, string> {
  const path = secretsPath();

  try {
    if (!existsSync(path)) return {};

    const out: Record<string, string> = {};

    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const eq = trimmed.indexOf("=");
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      out[key] = value;
    }

    return out;
  } catch {
    return {};
  }
}

function stripQuotes(value: string | undefined | null): string | null {
  if (!value) return null;

  const v = value.trim().replace(/^"|"$/g, "");

  return v || null;
}

export function getLinkedInLoginCredentials(): {
  email: string | null;
  password: string | null;
  configured: boolean;
} {
  const file = loadSecretsFile();
  const email =
    process.env.LINKEDIN_EMAIL?.trim() || file.LINKEDIN_EMAIL?.trim() || null;
  const password =
    process.env.LINKEDIN_PASSWORD?.trim() ||
    file.LINKEDIN_PASSWORD?.trim() ||
    null;

  return {
    email,
    password,
    configured: Boolean(email && password),
  };
}

function parseSetCookies(
  header: string | null,
  getSetCookie?: () => string[],
): Map<string, string> {
  const map = new Map<string, string>();
  const parts =
    typeof getSetCookie === "function"
      ? getSetCookie()
      : header
        ? header.split(/,(?=\s*[^;=]+=)/)
        : [];

  for (const raw of parts) {
    const nv = raw.split(";")[0]?.trim();

    if (!nv || !nv.includes("=")) continue;

    const eq = nv.indexOf("=");
    const name = nv.slice(0, eq).trim();
    const value = nv.slice(eq + 1).trim();

    map.set(name, value);
  }

  return map;
}

/**
 * Persist rotated session cookies (and optional credentials already present).
 * Writes secrets file when possible; always updates process.env for this process.
 * On local Windows, also patches .env.local when present.
 */
export function persistLinkedInSession(opts: {
  liAt: string;
  jsessionId: string;
}): boolean {
  const liAt = opts.liAt.trim();
  const jsessionId = stripQuotes(opts.jsessionId) || opts.jsessionId;

  process.env.LINKEDIN_LI_AT = liAt;
  process.env.LINKEDIN_JSESSIONID = jsessionId;
  process.env.LINKEDIN_CSRF_TOKEN = jsessionId;

  const path = secretsPath();
  const existing = loadSecretsFile();
  const next: Record<string, string> = {
    ...existing,
    LINKEDIN_LI_AT: liAt,
    LINKEDIN_JSESSIONID: jsessionId,
    LINKEDIN_CSRF_TOKEN: jsessionId,
  };

  const creds = getLinkedInLoginCredentials();

  if (creds.email) next.LINKEDIN_EMAIL = creds.email;
  if (creds.password) next.LINKEDIN_PASSWORD = creds.password;

  let wrote = false;

  try {
    mkdirSync(dirname(path), { recursive: true });
    const body =
      Object.entries(next)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n";

    writeFileSync(path, body, { encoding: "utf8", mode: 0o600 });
    wrote = true;
  } catch {
    // Local Windows / missing /var/www — fall through to .env.local
  }

  try {
    const localEnv = `${process.cwd()}/.env.local`;

    if (existsSync(localEnv)) {
      const keys = {
        LINKEDIN_LI_AT: liAt,
        LINKEDIN_JSESSIONID: jsessionId,
        LINKEDIN_CSRF_TOKEN: jsessionId,
        ...(creds.email ? { LINKEDIN_EMAIL: creds.email } : {}),
        ...(creds.password ? { LINKEDIN_PASSWORD: creds.password } : {}),
      };
      const lines = readFileSync(localEnv, "utf8").split(/\r?\n/);
      const seen = new Set<string>();
      const out: string[] = [];

      for (const line of lines) {
        if (line.trim() && !line.trim().startsWith("#") && line.includes("=")) {
          const k = line.split("=", 1)[0]!.trim();

          if (k in keys) {
            out.push(`${k}=${keys[k as keyof typeof keys]}`);
            seen.add(k);
            continue;
          }
        }

        out.push(line);
      }

      for (const [k, v] of Object.entries(keys)) {
        if (!seen.has(k)) out.push(`${k}=${v}`);
      }

      writeFileSync(localEnv, out.join("\n") + "\n", "utf8");
      wrote = true;
    }
  } catch {
    // ignore local env patch failures
  }

  return wrote;
}

/**
 * Login with operator email/password and mint a fresh li_at.
 *
 * Uses direct egress (not residential proxy). Proxy logins reliably get
 * LinkedIn CHALLENGE/captcha; cookie-authenticated Voyager calls can still
 * use the proxy separately.
 */
export async function loginLinkedInOperator(): Promise<LinkedInLoginResult> {
  const { email, password, configured } = getLinkedInLoginCredentials();

  if (!configured || !email || !password) {
    return {
      ok: false,
      liAt: null,
      jsessionId: null,
      loginResult: null,
      challengeUrl: null,
      persisted: false,
      detail:
        "Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD to enable automatic session refresh.",
    };
  }

  try {
    const loginPage = await fetchWithTimeout("https://www.linkedin.com/login", {
      headers: {
        "User-Agent": UA_WEB,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
      redirect: "follow",
      timeoutMs: 25_000,
    });

    const warmCookies = parseSetCookies(
      loginPage.headers.get("set-cookie"),
      () =>
        typeof loginPage.headers.getSetCookie === "function"
          ? loginPage.headers.getSetCookie()
          : [],
    );
    let jsessionId =
      stripQuotes(warmCookies.get("JSESSIONID")) ||
      stripQuotes(
        [...warmCookies.entries()].find(
          ([k]) => k.toUpperCase() === "JSESSIONID",
        )?.[1],
      );

    const cookieHeader = [...warmCookies.entries()]
      .map(([k, v]) =>
        k === "JSESSIONID" ? `JSESSIONID="${stripQuotes(v) || v}"` : `${k}=${v}`,
      )
      .join("; ");

    const authRes = await fetchWithTimeout(
      "https://www.linkedin.com/uas/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Li-User-Agent":
            "LIAuthLibrary:3.2.4 com.linkedin.LinkedIn:8.8.1 iPhone:8.3",
          "User-Agent": UA_APP,
          "X-User-Agent":
            "LIAuthLibrary:3.2.4 com.linkedin.LinkedIn:8.8.1 iPhone:8.3",
          "Accept-Language": "en-US,en;q=0.8",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: new URLSearchParams({
          session_key: email,
          session_password: password,
          JSESSIONID: jsessionId || "",
        }).toString(),
        cache: "no-store",
        redirect: "manual",
        timeoutMs: 25_000,
      },
    );

    const authCookies = parseSetCookies(
      authRes.headers.get("set-cookie"),
      () =>
        typeof authRes.headers.getSetCookie === "function"
          ? authRes.headers.getSetCookie()
          : [],
    );
    const liAt = authCookies.get("li_at") || null;
    const jsFromAuth = stripQuotes(authCookies.get("JSESSIONID"));

    if (jsFromAuth) jsessionId = jsFromAuth;

    let loginResult: string | null = null;
    let challengeUrl: string | null = null;

    try {
      const json = (await authRes.json()) as {
        login_result?: string;
        challenge_url?: string;
      };

      loginResult = json.login_result ?? null;
      challengeUrl = json.challenge_url || null;
    } catch {
      loginResult = `http_${authRes.status}`;
    }

    if (loginResult === "PASS" && liAt && jsessionId) {
      const persisted = persistLinkedInSession({ liAt, jsessionId });

      return {
        ok: true,
        liAt,
        jsessionId,
        loginResult,
        challengeUrl: challengeUrl || null,
        persisted,
        detail: "Logged in via uas/authenticate (direct egress).",
      };
    }

    return {
      ok: false,
      liAt,
      jsessionId,
      loginResult,
      challengeUrl,
      persisted: false,
      detail:
        loginResult === "CHALLENGE" || challengeUrl
          ? "LinkedIn issued a login challenge/captcha — complete it in a browser, then retry."
          : `LinkedIn login failed (result=${loginResult ?? "unknown"}).`,
    };
  } catch (err) {
    return {
      ok: false,
      liAt: null,
      jsessionId: null,
      loginResult: null,
      challengeUrl: null,
      persisted: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
