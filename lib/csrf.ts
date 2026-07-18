import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/csrf-constants";

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Paths that must not require browser CSRF (signed webhooks / cron secrets). */
export function isCsrfExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/billing/webhook") ||
    pathname.startsWith("/api/billing/oxapay/webhook") ||
    pathname.startsWith("/api/internal/")
  );
}

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa is available in Edge + Node; convert to base64url.
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Edge-safe token generation (Web Crypto). */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function csrfTokensMatch(
  cookieToken: string | undefined | null,
  headerToken: string | undefined | null,
): boolean {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length === 0 || cookieToken.length !== headerToken.length) {
    return false;
  }

  const enc = new TextEncoder();
  const a = enc.encode(cookieToken);
  const b = enc.encode(headerToken);
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

function shouldUseSecureCookies(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    try {
      const hostname = new URL(appUrl).hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return false;
      }
    } catch {
      // ignore invalid URL values
    }

    return appUrl.startsWith("https://");
  }

  return process.env.NODE_ENV === "production";
}

/**
 * Session cookies stay SameSite=Lax so Square/Cryptomus top-level return
 * redirects still attach the session. CSRF covers cross-site POST risk.
 */
export function csrfCookieOptions(maxAgeSeconds = 60 * 60 * 24) {
  return {
    httpOnly: false,
    secure: shouldUseSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
