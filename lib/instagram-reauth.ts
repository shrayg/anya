import "server-only";

import {
  loginInstagramWeb,
  loadInstagramCredentials,
} from "@/lib/instagram-login";
import {
  browserHeaders,
  getInstagramCsrfToken,
  getInstagramDispatcher,
  getInstagramSessionId,
} from "@/lib/instagram-search";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

let refreshInFlight: Promise<boolean> | null = null;
let lastRefreshAt = 0;
const MIN_REFRESH_GAP_MS = 60_000;

export function isInstagramAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /please wait a few minutes|require_login|not logged in|login_required|checkpoint|sessionid is not configured|unauthorized|401|challenge_required|user has been temporarily blocked/i.test(
    message,
  );
}

/**
 * Probe whether the current session cookie is accepted by Instagram.
 */
export async function probeInstagramSessionAlive(): Promise<boolean> {
  const sessionId = getInstagramSessionId();
  if (!sessionId) return false;
  const csrf = getInstagramCsrfToken() ?? "0";
  try {
    const response = await fetchWithTimeout(
      "https://www.instagram.com/api/v1/accounts/edit/web_form_data/",
      {
        headers: browserHeaders(undefined, sessionId, csrf),
        cache: "no-store",
        timeoutMs: 12_000,
        dispatcher: getInstagramDispatcher(),
      },
    );
    if (response.status === 401 || response.status === 403) return false;
    if (response.status === 429) return true;
    const text = await response.text();
    if (/require_login|login_required|Please wait a few minutes/i.test(text)) {
      return false;
    }
    return response.ok || response.status === 400;
  } catch {
    return false;
  }
}

/**
 * Ensure we have a live Instagram session. Re-logins with stored credentials if needed.
 */
export async function ensureInstagramSession(options?: {
  force?: boolean;
}): Promise<{ ok: boolean; refreshed: boolean; message?: string }> {
  const force = options?.force === true;

  if (!force) {
    const alive = await probeInstagramSessionAlive();
    if (alive) return { ok: true, refreshed: false };
  }

  if (!loadInstagramCredentials()) {
    return {
      ok: Boolean(getInstagramSessionId()),
      refreshed: false,
      message:
        "Instagram session is dead and no username/password is configured for auto-login.",
    };
  }

  if (refreshInFlight) {
    const ok = await refreshInFlight;
    return {
      ok,
      refreshed: ok,
      message: ok ? "Session refreshed." : "Refresh failed.",
    };
  }

  if (!force && Date.now() - lastRefreshAt < MIN_REFRESH_GAP_MS) {
    return {
      ok: false,
      refreshed: false,
      message: "Instagram login recently failed. Wait a minute before retrying.",
    };
  }

  refreshInFlight = (async () => {
    try {
      const result = await loginInstagramWeb();
      lastRefreshAt = Date.now();
      if (result.checkpoint || result.twoFactor) {
        console.warn("[instagram-reauth]", result.message);
        return false;
      }
      return Boolean(result.cookies.INSTAGRAM_SESSION_ID);
    } catch (error) {
      lastRefreshAt = Date.now();
      console.warn(
        "[instagram-reauth]",
        error instanceof Error ? error.message : error,
      );
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  const ok = await refreshInFlight;
  return {
    ok,
    refreshed: ok,
    message: ok
      ? "Instagram session refreshed via login."
      : "Instagram auto-login failed (checkpoint/2FA/bad credentials).",
  };
}

/**
 * Run an Instagram call; on auth failure, refresh session once and retry.
 */
export async function withInstagramSessionRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isInstagramAuthError(error)) throw error;
    const ensured = await ensureInstagramSession({ force: true });
    if (!ensured.ok) {
      throw new Error(
        ensured.message ||
          (error instanceof Error
            ? error.message
            : "Instagram session expired."),
      );
    }
    return operation();
  }
}
