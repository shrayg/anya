/**
 * Operator LinkedIn session reverse-email lookup.
 *
 * Verified 2026-07-21 with a live operator `li_at`:
 * - Session auth works (`GET /voyager/api/me` returns the operator miniProfile).
 * - Classic Sales Nav `viewByEmail` is dead (redirect loops / empty SPA).
 * - People search by email keywords is the remaining Voyager path; it only
 *   yields a high-confidence hit when LinkedIn returns a unique publicIdentifier
 *   for that query (Contact Info / discovery settings permitting).
 * - Do NOT fan out to many Voyager/Sales URLs in one run: LinkedIn 429s and
 *   then invalidates `li_at` (redirect loop on /me and /feed).
 * - Login + Voyager calls use direct egress (not residential proxy). Proxy
 *   login triggers CHALLENGE; proxy after direct login burns IP-bound `li_at`.
 * - Auto-refresh: LINKEDIN_EMAIL + LINKEDIN_PASSWORD via uas/authenticate.
 *
 * JSESSIONID from DevTools may include quotes — strip before csrf-token header.
 */

import { existsSync, readFileSync } from "node:fs";

import {
  getLinkedInLoginCredentials,
  loginLinkedInOperator,
} from "@/lib/profile-resolve/linkedin-auth";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export type LinkedInSessionStatus =
  | "matched"
  | "no_match"
  | "no_session"
  | "auth_failed"
  | "privacy_or_blocked"
  | "error";

export type LinkedInSessionHit = {
  profileUrl: string;
  publicIdentifier: string;
  memberUrn: string | null;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
};

export type LinkedInSessionLookupResult = {
  status: LinkedInSessionStatus;
  hit: LinkedInSessionHit | null;
  methodsTried: string[];
  detail?: string;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function decodeMaybe(value: string | undefined): string | undefined {
  const raw = value?.trim();

  if (!raw) return undefined;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function loadLinkedInSecretsFile(): Record<string, string> {
  const path =
    process.env.ANYA_LINKEDIN_SECRETS_PATH?.trim() ||
    "/var/www/anya-secrets/linkedin.env";

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

export function getLinkedInSessionCookies(): {
  liAt: string | null;
  jsessionId: string | null;
  configured: boolean;
} {
  const file = loadLinkedInSecretsFile();
  const liAt =
    decodeMaybe(process.env.LINKEDIN_LI_AT) ??
    decodeMaybe(file.LINKEDIN_LI_AT) ??
    null;
  const jsessionId =
    decodeMaybe(process.env.LINKEDIN_JSESSIONID) ??
    decodeMaybe(process.env.LINKEDIN_CSRF_TOKEN) ??
    decodeMaybe(file.LINKEDIN_JSESSIONID) ??
    decodeMaybe(file.LINKEDIN_CSRF_TOKEN) ??
    null;

  return {
    liAt,
    jsessionId,
    configured: Boolean(liAt),
  };
}

function buildCookieHeader(liAt: string, jsessionId: string | null): string {
  const parts = [`li_at=${liAt}`, "liap=true"];

  if (jsessionId) {
    const bare = jsessionId.replace(/^"|"$/g, "");

    parts.push(`JSESSIONID="${bare}"`);
  }

  return parts.join("; ");
}

function sessionHeaders(liAt: string, jsessionId: string | null): Record<string, string> {
  const csrf = jsessionId?.replace(/^"|"$/g, "") || "ajax:0";

  return {
    "User-Agent": UA,
    Accept:
      "application/vnd.linkedin.normalized+json+2.1, application/json, text/html",
    "csrf-token": csrf,
    "x-restli-protocol-version": "2.0.0",
    "x-li-lang": "en_US",
    "x-li-track":
      '{"clientVersion":"1.13.18893","mpVersion":"1.13.18893","osName":"web","timezoneOffset":-4,"timezone":"America/New_York","deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
    Cookie: buildCookieHeader(liAt, jsessionId),
    Referer: "https://www.linkedin.com/search/results/people/",
    Origin: "https://www.linkedin.com",
  };
}

function extractPublicId(urlOrSlug: string): string | null {
  const fromUrl = urlOrSlug.match(/linkedin\.com\/in\/([A-Za-z0-9_\-%]+)/i);

  if (fromUrl?.[1]) {
    return decodeURIComponent(fromUrl[1]).replace(/\/$/, "");
  }

  if (/^[A-Za-z0-9_\-%]+$/.test(urlOrSlug)) {
    return decodeURIComponent(urlOrSlug);
  }

  return null;
}

function parseProfileFromText(text: string): LinkedInSessionHit | null {
  const publicIdMatch =
    text.match(/"publicIdentifier"\s*:\s*"([^"]+)"/i) ||
    text.match(/\\"publicIdentifier\\"\s*:\s*\\"([^\\"]+)\\"/i);
  const publicIdentifier = publicIdMatch?.[1]
    ? extractPublicId(publicIdMatch[1])
    : null;

  if (!publicIdentifier) {
    const urlMatch =
      text.match(
        /https?:\\\/\\\/(?:www\.)?linkedin\.com\\\/in\\\/([A-Za-z0-9_\-%]+)/i,
      ) ||
      text.match(
        /https?:\/\/(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9_\-%]+)/i,
      );

    if (!urlMatch?.[1]) return null;

    const id = extractPublicId(urlMatch[1]);

    if (!id) return null;

    return {
      profileUrl: `https://www.linkedin.com/in/${id}`,
      publicIdentifier: id,
      memberUrn: null,
      firstName: null,
      lastName: null,
      headline: null,
    };
  }

  const memberUrn =
    text.match(/"entityUrn"\s*:\s*"(urn:li:(?:fsd_)?profile:[^"]+)"/i)?.[1] ??
    text.match(/"(urn:li:member:\d+)"/i)?.[1] ??
    null;
  const firstName = text.match(/"firstName"\s*:\s*"([^"]+)"/i)?.[1] ?? null;
  const lastName = text.match(/"lastName"\s*:\s*"([^"]+)"/i)?.[1] ?? null;
  const headline = text.match(/"headline"\s*:\s*"([^"]+)"/i)?.[1] ?? null;

  return {
    profileUrl: `https://www.linkedin.com/in/${publicIdentifier}`,
    publicIdentifier,
    memberUrn,
    firstName,
    lastName,
    headline,
  };
}

