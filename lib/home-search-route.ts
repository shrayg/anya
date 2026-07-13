import { detectDatingAppFromQuery, normalizeDatingQuery } from "@/lib/dating-search";
import { isPhoneQuery } from "@/lib/search-modules";

export type HomeSearchRoute = {
  apiType: string;
  moduleSlug: string;
  scope?: string;
  /** Normalized query sent to the API (e.g. handle extracted from a profile URL). */
  searchQuery?: string;
};

export function resolveHomeSearchRoute(query: string): HomeSearchRoute {
  const trimmed = query.trim();
  const datingSlug = detectDatingAppFromQuery(trimmed);

  if (datingSlug) {
    return {
      apiType: "breach",
      moduleSlug: datingSlug,
      scope: datingSlug,
      searchQuery: normalizeDatingQuery(trimmed, datingSlug),
    };
  }

  if (isPhoneQuery(trimmed)) {
    return { apiType: "breach", moduleSlug: "phone", scope: "phone" };
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { apiType: "breaches", moduleSlug: "breaches" };
  }

  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    return { apiType: "ip", moduleSlug: "ip" };
  }

  if (/^\d{17,20}$/.test(trimmed)) {
    return { apiType: "discord", moduleSlug: "discord-id" };
  }

  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return { apiType: "dns", moduleSlug: "domain" };
  }

  return { apiType: "breach", moduleSlug: "username", scope: "username" };
}
