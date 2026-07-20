import "server-only";

import {
  getInstagramAccounts,
  type InstagramAccount,
} from "@/lib/instagram-accounts";

/**
 * Sticky-proxy session pool (Crawlee SessionPool pattern, Instagram-shaped).
 *
 * Rules:
 *  - Each account is permanently pinned to its own proxy URL (sticky).
 *  - Healthy accounts are chosen by least-recently-used.
 *  - Rate-limits put an account into a short cooldown.
 *  - HTML challenges / checkpoints put an account into a longer cooldown.
 *  - Repeated hard blocks retire the account until process restart (or
 *    explicit revive) so we stop burning a dying session.
 */

export type PoolAccountStatus = "healthy" | "cooling" | "retired";

export type InstagramFailureKind =
  | "rate_limit"
  | "challenge"
  | "auth"
  | "network"
  | "empty"
  | "other";

type PoolSlot = {
  label: string;
  status: PoolAccountStatus;
  consecutiveFailures: number;
  hardBlocks: number;
  cooldownUntil: number;
  lastUsedAt: number;
  lastSuccessAt: number;
  lastError?: string;
  lastFailureKind?: InstagramFailureKind;
};

const RATE_LIMIT_COOLDOWN_MS = 90_000;
const CHALLENGE_COOLDOWN_MS = 12 * 60_000;
const AUTH_COOLDOWN_MS = 5 * 60_000;
const NETWORK_COOLDOWN_MS = 20_000;
const RETIRE_AFTER_HARD_BLOCKS = 3;
const RETIRE_AFTER_CONSECUTIVE = 6;

const slots = new Map<string, PoolSlot>();
let activeLabel: string | null = null;

function now(): number {
  return Date.now();
}

function ensureSlots(): PoolSlot[] {
  const accounts = getInstagramAccounts();
  const labels = new Set(accounts.map((account) => account.label));

  for (const label of labels) {
    if (!slots.has(label)) {
      slots.set(label, {
        label,
        status: "healthy",
        consecutiveFailures: 0,
        hardBlocks: 0,
        cooldownUntil: 0,
        lastUsedAt: 0,
        lastSuccessAt: 0,
      });
    }
  }

  for (const label of [...slots.keys()]) {
    if (!labels.has(label)) slots.delete(label);
  }

  return accounts.map((account) => slots.get(account.label)!);
}

function thawIfReady(slot: PoolSlot): void {
  if (slot.status === "cooling" && slot.cooldownUntil <= now()) {
    slot.status = "healthy";
    slot.cooldownUntil = 0;
  }
}

function accountForLabel(label: string): InstagramAccount | null {
  return (
    getInstagramAccounts().find((account) => account.label === label) ?? null
  );
}

function pickHealthySlot(): PoolSlot | null {
  const pool = ensureSlots();

  if (pool.length === 0) return null;

  for (const slot of pool) thawIfReady(slot);

  const healthy = pool.filter((slot) => slot.status === "healthy");

  if (healthy.length === 0) {
    // Prefer the soonest-to-thaw cooling slot over a retired one.
    const cooling = pool
      .filter((slot) => slot.status === "cooling")
      .sort((a, b) => a.cooldownUntil - b.cooldownUntil);

    return cooling[0] ?? null;
  }

  healthy.sort((a, b) => a.lastUsedAt - b.lastUsedAt);

  return healthy[0] ?? null;
}

export function classifyInstagramFailure(
  status: number,
  bodyText: string,
  errorMessage?: string,
): InstagramFailureKind {
  const haystack = `${bodyText}\n${errorMessage ?? ""}`.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /require_login|login_required|not logged in|unauthorized|sessionid is not configured/.test(
      haystack,
    )
  ) {
    return "auth";
  }
  if (
    status === 429 ||
    /rate.?limit|please wait a few minutes|too many requests/.test(haystack)
  ) {
    return "rate_limit";
  }
  if (
    /checkpoint|challenge_required|html challenge|verify (it'?s|its) you|captcha|automated behaviou?r|user has been temporarily blocked/.test(
      haystack,
    ) ||
    (bodyText.trimStart().startsWith("<") && status >= 200)
  ) {
    return "challenge";
  }
  if (/network error|fetch failed|timed out|econnreset|socket/.test(haystack)) {
    return "network";
  }
  if (/empty response/.test(haystack)) return "empty";

  return "other";
}

export function getActivePoolAccount(): InstagramAccount | null {
  ensureSlots();
  if (activeLabel) {
    const slot = slots.get(activeLabel);

    if (slot) {
      thawIfReady(slot);
      if (slot.status === "healthy") {
        return accountForLabel(activeLabel);
      }
    }
  }

  const next = pickHealthySlot();

  if (!next) return null;
  if (next.status === "cooling" && next.cooldownUntil > now()) {
    // Nothing healthy yet — still hand back the soonest cooling account so
    // callers can wait / surface a useful error rather than "no session".
    return accountForLabel(next.label);
  }
  activeLabel = next.label;

  return accountForLabel(next.label);
}

/**
 * Mark the active (or named) account as just used and return it.
 * Creates sticky selection for the duration of a multi-page scrape when
 * possible — same account + same proxy for the whole pagination run.
 */
