/**
 * Server-side teaser redaction for free/guest homepage search.
 * Preserves result shape/counts while replacing sensitive strings so
 * DevTools cannot trivially recover passwords / full PII.
 */

export const OSINT_TEASER_ROW_LIMIT = 12;

const KEEP_KEY_RE =
  /^(count|returned|totalMatches|total|start|source|query|message|error|hasGodsEyeReport|hasBreachVipResults|breachVipCount|csintCount|breachHubCount|osintCatCount|godseyeSearchCount|blurResults|teaser|moduleSlug|id|label|key|type|kind|status|checked|found|rateLimited|errors)$/i;

function maskString(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) return value;

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    const [local, domain] = trimmed.split("@");
    const [host, ...rest] = domain.split(".");
    const tld = rest.join(".") || "•••";

    return `${local.slice(0, 1)}••••@${host.slice(0, 1)}••••.${tld}`;
  }

  if (trimmed.length <= 2) return "••";

  return "•".repeat(Math.min(24, Math.max(4, trimmed.length)));
}

function redactNode(value: unknown, keyHint = ""): unknown {
  if (value == null) return value;

  if (typeof value === "string") {
    return KEEP_KEY_RE.test(keyHint) ? value : maskString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    const limited =
      keyHint === "credentials" ||
      keyHint === "results" ||
      keyHint === "items" ||
      keyHint === "accounts" ||
      keyHint === "leaks" ||
      keyHint === "fields"
        ? value.slice(0, OSINT_TEASER_ROW_LIMIT)
        : value;

    return limited.map((entry) => redactNode(entry, keyHint));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(record)) {
      if (key === "godseyeReport" && child && typeof child === "object") {
        out[key] = { teaser: true, available: true };
        continue;
      }

      if (key === "archives" && Array.isArray(child)) {
        out[key] = child.slice(0, OSINT_TEASER_ROW_LIMIT).map(() => ({
          teaser: true,
          credentials: [],
        }));
        continue;
      }

      out[key] = redactNode(child, key);
    }

    return out;
  }

  return value;
}

export type OsintTeaserOptions = {
  isGuest?: boolean;
};

export function redactOsintTeaser(
  data: unknown,
  _options: OsintTeaserOptions = {},
): unknown {
  return redactNode(data);
}
