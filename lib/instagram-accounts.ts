import "server-only";

/**
 * Instagram account pool + residential-proxy plumbing.
 *
 * A single datacenter IP hammering Instagram is the #1 cause of the
 * "human verification / challenge" HTML pages. We reduce that by:
 *   1. Routing traffic through a residential proxy (INSTAGRAM_PROXY_URL).
 *   2. Rotating between multiple logged-in sessions (INSTAGRAM_ACCOUNTS) so no
 *      single account/IP burns through its request budget.
 *   3. Sticky account↔proxy pairing with cooldown/retire lives in
 *      `instagram-session-pool.ts` (used by `instagram-http.ts`).
 *
 * Account 0 is always the primary env session (INSTAGRAM_SESSION_ID …), so the
 * existing single-account setup and auto-login keep working unchanged.
 */

export type InstagramAccount = {
  label: string;
  sessionId?: string;
  csrfToken?: string;
  dsUserId?: string;
  mid?: string;
  igDid?: string;
  datr?: string;
  proxyUrl?: string;
};

let activeIndex = 0;

function decodeMaybe(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes("%")) {
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function primaryAccount(): InstagramAccount {
  return {
    label: "primary",
    sessionId: decodeMaybe(process.env.INSTAGRAM_SESSION_ID),
    csrfToken: decodeMaybe(process.env.INSTAGRAM_CSRF_TOKEN),
    dsUserId: process.env.INSTAGRAM_DS_USER_ID?.trim() || undefined,
    mid: process.env.INSTAGRAM_MID?.trim() || undefined,
    igDid: process.env.INSTAGRAM_IG_DID?.trim() || undefined,
    datr: process.env.INSTAGRAM_DATR?.trim() || undefined,
    proxyUrl: process.env.INSTAGRAM_PROXY_URL?.trim() || undefined,
  };
}

function parseExtraAccounts(): InstagramAccount[] {
  const raw = process.env.INSTAGRAM_ACCOUNTS?.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const fallbackProxy = process.env.INSTAGRAM_PROXY_URL?.trim() || undefined;
  const accounts: InstagramAccount[] = [];

  parsed.forEach((rawEntry, index) => {
    if (!rawEntry || typeof rawEntry !== "object") return;
    const entry = rawEntry as Record<string, unknown>;

    const pick = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const value = entry[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return undefined;
    };

    const sessionId = decodeMaybe(pick("sessionId", "INSTAGRAM_SESSION_ID"));
    if (!sessionId) return;

    accounts.push({
      label: pick("label") ?? `account-${index + 2}`,
      sessionId,
      csrfToken: decodeMaybe(pick("csrfToken", "INSTAGRAM_CSRF_TOKEN")),
      dsUserId: pick("dsUserId", "INSTAGRAM_DS_USER_ID"),
      mid: pick("mid", "INSTAGRAM_MID"),
      igDid: pick("igDid", "INSTAGRAM_IG_DID"),
      datr: pick("datr", "INSTAGRAM_DATR"),
      proxyUrl: pick("proxyUrl", "INSTAGRAM_PROXY_URL") ?? fallbackProxy,
    });
  });

  return accounts;
}

/** All configured accounts (primary first). Rebuilt on each call so auto-login updates are picked up. */
export function getInstagramAccounts(): InstagramAccount[] {
  const accounts = [primaryAccount(), ...parseExtraAccounts()].filter(
    (account) => Boolean(account.sessionId),
  );
  return accounts;
}

export function getActiveInstagramAccount(): InstagramAccount | null {
  const accounts = getInstagramAccounts();
  if (accounts.length === 0) return null;
  return accounts[activeIndex % accounts.length] ?? accounts[0];
}

export function instagramAccountCount(): number {
  return getInstagramAccounts().length;
}

/**
 * Advance to the next account in the pool. Returns true if there is more than
 * one account (i.e. rotation actually changed something).
 *
 * Prefer `acquirePoolAccount({ forceRotate: true })` from
 * `instagram-session-pool` for cooldown-aware rotation; this remains as a
 * simple fallback used by older call sites.
 */
export function rotateInstagramAccount(): boolean {
  const count = getInstagramAccounts().length;
  if (count <= 1) return false;
  activeIndex = (activeIndex + 1) % count;
  return true;
}

export function resetInstagramAccountRotation(): void {
  activeIndex = 0;
}

/** Used by the session pool when it force-rotates, so both indexes stay aligned. */
export function setActiveInstagramAccountIndex(index: number): void {
  const count = getInstagramAccounts().length;
  if (count === 0) return;
  activeIndex = ((index % count) + count) % count;
}

export function findInstagramAccountIndex(label: string): number {
  return getInstagramAccounts().findIndex((account) => account.label === label);
}
