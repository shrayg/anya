import { OsintTimeoutError, withDeadline } from "@/lib/osint-search-guard";

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")) ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError")
  );
}

function networkErrorMessage(error: unknown, input: RequestInfo | URL): string {
  const cause =
    error instanceof Error && "cause" in error && error.cause instanceof Error
      ? error.cause.message
      : undefined;
  const base =
    error instanceof Error ? error.message : "Network request failed";

  if (!/fetch failed/i.test(base)) {
    return base;
  }

  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const isInstagram = /instagram\.com/i.test(url);

  if (isInstagram) {
    return cause
      ? `Instagram network error: ${cause}`
      : "Instagram network error (fetch failed). The host may be rate-limited — wait a minute and retry.";
  }

  return cause
    ? `Upstream network error: ${cause}`
    : "Upstream network error. The provider may be unreachable — try again shortly.";
}

/**
 * Fetch with an AbortController deadline that covers the full request
 * (connection + headers). Pair with `readResponseText` so body reads
 * cannot hang past the same budget.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number; dispatcher?: unknown },
): Promise<Response> {
  const { timeoutMs = 20_000, dispatcher, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const upstream = fetchInit.signal;
  const onUpstreamAbort = () => controller.abort();

  if (upstream) {
    if (upstream.aborted) controller.abort();
    else upstream.addEventListener("abort", onUpstreamAbort, { once: true });
  }

  try {
    // `dispatcher` is an undici extension to fetch (used for proxying).
    return await fetch(input, {
      ...fetchInit,
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
  } catch (error) {
    if (isAbortError(error)) {
      throw new OsintTimeoutError("Request timed out. Try again in a moment.");
    }

    throw new Error(networkErrorMessage(error, input));
  } finally {
    clearTimeout(timeout);
    if (upstream) upstream.removeEventListener("abort", onUpstreamAbort);
  }
}

/** Bound body reads — fetch timeouts alone only cover headers. */
export async function readResponseText(
  res: Response,
  timeoutMs = 20_000,
): Promise<string> {
  return withDeadline(
    res.text(),
    timeoutMs,
    "Request timed out while reading the response. Try again in a moment.",
  );
}
