/**
 * Manual module maintenance / repair overrides.
 *
 * Flip `active` to `false` (or remove the entry) when a module is repaired.
 * Optional env override without a code change:
 *   MODULE_MAINTENANCE_INSTAGRAM_LIVE=0
 *   MODULE_MAINTENANCE_HINGE_LIVE=0
 *
 * Keys use uppercase slug with `-` → `_` (e.g. hinge-live → HINGE_LIVE).
 */

export type ModuleMaintenanceEntry = {
  /** When true, module shows as down and Live searches are blocked. */
  active: boolean;
  message: string;
};

/**
 * Easy flip-back map — set `active: false` to restore a module.
 */
export const MODULE_MAINTENANCE_FLAGS: Record<string, ModuleMaintenanceEntry> =
  {
    "instagram-live": {
      active: true,
      message:
        "Instagram Live is currently down and being repaired. Please try again later.",
    },
    "hinge-live": {
      active: true,
      message:
        "Hinge Live is currently down and being repaired. Please try again later.",
    },
  };

/**
 * Dashboard module slugs whose status dots follow a Live maintenance flag.
 * (Instagram Live lives under the `instagram` module page.)
 */
const HEALTH_SLUG_ALIASES: Record<string, string> = {
  instagram: "instagram-live",
};

function envMaintenanceCleared(slug: string): boolean {
  const key = `MODULE_MAINTENANCE_${slug.replace(/-/g, "_").toUpperCase()}`;
  const raw = process.env[key]?.trim().toLowerCase();

  if (raw == null || raw === "") return false;

  return raw === "0" || raw === "false" || raw === "off" || raw === "no";
}

function resolveMaintenanceKey(slug: string): string | null {
  const normalized = (slug ?? "").trim().toLowerCase();

  if (!normalized) return null;
  if (normalized in MODULE_MAINTENANCE_FLAGS) return normalized;

  const alias = HEALTH_SLUG_ALIASES[normalized];

  if (alias && alias in MODULE_MAINTENANCE_FLAGS) return alias;

  return null;
}

/** True when this slug (or its Live alias) is under active maintenance. */
export function isModuleUnderMaintenance(
  slug: string | null | undefined,
): boolean {
  const key = resolveMaintenanceKey(slug ?? "");

  if (!key) return false;

  const entry = MODULE_MAINTENANCE_FLAGS[key];

  if (!entry?.active) return false;
  if (envMaintenanceCleared(key)) return false;

  return true;
}

/** User-facing repair message, or null when not under maintenance. */
export function getModuleMaintenanceMessage(
  slug: string | null | undefined,
): string | null {
  if (!isModuleUnderMaintenance(slug)) return null;

  const key = resolveMaintenanceKey(slug ?? "");

  if (!key) return null;

  return MODULE_MAINTENANCE_FLAGS[key]?.message ?? null;
}

/** Slugs that should force health `down` while maintenance is active. */
export function listActiveMaintenanceSlugs(): string[] {
  const out = new Set<string>();

  for (const [slug, entry] of Object.entries(MODULE_MAINTENANCE_FLAGS)) {
    if (!entry.active || envMaintenanceCleared(slug)) continue;
    out.add(slug);

    for (const [moduleSlug, alias] of Object.entries(HEALTH_SLUG_ALIASES)) {
      if (alias === slug) out.add(moduleSlug);
    }
  }

  return [...out];
}

/** Map of slug → message for health / status APIs. */
export function getActiveMaintenanceMap(): Record<string, string> {
  const out: Record<string, string> = {};

  for (const slug of listActiveMaintenanceSlugs()) {
    const message = getModuleMaintenanceMessage(slug);

    if (message) out[slug] = message;
  }

  return out;
}
