/**
 * Direct Snusbase key detection (env-only).
 * Keep this file free of BreachHub/CSINT imports to avoid circular deps
 * (provider-dedupe → snusbase; breachhub → provider-dedupe).
 */

export function getSnusbaseApiKey(): string | undefined {
  if (process.env.SNUSBASE_ENABLED === "false") return undefined;

  return process.env.SNUSBASE_API_KEY?.trim() || undefined;
}

export function getSnusbaseBaseUrl(): string {
  return (
    process.env.SNUSBASE_BASE_URL?.trim() || "https://breachhub.org"
  ).replace(/\/$/, "");
}

export function hasSnusbaseDirect(): boolean {
  return Boolean(getSnusbaseApiKey());
}
