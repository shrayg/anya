import { sanitizePublicText } from "@/lib/public-branding";

const INTERNAL_OPS_RE =
  /rate[\s-]?limit|too many requests|429\b|captcha|cloudflare|quota exceeded|provider (?:limit|blocked|unavailable)|temporarily blocked|per-minute|daily search limit|residential proxy|datacenter ips?|http\s*429|waf\b|access denied|upstream (?:error|timeout)|soft[\s-]?fail/i;

/**
 * True when a message is ops/provider noise that must never reach end users.
 */
export function isInternalOpsMessage(message: string): boolean {
  return INTERNAL_OPS_RE.test(message);
}

/**
 * User-panel safe copy. Rate limits / provider failures become a neutral line
 * (or empty when `omitInternal` is true).
 */
export function toUserFacingSearchMessage(
  message: string | null | undefined,
  opts?: {
    fallback?: string;
    /** Drop internal messages entirely instead of substituting fallback. */
    omitInternal?: boolean;
  },
): string {
  const raw = (message ?? "").trim();

  if (!raw) return opts?.fallback ?? "";

  if (isInternalOpsMessage(raw)) {
    if (opts?.omitInternal) return "";

    return (
      opts?.fallback ??
      "Search completed with limited coverage. Try again shortly."
    );
  }

  return sanitizePublicText(raw) || (opts?.fallback ?? "");
}
