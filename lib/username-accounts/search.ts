import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  buildUsernameAccountUrl,
  filterUsernameAccountSites,
} from "@/lib/username-accounts/sites";
import type {
  UsernameAccountHit,
  UsernameAccountSite,
  UsernameAccountsSearchResult,
} from "@/lib/username-accounts/types";
import {
  sanitizeUsernameForAccounts,
  USERNAME_ACCOUNTS_INVALID_MESSAGE,
} from "@/lib/username-accounts/username";

/** Cap outbound fan-out so one search cannot saturate the VPS egress. */
export const USERNAME_ACCOUNTS_CONCURRENCY = 16;
export const USERNAME_ACCOUNTS_PER_SITE_TIMEOUT_MS = 6_000;
export const USERNAME_ACCOUNTS_USER_AGENT =
  "Mozilla/5.0 (compatible; AnyaIntAccountFinder/1.0; +https://anyaint.com)";

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const index = next;

      next += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]!, index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker(),
  );

  await Promise.all(workers);

  return results;
}

function isFoundByStatus(site: UsernameAccountSite, statusCode: number): boolean {
  if (site.error_type === "status_code") {
    if (statusCode === 200) return true;
    if (statusCode === site.error_code) return false;

    return false;
  }

  return statusCode === 200;
}

async function checkSite(
  site: UsernameAccountSite,
  username: string,
): Promise<UsernameAccountHit> {
  const started = Date.now();
  const url = buildUsernameAccountUrl(site.url, username);

  if (!url) {
    return {
      siteName: site.name,
      category: site.category,
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
      timeoutMs: USERNAME_ACCOUNTS_PER_SITE_TIMEOUT_MS,
      headers: {
        "User-Agent": USERNAME_ACCOUNTS_USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    // Do not buffer HTML bodies — status is enough for existence heuristics.
    try {
      await response.body?.cancel();
    } catch {
      // Ignore cancel failures.
    }

    return {
      siteName: site.name,
      category: site.category,
      username,
      url,
      statusCode: response.status,
      found: isFoundByStatus(site, response.status),
      responseMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";

    return {
      siteName: site.name,
      category: site.category,
      username,
      url,
      statusCode: 0,
      found: false,
      responseMs: Date.now() - started,
      error: message,
    };
  }
}

export type UsernameAccountsSearchInput = {
  query: string;
  category?: string | null;
  concurrency?: number;
};

export async function searchUsernameAccounts(
  input: UsernameAccountsSearchInput,
): Promise<UsernameAccountsSearchResult> {
  const started = Date.now();
  const username = sanitizeUsernameForAccounts(input.query);

  if (!username) {
    throw new Error(USERNAME_ACCOUNTS_INVALID_MESSAGE);
  }

  const sites = filterUsernameAccountSites(input.category);
  const concurrency = Math.max(
    1,
    Math.min(
      input.concurrency ?? USERNAME_ACCOUNTS_CONCURRENCY,
      USERNAME_ACCOUNTS_CONCURRENCY,
    ),
  );

  const hits = await mapPool(sites, concurrency, (site) =>
    checkSite(site, username),
  );

  const found = hits
    .filter((hit) => hit.found)
    .sort((a, b) => a.siteName.localeCompare(b.siteName));

  const errors = hits.filter((hit) => hit.error && !hit.found).length;
  const categories: Record<string, number> = {};

  for (const hit of found) {
    const key = hit.category || "unknown";

    categories[key] = (categories[key] ?? 0) + 1;
  }

  const result: UsernameAccountsSearchResult = {
    query: input.query.trim(),
    username,
    count: found.length,
    checked: hits.length,
    found,
    notFound: hits.length - found.length - errors,
    errors,
    categories,
    categoryFilter: input.category?.trim().toLowerCase() || null,
    durationMs: Date.now() - started,
  };

  if (found.length === 0 && errors > hits.length * 0.5) {
    result.warning =
      "Many platforms timed out or blocked this scan. Retry later or narrow by category.";
  } else if (found.length > 0) {
    result.warning =
      "HTTP 200 is treated as a possible profile. Soft-404 pages can false-positive — verify links manually.";
  }

  return result;
}
