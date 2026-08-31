/**
 * Client helpers for homepage / paygate search resume after auth or checkout.
 */

export const SEARCH_RESUME_STORAGE_KEY = "anya:search-resume-v1";

export type SearchResumeState = {
  v: 1;
  vaultId: string;
  claimToken: string;
  mode?: string;
  query?: string;
  premiumModule?: string | null;
  blurReason?: "guest" | "free" | "premium_section" | "credits";
  moduleSlug?: string;
  savedAt: number;
};

export function saveSearchResume(state: Omit<SearchResumeState, "v" | "savedAt">) {
  if (typeof window === "undefined") return;

  const payload: SearchResumeState = {
    v: 1,
    savedAt: Date.now(),
    ...state,
  };

  try {
    sessionStorage.setItem(SEARCH_RESUME_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function readSearchResume(): SearchResumeState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(SEARCH_RESUME_STORAGE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as SearchResumeState;

    if (parsed?.v !== 1 || !parsed.vaultId || !parsed.claimToken) return null;

    // Drop resumes older than 24h.
    if (Date.now() - (parsed.savedAt || 0) > 24 * 60 * 60 * 1000) {
      clearSearchResume();

      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearSearchResume() {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(SEARCH_RESUME_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Allowlisted post-auth / post-checkout return paths. */
export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let decoded = raw;

  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  if (decoded.startsWith("/#search") || decoded === "/#search") return "/#search";
  if (decoded === "/" || decoded.startsWith("/?")) return decoded.split("#")[0] || "/";
  if (decoded.startsWith("/pricing")) return decoded;
  if (decoded.startsWith("/auth")) return null;
  if (decoded.startsWith("/go/cheating/")) return decoded.split("#")[0];

  // Absolute same-origin paths only.
  if (decoded.startsWith("/") && !decoded.startsWith("//")) {
    if (decoded.startsWith("/dashboard") || decoded.startsWith("/account")) {
      return decoded;
    }
  }

  return null;
}

export function buildAuthHref(opts: {
  action?: "login" | "register";
  next?: string;
}): string {
  const params = new URLSearchParams();
  params.set("action", opts.action ?? "register");

  if (opts.next) {
    params.set("next", opts.next);
  }

  return `/auth?${params.toString()}`;
}

export function buildPricingCreditsHref(opts: {
  vaultId?: string;
  returnTo?: string;
}): string {
  const params = new URLSearchParams();
  params.set("tab", "credits");

  if (opts.vaultId) params.set("vaultId", opts.vaultId);
  if (opts.returnTo) params.set("returnTo", opts.returnTo);

  return `/pricing?${params.toString()}`;
}
