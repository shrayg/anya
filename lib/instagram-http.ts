import "server-only";

import { ProxyAgent } from "undici";

import {
  findInstagramAccountIndex,
  setActiveInstagramAccountIndex,
  type InstagramAccount,
} from "@/lib/instagram-accounts";
import {
  acquirePoolAccount,
  classifyInstagramFailure,
  reportPoolFailure,
  reportPoolSuccess,
  type InstagramFailureKind,
} from "@/lib/instagram-session-pool";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const INSTAGRAM_WEB_APP_ID = "936619743392459";
const DEFAULT_TIMEOUT_MS = 25_000;

const proxyDispatcherCache = new Map<string, ProxyAgent>();

export type InstagramHttpResponse = {
  status: number;
  ok: boolean;
  headers: Headers;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

export type InstagramFetchOptions = {
  username?: string;
  method?: string;
  body?: string | URLSearchParams | FormData;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** When false, skip session cookies (login / warm). Default true. */
  useSession?: boolean;
  /** Prefer sticking to this account label for pagination. */
  preferLabel?: string;
  /** Force rotate before this request. */
  forceRotate?: boolean;
  /**
   * When true (default), a challenge/429/auth response reports failure to the
   * pool and may rotate. Set false for probes that expect failure.
   */
  reportToPool?: boolean;
  /** Override account selection (login flows that build their own jar). */
  account?: InstagramAccount | null;
  /** Extra cookie header fragment (login jar). */
  cookieOverride?: string;
  /** Skip got-scraping and use undici (rare fallback). */
  preferUndici?: boolean;
};

let gotScrapingLoader: Promise<typeof import("got-scraping")> | null = null;

async function loadGotScraping() {
  if (!gotScrapingLoader) {
    gotScrapingLoader = import("got-scraping");
  }

  return gotScrapingLoader;
}

function dispatcherFor(proxyUrl?: string): ProxyAgent | undefined {
  if (!proxyUrl) return undefined;
  let dispatcher = proxyDispatcherCache.get(proxyUrl);

  if (!dispatcher) {
    dispatcher = new ProxyAgent(proxyUrl);
    proxyDispatcherCache.set(proxyUrl, dispatcher);
  }

  return dispatcher;
}

function buildSessionCookie(account: InstagramAccount): string {
  const sessionId = account.sessionId ?? "";
  const csrfToken = account.csrfToken ?? "0";
  const dsUserId =
    account.dsUserId ||
    (sessionId.includes(":") ? sessionId.split(":")[0] : "");

  return [
    sessionId ? `sessionid=${sessionId}` : "",
    `csrftoken=${csrfToken}`,
    dsUserId ? `ds_user_id=${dsUserId}` : "",
    account.mid ? `mid=${account.mid}` : "",
    account.igDid ? `ig_did=${account.igDid}` : "",
    account.datr ? `datr=${account.datr}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function browserHeadersForAccount(
  account: InstagramAccount | null | undefined,
  username?: string,
  cookieOverride?: string,
): Record<string, string> {
  const csrf = account?.csrfToken ?? "0";
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-ig-app-id": INSTAGRAM_WEB_APP_ID,
    "x-requested-with": "XMLHttpRequest",
    "x-asbd-id": "359341",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    Origin: "https://www.instagram.com",
    Referer: username
      ? `https://www.instagram.com/${username}/`
      : "https://www.instagram.com/",
    "x-csrftoken": csrf,
  };

  const cookie =
    cookieOverride ||
    (account?.sessionId ? buildSessionCookie(account) : undefined);

  if (cookie) headers.Cookie = cookie;

  return headers;
}

function toHttpResponse(
  status: number,
  body: string,
  headerMap?: Record<string, string | string[] | undefined>,
): InstagramHttpResponse {
  const headers = new Headers();

  if (headerMap) {
    for (const [key, value] of Object.entries(headerMap)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const entry of value) headers.append(key, entry);
      } else {
        headers.set(key, value);
      }
    }
  }
  const textBody = body;

  return {
    status,
    ok: status >= 200 && status < 300,
    headers,
    text: async () => textBody,
    json: async () => JSON.parse(textBody) as unknown,
  };
}

function shouldReportFailure(
  status: number,
  body: string,
): { report: boolean; kind: InstagramFailureKind } {
  const kind = classifyInstagramFailure(status, body);

  if (kind === "challenge" || kind === "rate_limit" || kind === "auth") {
    return { report: true, kind };
  }
  if (!body.trim() && (status === 429 || status >= 500 || status === 0)) {
    return { report: true, kind: status === 429 ? "rate_limit" : "empty" };
  }

  return { report: false, kind };
}

