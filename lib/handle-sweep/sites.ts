import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { HandleSweepSite } from "@/lib/handle-sweep/types";

let cached: HandleSweepSite[] | null = null;

function asErrorType(value: unknown): HandleSweepSite["errorType"] | null {
  if (value === "status_code" || value === "message" || value === "response_url") {
    return value;
  }

  return null;
}

function normalizeSite(
  name: string,
  raw: Record<string, unknown>,
): HandleSweepSite | null {
  const url = typeof raw.url === "string" ? raw.url : null;
  const errorType = asErrorType(raw.errorType);

  if (!url || !url.includes("{}") || !errorType) return null;

  const site: HandleSweepSite = {
    name,
    url,
    errorType,
  };

  if (typeof raw.urlMain === "string") site.urlMain = raw.urlMain;
  if (typeof raw.errorUrl === "string") site.errorUrl = raw.errorUrl;
  if (typeof raw.errorCode === "number") site.errorCode = raw.errorCode;
  if (typeof raw.regexCheck === "string") site.regexCheck = raw.regexCheck;

  if (typeof raw.errorMsg === "string") site.errorMsg = raw.errorMsg;
  else if (Array.isArray(raw.errorMsg)) {
    site.errorMsg = raw.errorMsg.filter((x): x is string => typeof x === "string");
  }

  return site;
}

export function getHandleSweepSites(): HandleSweepSite[] {
  if (cached) return cached;

  const path = join(process.cwd(), "data", "handle-sweep.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const sites: HandleSweepSite[] = [];

  for (const [name, value] of Object.entries(raw)) {
    if (name.startsWith("$")) continue;
    if (!value || typeof value !== "object") continue;
    const site = normalizeSite(name, value as Record<string, unknown>);

    if (site) sites.push(site);
  }

  if (sites.length === 0) {
    throw new Error("handle-sweep.json contained no valid sites");
  }

  cached = sites;

  return cached;
}

export function buildHandleSweepUrl(
  template: string,
  username: string,
): string | null {
  try {
    const url = template.split("{}").join(encodeURIComponent(username));
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}
