import { sanitizePublicText } from "@/lib/public-branding";

/**
 * Flatten combined IP lookup payloads into a public-safe shape.
 * Never expose upstream provider key names (osintcat / godseye / …).
 */
export function normalizeIpSearchPayload(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const osintcat =
    data.osintcat && typeof data.osintcat === "object"
      ? (data.osintcat as Record<string, unknown>)
      : null;

  const normalized: Record<string, unknown> = {
    query: data.query,
    sources: Array.isArray(data.sources)
      ? data.sources.map((s) =>
          typeof s === "string" ? sanitizePublicText(s) || "index" : s,
        )
      : data.sources,
  };

  if (osintcat?.ipleaks && typeof osintcat.ipleaks === "object") {
    normalized.ipleaks = osintcat.ipleaks;
  }

  if (osintcat?.ipinfo && typeof osintcat.ipinfo === "object") {
    normalized.ipinfo = osintcat.ipinfo;
  }

  if (!normalized.ipleaks && !normalized.ipinfo && osintcat) {
    Object.assign(normalized, osintcat);
  }

  // Prefer neutral key for merged index hits (legacy godseye payload shape).
  const indexHits = data.indexHits ?? data.godseye;

  if (indexHits) {
    normalized.indexHits = indexHits;
  }

  const errRaw =
    (typeof data.error === "string" && data.error) ||
    (typeof data.osintcatError === "string" && data.osintcatError) ||
    (typeof data.godseyeError === "string" && data.godseyeError) ||
    "";
  const err = sanitizePublicText(errRaw);

  if (err) {
    normalized.error = err;
  }

  return normalized;
}
