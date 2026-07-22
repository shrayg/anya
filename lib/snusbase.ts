/**
 * Direct Snusbase key detection (env-only).
 * Keep this file free of BreachHub/CSINT imports to avoid circular deps.
 */

export function hasSnusbaseDirect(): boolean {
  if (process.env.SNUSBASE_ENABLED === "false") return false;

  return Boolean(process.env.SNUSBASE_API_KEY?.trim());
}