async function fetchViaGotScraping(
  url: string,
  options: InstagramFetchOptions,
  account: InstagramAccount | null,
): Promise<InstagramHttpResponse> {
  const { gotScraping } = await loadGotScraping();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const method = (options.method ?? "GET").toUpperCase() as
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "HEAD"
    | "OPTIONS";
  const headers = {
    ...browserHeadersForAccount(
      account,
      options.username,
      options.cookieOverride,
    ),
    ...options.headers,
  };

  // got-scraping generates its own browser-like UA / sec-ch headers; keep our
  // Instagram-specific headers and let it fill TLS fingerprint + header order.
  const response = await gotScraping({
    url,
    method,
    headers,
    body: options.body as string | undefined,
    proxyUrl:
      account?.proxyUrl || process.env.INSTAGRAM_PROXY_URL?.trim() || undefined,
    timeout: { request: timeoutMs },
    throwHttpErrors: false,
    responseType: "text",
    useHeaderGenerator: true,
    headerGeneratorOptions: {
      browsers: [{ name: "chrome", minVersion: 120 }],
      devices: ["desktop"],
      locales: ["en-US"],
      operatingSystems: ["windows"],
    },
    // Keep Instagram cookie/header authority — don't overwrite Cookie.
    http2: false,
  });

  return toHttpResponse(
    response.statusCode,
    typeof response.body === "string"
      ? response.body
      : String(response.body ?? ""),
    response.headers as Record<string, string | string[] | undefined>,
  );
}

async function fetchViaUndici(
  url: string,
  options: InstagramFetchOptions,
  account: InstagramAccount | null,
): Promise<InstagramHttpResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const proxyUrl =
    account?.proxyUrl || process.env.INSTAGRAM_PROXY_URL?.trim() || undefined;
  const response = await fetchWithTimeout(url, {
    method: options.method ?? "GET",
    headers: {
      ...browserHeadersForAccount(
        account,
        options.username,
        options.cookieOverride,
      ),
      ...options.headers,
    },
    body: options.body as BodyInit | undefined,
    cache: "no-store",
    timeoutMs,
    dispatcher: dispatcherFor(proxyUrl),
  });
  const text = await response.text();

  return toHttpResponse(response.status, text);
}

/**
 * Instagram HTTP entry point. Prefers got-scraping (Chrome TLS fingerprint)
 * with the sticky account+proxy from the session pool. Falls back to undici
 * ProxyAgent if got-scraping fails to load.
 */
export async function instagramFetch(
  url: string,
  options: InstagramFetchOptions = {},
): Promise<InstagramHttpResponse> {
  const useSession = options.useSession !== false;
  const reportToPool = options.reportToPool !== false;

  let account =
    options.account !== undefined
      ? options.account
      : useSession
        ? acquirePoolAccount({
            preferLabel: options.preferLabel,
            forceRotate: options.forceRotate,
          })
        : null;

  if (account?.label) {
    const index = findInstagramAccountIndex(account.label);

    if (index >= 0) setActiveInstagramAccountIndex(index);
  }

  if (useSession && !account?.sessionId && options.account === undefined) {
    throw new Error(
      "INSTAGRAM_SESSION_ID is not configured. Add the Instagram session cookie on the server.",
    );
  }

  let response: InstagramHttpResponse;

  try {
    if (options.preferUndici) {
      response = await fetchViaUndici(url, options, account);
    } else {
      try {
        response = await fetchViaGotScraping(url, options, account);
      } catch (error) {
        // Native/module issues → soft fallback so production keeps working.
        console.warn(
          "[instagram-http] got-scraping failed, falling back to undici:",
          error instanceof Error ? error.message : error,
        );
        response = await fetchViaUndici(url, options, account);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (reportToPool && account?.label) {
      reportPoolFailure("network", message, account.label);
    }
    throw error;
  }

  // Materialize body once so pool classification and callers share the same text.
  const bodyText = await response.text();
  const headerMap: Record<string, string> = {};

  response.headers.forEach((value, key) => {
    headerMap[key] = value;
  });
  response = toHttpResponse(response.status, bodyText, headerMap);

  if (reportToPool && account?.label) {
    const verdict = shouldReportFailure(response.status, bodyText);

    if (verdict.report) {
      reportPoolFailure(
        verdict.kind,
        bodyText.trimStart().startsWith("<")
          ? `HTML challenge (${response.status})`
          : bodyText.slice(0, 180) || `HTTP ${response.status}`,
        account.label,
      );
    } else if (response.ok) {
      reportPoolSuccess(account.label);
    }
  }

  return response;
}

/** @deprecated Prefer acquirePoolAccount — kept for undici callers mid-migration. */
export function getInstagramDispatcherForAccount(
  account?: InstagramAccount | null,
): ProxyAgent | undefined {
  const proxyUrl =
    account?.proxyUrl || process.env.INSTAGRAM_PROXY_URL?.trim() || undefined;

  return dispatcherFor(proxyUrl);
}

export function isInstagramChallengeBody(text: string): boolean {
  return /checkpoint_required|challenge_required|require_login|login_required|please wait a few minutes|verify (it'?s|its) you|captcha|automated behaviou?r/i.test(
    text,
  );
}
