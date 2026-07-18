import { NextResponse } from "next/server";

import { publicSearchError } from "@/lib/public-branding";

/** Per-provider upstream budget (headers + body). Stay under Cloudflare ~100s. */
export const OSINT_PROVIDER_TIMEOUT_MS = 20_000;

/** Whole route budget so proxies never see a hung Node request. */
export const OSINT_ROUTE_DEADLINE_MS = 55_000;

/** Long modules (site pentest, Instagram) still finish before CF hard-cut. */
export const OSINT_LONG_ROUTE_DEADLINE_MS = 90_000;

export class OsintTimeoutError extends Error {
  constructor(message = "Request timed out. Try again in a moment.") {
    super(message);
    this.name = "OsintTimeoutError";
  }
}

export function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  message?: string,
): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new OsintTimeoutError(message));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function isTimeoutLike(err: unknown): boolean {
  if (err instanceof OsintTimeoutError) return true;
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  const lower = err.message.toLowerCase();
  return (
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("aborted")
  );
}

/** Rate-limit / quota / CF blocks — soft-fail when other work can continue. */
export function isSoftProviderFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const lower = err.message.toLowerCase();
  return (
    isTimeoutLike(err) ||
    lower.includes("too many searches") ||
    lower.includes("daily search limit") ||
    lower.includes("rate limit") ||
    lower.includes("per-minute") ||
    lower.includes("quota exceeded") ||
    lower.includes("temporarily unavailable due to provider limits") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("temporarily blocked") ||
    lower.includes("provider temporarily")
  );
}

export function osintErrorMessage(err: unknown, fallback?: string): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return fallback ?? publicSearchError();
}

/**
 * Always return JSON. Timeouts → 504 (not opaque proxy 502 HTML).
 * Optional softEmpty → HTTP 200 with a clean empty payload + message.
 */
export function osintFailureResponse(
  err: unknown,
  opts?: {
    softEmpty?: Record<string, unknown>;
    fallbackMessage?: string;
  },
): NextResponse {
  const message = osintErrorMessage(err, opts?.fallbackMessage);

  if (opts?.softEmpty && isSoftProviderFailure(err)) {
    return NextResponse.json({
      ...opts.softEmpty,
      message: isTimeoutLike(err)
        ? "Lookup timed out before results arrived. Try again."
        : message,
    });
  }

  return NextResponse.json(
    { error: message },
    { status: isTimeoutLike(err) ? 504 : 502 },
  );
}

export async function runOsintSearch(
  work: () => Promise<unknown>,
  opts?: {
    deadlineMs?: number;
    softEmpty?: Record<string, unknown>;
    fallbackMessage?: string;
  },
): Promise<NextResponse> {
  try {
    const data = await withDeadline(
      Promise.resolve().then(work),
      opts?.deadlineMs ?? OSINT_ROUTE_DEADLINE_MS,
    );
    return NextResponse.json(data);
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: opts?.softEmpty,
      fallbackMessage: opts?.fallbackMessage,
    });
  }
}
