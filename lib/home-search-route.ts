import { isPhoneQuery } from "@/lib/search-modules";

export type HomeSearchRoute = {
  apiType: string;
  moduleSlug: string;
  scope?: string;
};

export function resolveHomeSearchRoute(query: string): HomeSearchRoute {
  const trimmed = query.trim();

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
