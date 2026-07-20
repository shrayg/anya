import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { UsernameAccountSite } from "@/lib/username-accounts/types";

let cachedSites: UsernameAccountSite[] | null = null;

function isSite(value: unknown): value is UsernameAccountSite {
  if (!value || typeof value !== "object") return false;

  const row = value as Record<string, unknown>;

  return (
    typeof row.name === "string" &&
    typeof row.url === "string" &&
    row.url.includes("{}") &&
    typeof row.error_type === "string" &&
    typeof row.error_code === "number" &&
    typeof row.category === "string"
  );
}

function loadSitesFromDisk(): UsernameAccountSite[] {
  const path = join(process.cwd(), "data", "username-accounts.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;

  if (!Array.isArray(raw)) {
    throw new Error("username-accounts.json must be an array");
  }

  const sites = raw.filter(isSite);

  if (sites.length === 0) {
    throw new Error("username-accounts.json contained no valid sites");
  }

  return sites;
}

/** Cached platform list (process lifetime). */
export function getUsernameAccountSites(): UsernameAccountSite[] {
  if (!cachedSites) {
    cachedSites = loadSitesFromDisk();
  }

  return cachedSites;
}

export function filterUsernameAccountSites(
  category?: string | null,
): UsernameAccountSite[] {
  const sites = getUsernameAccountSites();
  const cat = category?.trim().toLowerCase();

  if (!cat) return sites;

  return sites.filter((site) => site.category.toLowerCase() === cat);
}

export function getUsernameAccountCategories(): string[] {
  const cats = new Set(
    getUsernameAccountSites().map((site) => site.category.toLowerCase()),
  );

  return [...cats].sort();
}

/** Build profile URL; returns null if the template is invalid. */
export function buildUsernameAccountUrl(
  template: string,
  username: string,
): string | null {
  if (!template.includes("{}")) return null;

  try {
    const url = template.replaceAll("{}", encodeURIComponent(username));
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}
