import type { HomeSearchRoute } from "@/lib/home-search-route";

export type StarterSearchMode = "email" | "phone" | "username" | "discord";

export const STARTER_SEARCH_MODES: {
  id: StarterSearchMode;
  label: string;
  placeholder: string;
}[] = [
  {
    id: "email",
    label: "Email",
    placeholder: "name@domain.com",
  },
  {
    id: "phone",
    label: "Phone",
    placeholder: "+1 555 123 4567",
  },
  {
    id: "username",
    label: "Username",
    placeholder: "username",
  },
  {
    id: "discord",
    label: "Discord",
    placeholder: "123456789012345678",
  },
];

export function resolveStarterSearchRoute(
  mode: StarterSearchMode,
  query: string,
): HomeSearchRoute {
  const trimmed = query.trim();

  switch (mode) {
    case "email":
      return { apiType: "breaches", moduleSlug: "breaches" };
    case "phone":
      return { apiType: "breach", moduleSlug: "phone", scope: "phone" };
    case "discord":
      return { apiType: "discord", moduleSlug: "discord-id" };
    case "username":
    default:
      return {
        apiType: "breach",
        moduleSlug: "username",
        scope: "username",
        searchQuery: trimmed.replace(/^@/, ""),
      };
  }
}
