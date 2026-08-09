import { NextResponse } from "next/server";

import {
  publicSearchError,
  sanitizePublicError,
} from "@/lib/public-branding";

/** Per-provider upstream budget (headers + body). Stay under Cloudflare ~100s. */
export const OSINT_PROVIDER_TIMEOUT_MS = 28_000;

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

/**
 * Wait for all tasks, or return whatever has settled once `budgetMs` elapses.
 * Unsettled slots become rejected timeouts so callers can merge partials.
 * Does not cancel underlying work (fetch abort is per-call); it stops waiting.
 * If the budget hits with zero fulfilled values while work is still in flight,
 * wait up to `emptyGraceMs` longer so we don't return empty while providers
 * are still running.
 * Tuple types are preserved (same as `Promise.allSettled`).
 */
export function settleWithinBudget<T extends readonly unknown[] | []>(
  tasks: T,
  budgetMs: number,
  emptyGraceMs?: number,
): Promise<{ -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>> }>;
export function settleWithinBudget(
  tasks: readonly Promise<unknown>[],
  budgetMs: number,
  emptyGraceMs = 12_000,
): Promise<PromiseSettledResult<unknown>[]> {
  if (tasks.length === 0) return Promise.resolve([]);

  if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
    return Promise.allSettled(tasks);
  }

  return new Promise((resolve) => {
    const results: Array<PromiseSettledResult<unknown> | undefined> = Array.from(
      { length: tasks.length },
      () => undefined,
    );
    let remaining = tasks.length;
    let finished = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (graceTimer) clearTimeout(graceTimer);

      const out = results.map((entry) => {
        if (entry) return entry;

        return {
          status: "rejected" as const,
          reason: new OsintTimeoutError(
            "Lookup timed out before results arrived. Try again.",
          ),
        };
      });

      resolve(out);
    };

    const tryFinishOnBudget = () => {
      if (finished) return;
      if (remaining === 0) {
        finish();

        return;
      }

      const fulfilledUseful = results.some(
        (entry) =>
          entry?.status === "fulfilled" &&
          entry.value != null &&
          !(
            typeof entry.value === "object" &&
            "count" in (entry.value as object) &&
            (entry.value as { count?: number }).count === 0
          ),
      );

      // Still empty while providers run — give them a grace window.
      if (
        !fulfilledUseful &&
        remaining > 0 &&
        Number.isFinite(emptyGraceMs) &&
        emptyGraceMs > 0
      ) {
        graceTimer = setTimeout(finish, emptyGraceMs);

        return;
      }

      finish();
    };

    const timer = setTimeout(tryFinishOnBudget, budgetMs);

    tasks.forEach((task, index) => {
      Promise.resolve(task).then(
        (value) => {
          if (finished) return;
          results[index] = { status: "fulfilled", value };
          remaining -= 1;
          if (remaining === 0) finish();
        },
        (reason) => {
          if (finished) return;
          results[index] = { status: "rejected", reason };
          remaining -= 1;
          if (remaining === 0) finish();
        },
      );
    });
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
  const raw =
    err instanceof Error && err.message.trim()
      ? err.message.trim()
      : "";

  return sanitizePublicError(raw, fallback ?? publicSearchError());
}

/**
 * Always return JSON. Timeouts → 504 (not opaque proxy 502 HTML).
 * When softEmpty is provided, prefer HTTP 200 empty/partial payload so the UI
 * never shows an opaque proxy 502 for a dead/slow upstream.
 */
export function osintFailureResponse(
  err: unknown,
  opts?: {
    softEmpty?: Record<string, unknown>;
    fallbackMessage?: string;
  },
): NextResponse {
  const message = osintErrorMessage(err, opts?.fallbackMessage);

  if (opts?.softEmpty) {
    return NextResponse.json({
      ...opts.softEmpty,
      message: isTimeoutLike(err)
        ? "Lookup timed out before results arrived. Try again."
        : isSoftProviderFailure(err)
          ? message
          : message || "Nothing found.",
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
