export function normalizeIpSearchPayload(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const osintcat =
    data.osintcat && typeof data.osintcat === "object"
      ? (data.osintcat as Record<string, unknown>)
      : null;

  const normalized: Record<string, unknown> = {
    query: data.query,
    sources: data.sources,
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

  if (data.godseye) {
    normalized.godseye = data.godseye;
  }

  if (data.osintcatError) {
    normalized.osintcatError = data.osintcatError;
  }

  if (data.godseyeError) {
    normalized.godseyeError = data.godseyeError;
  }

  return normalized;
}