function collectPublicIds(text: string): string[] {
  const ids = [
    ...text.matchAll(/"publicIdentifier"\s*:\s*"([^"]+)"/gi),
  ].map((m) => m[1]);

  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

async function fetchSession(
  url: string,
  liAt: string,
  jsessionId: string | null,
  init?: RequestInit,
): Promise<{ status: number; text: string }> {
  try {
    // Direct egress only. Mixing residential proxy after a direct login
    // invalidates li_at (IP binding) — verified 2026-07-21.
    const res = await fetchWithTimeout(url, {
      ...init,
      headers: {
        ...sessionHeaders(liAt, jsessionId),
        ...(init?.headers as Record<string, string> | undefined),
      },
      cache: "no-store",
      redirect: "manual",
      timeoutMs: 20_000,
    });
    const text = await res.text();

    return { status: res.status, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (/redirect count exceeded/i.test(message)) {
      return { status: 401, text: message };
    }

    throw err;
  }
}

function isAuthDead(status: number, text: string): boolean {
  return (
    status === 401 ||
    status === 403 ||
    status === 302 ||
    /redirect count/i.test(text) ||
    (status !== 200 && status !== 429 && !/"miniProfile"|"plainId"/i.test(text))
  );
}

async function ensureLiveSession(methodsTried: string[]): Promise<{
  liAt: string | null;
  jsessionId: string | null;
  authOk: boolean;
  detail?: string;
}> {
  let { liAt, jsessionId, configured } = getLinkedInSessionCookies();
  const canLogin = getLinkedInLoginCredentials().configured;

  if (!configured || !liAt) {
    if (!canLogin) {
      return {
        liAt: null,
        jsessionId: null,
        authOk: false,
        detail:
          "Set LINKEDIN_LI_AT or LINKEDIN_EMAIL + LINKEDIN_PASSWORD for operator LinkedIn session.",
      };
    }

    methodsTried.push("session:login:bootstrap");
    const login = await loginLinkedInOperator();

    methodsTried.push(
      `session:login:${login.ok ? "ok" : "fail"}:${login.loginResult ?? "n/a"}`,
    );

    if (!login.ok || !login.liAt) {
      return {
        liAt: null,
        jsessionId: null,
        authOk: false,
        detail: login.detail ?? "LinkedIn login failed.",
      };
    }

    liAt = login.liAt;
    jsessionId = login.jsessionId;
  }

  methodsTried.push("session:/voyager/api/me");
  let me = await fetchSession(
    "https://www.linkedin.com/voyager/api/me",
    liAt,
    jsessionId,
  );

  if (
    isAuthDead(me.status, me.text) ||
    me.status !== 200 ||
    !/"miniProfile"|"plainId"/i.test(me.text)
  ) {
    if (!canLogin) {
      return {
        liAt,
        jsessionId,
        authOk: false,
        detail:
          "LinkedIn rejected the operator session. Set LINKEDIN_EMAIL + LINKEDIN_PASSWORD to auto-refresh, or paste a fresh li_at.",
      };
    }

    methodsTried.push("session:login:refresh");
    const login = await loginLinkedInOperator();

    methodsTried.push(
      `session:login:${login.ok ? "ok" : "fail"}:${login.loginResult ?? "n/a"}`,
    );

    if (!login.ok || !login.liAt) {
      return {
        liAt: null,
        jsessionId: null,
        authOk: false,
        detail: login.detail ?? "LinkedIn session refresh failed.",
      };
    }

    liAt = login.liAt;
    jsessionId = login.jsessionId;
    methodsTried.push("session:/voyager/api/me:retry");
    me = await fetchSession(
      "https://www.linkedin.com/voyager/api/me",
      liAt,
      jsessionId,
    );
  }

  if (me.status !== 200 || !/"miniProfile"|"plainId"/i.test(me.text)) {
    return {
      liAt,
      jsessionId,
      authOk: false,
      detail: `Unexpected /me response HTTP ${me.status} after login refresh.`,
    };
  }

  return { liAt, jsessionId, authOk: true };
}

/**
 * Resolve LinkedIn profile from email using operator session cookies.
 * Auto-refreshes via LINKEDIN_EMAIL / LINKEDIN_PASSWORD when li_at dies.
 */
export async function lookupLinkedInByEmailSession(
  email: string,
): Promise<LinkedInSessionLookupResult> {
  const methodsTried: string[] = [];

  methodsTried.push("session:proxy=direct");

  const live = await ensureLiveSession(methodsTried);

  if (!live.authOk || !live.liAt) {
    return {
      status: live.liAt ? "auth_failed" : "no_session",
      hit: null,
      methodsTried,
      detail: live.detail,
    };
  }

  const { liAt, jsessionId } = live;
  const quoted = encodeURIComponent(`"${email.trim().toLowerCase()}"`);

  // ONE people-search only. Extra Voyager/Sales fan-out gets 429 and burns li_at.
  methodsTried.push("session:search:quoted");
  try {
    const { status, text } = await fetchSession(
      `https://www.linkedin.com/voyager/api/search/dash/clusters?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-165&origin=GLOBAL_SEARCH_HEADER&q=all&query=(keywords:${quoted},flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(PEOPLE)),includeFiltersInResponse:false)&start=0&count=10`,
      liAt,
      jsessionId,
    );

    if (status === 429) {
      return {
        status: "privacy_or_blocked",
        hit: null,
        methodsTried,
        detail:
          "LinkedIn rate-limited the operator session (HTTP 429). Wait before retrying.",
      };
    }

    if (status === 401 || status === 403 || status === 302) {
      return {
        status: "auth_failed",
        hit: null,
        methodsTried,
        detail: `Search rejected session (HTTP ${status}).`,
      };
    }

    const ids = collectPublicIds(text);
    const total =
      text.match(/"totalResultCount"\s*:\s*(\d+)/i)?.[1] ??
      text.match(/"total"\s*:\s*(\d+)/i)?.[1];

    if (total) methodsTried.push(`session:search:total=${total}`);

    if (ids.length === 1) {
      const hit = parseProfileFromText(text);

      if (hit) {
        return {
          status: "matched",
          hit,
          methodsTried,
          detail:
            "Unique people-search hit for this email via operator LinkedIn session.",
        };
      }
    }

    if (ids.length > 1) {
      methodsTried.push(`session:search:ambiguous:${ids.length}`);
    }
  } catch (err) {
    methodsTried.push(
      `session:search:error:${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    status: "no_match",
    hit: null,
    methodsTried,
    detail:
      "Session is valid but LinkedIn returned no unique profile for this email (people-search total=0 is common when email discovery is off). Sales Nav email lookup needs a Sales seat on the operator account.",
  };
}