export function acquirePoolAccount(options?: {
  preferLabel?: string;
  forceRotate?: boolean;
}): InstagramAccount | null {
  ensureSlots();

  if (options?.forceRotate) {
    activeLabel = null;
  }

  if (options?.preferLabel && !options.forceRotate) {
    const preferred = slots.get(options.preferLabel);

    if (preferred) {
      thawIfReady(preferred);
      if (preferred.status === "healthy") {
        preferred.lastUsedAt = now();
        activeLabel = preferred.label;

        return accountForLabel(preferred.label);
      }
    }
  }

  const slot = pickHealthySlot();

  if (!slot) return null;

  if (slot.status === "cooling" && slot.cooldownUntil > now()) {
    const waitMs = slot.cooldownUntil - now();
    const account = accountForLabel(slot.label);

    if (!account) return null;
    // Expose wait via lastError so callers can message it.
    slot.lastError = `Account "${slot.label}" cooling for ${Math.ceil(waitMs / 1000)}s (${slot.lastFailureKind ?? "block"}).`;
    activeLabel = slot.label;
    slot.lastUsedAt = now();

    return account;
  }

  slot.lastUsedAt = now();
  activeLabel = slot.label;

  return accountForLabel(slot.label);
}

export function reportPoolSuccess(label?: string): void {
  const key = label ?? activeLabel;

  if (!key) return;
  const slot = slots.get(key);

  if (!slot) return;
  slot.status = "healthy";
  slot.consecutiveFailures = 0;
  slot.cooldownUntil = 0;
  slot.lastSuccessAt = now();
  slot.lastError = undefined;
  slot.lastFailureKind = undefined;
}

export function reportPoolFailure(
  kind: InstagramFailureKind,
  message: string,
  label?: string,
): { rotated: boolean; retired: boolean; cooldownMs: number } {
  const key = label ?? activeLabel;

  if (!key) return { rotated: false, retired: false, cooldownMs: 0 };

  const slot = slots.get(key);

  if (!slot) return { rotated: false, retired: false, cooldownMs: 0 };

  slot.consecutiveFailures += 1;
  slot.lastError = message.slice(0, 300);
  slot.lastFailureKind = kind;

  let cooldownMs = 0;
  const hard = kind === "challenge" || kind === "auth" || kind === "rate_limit";

  if (kind === "rate_limit") cooldownMs = RATE_LIMIT_COOLDOWN_MS;
  else if (kind === "challenge") cooldownMs = CHALLENGE_COOLDOWN_MS;
  else if (kind === "auth") cooldownMs = AUTH_COOLDOWN_MS;
  else if (kind === "network") cooldownMs = NETWORK_COOLDOWN_MS;
  else cooldownMs = 10_000;

  if (hard) slot.hardBlocks += 1;

  const shouldRetire =
    slot.hardBlocks >= RETIRE_AFTER_HARD_BLOCKS ||
    slot.consecutiveFailures >= RETIRE_AFTER_CONSECUTIVE ||
    (kind === "auth" && slot.hardBlocks >= 2);

  if (shouldRetire) {
    slot.status = "retired";
    slot.cooldownUntil = 0;
    console.warn(
      `[instagram-pool] retired account "${slot.label}" after ${slot.hardBlocks} hard blocks (${kind}): ${message.slice(0, 160)}`,
    );
  } else {
    slot.status = "cooling";
    slot.cooldownUntil = now() + cooldownMs;
    console.warn(
      `[instagram-pool] cooling account "${slot.label}" for ${Math.round(cooldownMs / 1000)}s (${kind})`,
    );
  }

  // Rotate away from the failing account.
  activeLabel = null;
  const next = pickHealthySlot();
  const rotated = Boolean(
    next && next.label !== key && next.status === "healthy",
  );

  if (next && next.status === "healthy") {
    activeLabel = next.label;
  }

  return { rotated, retired: shouldRetire, cooldownMs };
}

export function revivePoolAccount(label: string): boolean {
  const slot = slots.get(label);

  if (!slot) return false;
  slot.status = "healthy";
  slot.consecutiveFailures = 0;
  slot.hardBlocks = 0;
  slot.cooldownUntil = 0;
  slot.lastError = undefined;
  slot.lastFailureKind = undefined;

  return true;
}

export function getPoolSnapshot(): Array<{
  label: string;
  status: PoolAccountStatus;
  hasProxy: boolean;
  consecutiveFailures: number;
  hardBlocks: number;
  cooldownRemainingMs: number;
  lastError?: string;
  lastFailureKind?: InstagramFailureKind;
}> {
  const accounts = getInstagramAccounts();

  ensureSlots();

  return accounts.map((account) => {
    const slot = slots.get(account.label)!;

    thawIfReady(slot);

    return {
      label: account.label,
      status: slot.status,
      hasProxy: Boolean(account.proxyUrl),
      consecutiveFailures: slot.consecutiveFailures,
      hardBlocks: slot.hardBlocks,
      cooldownRemainingMs: Math.max(0, slot.cooldownUntil - now()),
      lastError: slot.lastError,
      lastFailureKind: slot.lastFailureKind,
    };
  });
}

export function msUntilPoolReady(): number {
  ensureSlots();
  const pool = [...slots.values()];

  for (const slot of pool) thawIfReady(slot);
  if (pool.some((slot) => slot.status === "healthy")) return 0;
  const cooling = pool.filter((slot) => slot.status === "cooling");

  if (cooling.length === 0) return -1;

  return Math.max(
    0,
    Math.min(...cooling.map((slot) => slot.cooldownUntil)) - now(),
  );
}
