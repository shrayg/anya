import "server-only";

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; error: string };

function siteKey(): string {
  return (
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
    process.env.TURNSTILE_SITE_KEY?.trim() ||
    ""
  );
}

function secretKey(): string {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || "";
}

/** True when both site + secret keys are configured. */
export function isTurnstileConfigured(): boolean {
  return Boolean(siteKey() && secretKey());
}

/**
 * Verify a Turnstile response token with Cloudflare siteverify.
 * When keys are unset: skip in development (with a log); in production
 * require keys only if either key is partially set (misconfig), otherwise skip.
 */
export async function verifyTurnstileToken(
  token: unknown,
  remoteIp?: string | null,
): Promise<TurnstileVerifyResult> {
  const secret = secretKey();
  const site = siteKey();

  if (!secret || !site) {
    if (process.env.NODE_ENV === "production" && (secret || site)) {
      console.error(
        "[turnstile] Partial Turnstile env — set both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY",
      );
      return { ok: false, error: "Bot protection is misconfigured." };
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[turnstile] Keys unset — skipping verification in non-production",
      );
    }
    return { ok: true };
  }

  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, error: "Complete the security check and try again." };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token.trim());
    if (remoteIp) body.set("remoteip", remoteIp);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      },
    );

    const data = (await response.json().catch(() => null)) as {
      success?: boolean;
      "error-codes"?: string[];
    } | null;

    if (!data?.success) {
      console.warn(
        "[turnstile] siteverify failed",
        data?.["error-codes"] ?? response.status,
      );
      return { ok: false, error: "Security check failed. Please try again." };
    }

    return { ok: true };
  } catch (error) {
    console.error("[turnstile] siteverify error:", error);
    return {
      ok: false,
      error: "Could not verify security check. Please try again.",
    };
  }
}

export function getTurnstileSiteKeyForClient(): string | null {
  const key = siteKey();
  return key || null;
}
