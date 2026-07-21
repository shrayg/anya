import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  buildHandleSweepUrl,
  getHandleSweepSites,
} from "@/lib/handle-sweep/sites";
import type {
  HandleSweepHit,
  HandleSweepSearchResult,
  HandleSweepSite,
} from "@/lib/handle-sweep/types";
import {
  sanitizeUsernameForAccounts,
  USERNAME_ACCOUNTS_INVALID_MESSAGE,
} from "@/lib/username-accounts/username";

export const HANDLE_SWEEP_CONCURRENCY = 20;
export const HANDLE_SWEEP_PER_SITE_TIMEOUT_MS = 7_000;
export const HANDLE_SWEEP_MAX_BODY_CHARS = 48_000;
export const HANDLE_SWEEP_USER_AGENT =
  "Mozilla/5.0 (compatible; AnyaIntHandleSweep/1.0; +https://anyaint.com)";

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const index = next;

      next += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]!);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(items.length, 1)) },
      () => worker(),
    ),
  );

  return results;
}

async function readBodyPreview(response: Response): Promise<string> {
  const reader = response.body?.getReader();

  if (!reader) return "";

  const decoder = new TextDecoder();
  let text = "";

  try {
    while (text.length < HANDLE_SWEEP_MAX_BODY_CHARS) {
      const { done, value } = await reader.read();

      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length >= HANDLE_SWEEP_MAX_BODY_CHARS) {
        text = text.slice(0, HANDLE_SWEEP_MAX_BODY_CHARS);
        break;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }

  return text;
}

function errorMessages(site: HandleSweepSite): string[] {
  if (!site.errorMsg) return [];
  if (typeof site.errorMsg === "string") return [site.errorMsg];

  return site.errorMsg;
}

function isFound(
  site: HandleSweepSite,
  statusCode: number,
  finalUrl: string,
  body: string,
): boolean {
  if (site.errorType === "status_code") {
    const missing = site.errorCode ?? 404;

    if (statusCode === missing) return false;
    if (statusCode >= 200 && statusCode < 300) return true;

    return false;
  }

  if (site.errorType === "response_url") {
    if (!site.errorUrl) return statusCode >= 200 && statusCode < 300;
    const final = finalUrl.replace(/\/+$/, "");
    const errorUrl = site.errorUrl.replace(/\/+$/, "");

    return final !== errorUrl && statusCode >= 200 && statusCode < 400;
  }

  // message: presence of error string => not found
  const needles = errorMessages(site);

  if (needles.length === 0) {
    return statusCode >= 200 && statusCode < 300;
  }

  const lower = body.toLowerCase();

  for (const needle of needles) {
    if (needle && lower.includes(needle.toLowerCase())) return false;
  }

  return statusCode >= 200 && statusCode < 300;
}

async function checkSite(
  site: HandleSweepSite,
  username: string,
): Promise<HandleSweepHit> {
  const started = Date.now();

  if (site.regexCheck) {
    try {
      if (!new RegExp(site.regexCheck).test(username)) {
        return {
          siteName: site.name,
          username,
          url: site.url,
          statusCode: 0,
          found: false,
          responseMs: null,
          skipped: true,
          error: "Username rejected by site pattern",
        };
      }
    } catch {
      // Invalid upstream regex — skip pattern gate.
    }
  }

  const url = buildHandleSweepUrl(site.url, username);

  if (!url) {
    return {
      siteName: site.name,
      username,
      url: "",
      statusCode: 0,
      found: false,
      responseMs: null,
      error: "Invalid URL template",
    };
  }

  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      timeoutMs: HANDLE_SWEEP_PER_SITE_TIMEOUT_MS,
      headers: {
        "User-Agent": HANDLE_SWEEP_USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const needsBody = site.errorType === "message";
    const body = needsBody ? await readBodyPreview(response) : "";

    if (!needsBody) {
      try {
        await response.body?.cancel();
      } catch {
        // ignore
      }
    }

    const finalUrl = response.url || url;

    return {
      siteName: site.name,
      username,
      url,
      statusCode: response.status,
      found: isFound(site, response.status, finalUrl, body),
      responseMs: Date.now() - started,
    };
  } catch (err) {
    return {
      siteName: site.name,
      username,
      url,
      statusCode: 0,
      found: false,
      responseMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Request failed",
    };
  }
}

export async function searchHandleSweep(input: {
  query: string;
  concurrency?: number;
}): Promise<HandleSweepSearchResult> {
  const started = Date.now();
  const username = sanitizeUsernameForAccounts(input.query);

  if (!username) {
    throw new Error(USERNAME_ACCOUNTS_INVALID_MESSAGE);
  }

  const sites = getHandleSweepSites();
  const concurrency = Math.max(
    1,
    Math.min(input.concurrency ?? HANDLE_SWEEP_CONCURRENCY, HANDLE_SWEEP_CONCURRENCY),
  );

  const hits = await mapPool(sites, concurrency, (site) =>
    checkSite(site, username),
  );

  const skipped = hits.filter((h) => h.skipped).length;
  const found = hits
    .filter((h) => h.found)
    .sort((a, b) => a.siteName.localeCompare(b.siteName));
  const errors = hits.filter((h) => h.error && !h.found && !h.skipped).length;

  const result: HandleSweepSearchResult = {
    query: input.query.trim(),
    username,
    count: found.length,
    checked: hits.length - skipped,
    skipped,
    found,
    notFound: hits.length - found.length - errors - skipped,
    errors,
    durationMs: Date.now() - started,
  };

  if (found.length === 0 && errors > result.checked * 0.5) {
    result.warning =
      "Many platforms timed out or blocked this sweep. Retry later.";
  } else if (found.length > 0) {
    result.warning =
      "Profile hits are heuristic. Soft-404 pages can false-positive — verify links manually.";
  }

  return result;
}
