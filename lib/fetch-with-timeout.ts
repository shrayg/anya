export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = 20_000, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...fetchInit,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Try again in a moment.");
    }

    const cause =
      error instanceof Error &&
      "cause" in error &&
      error.cause instanceof Error
        ? error.cause.message
        : undefined;
    const base =
      error instanceof Error ? error.message : "Network request failed";
    if (/fetch failed/i.test(base)) {
      throw new Error(
        cause
          ? `Instagram network error: ${cause}`
          : "Instagram network error (fetch failed). The host may be rate-limited — wait a minute and retry.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
