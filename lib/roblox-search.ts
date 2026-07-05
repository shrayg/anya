import type { DiscordProfile } from "@/lib/discord-profile";
import type { SanitizedBreachResponse } from "@/lib/osintcat";

export type LinkedDiscordProfile = {
  id: string;
  profile: DiscordProfile;
};

export type RobloxSearchResult = SanitizedBreachResponse & {
  query: string;
  linkedDiscordIds: string[];
  linkedDiscord?: LinkedDiscordProfile[];
};
