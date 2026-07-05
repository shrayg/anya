export type DiscordBadgeDef = {
  key: string;
  label: string;
  short: string;
  color: string;
  glow: string;
};

const BADGE_MAP: Record<string, DiscordBadgeDef> = {
  STAFF: {
    key: "STAFF",
    label: "Discord Staff",
    short: "STF",
    color: "#5865f2",
    glow: "rgba(88, 101, 242, 0.45)",
  },
  PARTNER: {
    key: "PARTNER",
    label: "Partnered Server Owner",
    short: "PTR",
    color: "#5865f2",
    glow: "rgba(88, 101, 242, 0.45)",
  },
  HYPESQUAD: {
    key: "HYPESQUAD",
    label: "HypeSquad Events",
    short: "HSE",
    color: "#f47fff",
    glow: "rgba(244, 127, 255, 0.4)",
  },
  HYPESQUAD_ONLINE_HOUSE_1: {
    key: "HYPESQUAD_ONLINE_HOUSE_1",
    label: "HypeSquad Bravery",
    short: "BRA",
    color: "#9c84ef",
    glow: "rgba(156, 132, 239, 0.4)",
  },
  HYPESQUAD_ONLINE_HOUSE_2: {
    key: "HYPESQUAD_ONLINE_HOUSE_2",
    label: "HypeSquad Brilliance",
    short: "BRI",
    color: "#f47b67",
    glow: "rgba(244, 123, 103, 0.4)",
  },
  HYPESQUAD_ONLINE_HOUSE_3: {
    key: "HYPESQUAD_ONLINE_HOUSE_3",
    label: "HypeSquad Balance",
    short: "BAL",
    color: "#45ddc0",
    glow: "rgba(69, 221, 192, 0.4)",
  },
  BUG_HUNTER_LEVEL_1: {
    key: "BUG_HUNTER_LEVEL_1",
    label: "Bug Hunter Level 1",
    short: "BH1",
    color: "#3ba55c",
    glow: "rgba(59, 165, 92, 0.4)",
  },
  BUG_HUNTER_LEVEL_2: {
    key: "BUG_HUNTER_LEVEL_2",
    label: "Bug Hunter Level 2",
    short: "BH2",
    color: "#3ba55c",
    glow: "rgba(59, 165, 92, 0.4)",
  },
  PREMIUM_EARLY_SUPPORTER: {
    key: "PREMIUM_EARLY_SUPPORTER",
    label: "Early Supporter",
    short: "ES",
    color: "#3ba55c",
    glow: "rgba(59, 165, 92, 0.4)",
  },
  EARLY_SUPPORTER: {
    key: "EARLY_SUPPORTER",
    label: "Early Supporter",
    short: "ES",
    color: "#3ba55c",
    glow: "rgba(59, 165, 92, 0.4)",
  },
  VERIFIED_DEVELOPER: {
    key: "VERIFIED_DEVELOPER",
    label: "Verified Developer",
    short: "DEV",
    color: "#5865f2",
    glow: "rgba(88, 101, 242, 0.45)",
  },
  CERTIFIED_MODERATOR: {
    key: "CERTIFIED_MODERATOR",
    label: "Certified Moderator",
    short: "MOD",
    color: "#5865f2",
    glow: "rgba(88, 101, 242, 0.45)",
  },
  ACTIVE_DEVELOPER: {
    key: "ACTIVE_DEVELOPER",
    label: "Active Developer",
    short: "AD",
    color: "#45ddc0",
    glow: "rgba(69, 221, 192, 0.4)",
  },
  PREMIUM: {
    key: "PREMIUM",
    label: "Nitro",
    short: "N",
    color: "#ff6fb1",
    glow: "rgba(255, 111, 177, 0.45)",
  },
  NITRO: {
    key: "NITRO",
    label: "Nitro",
    short: "N",
    color: "#ff6fb1",
    glow: "rgba(255, 111, 177, 0.45)",
  },
};

export function resolveDiscordBadges(rawBadges: string[]): DiscordBadgeDef[] {
  const seen = new Set<string>();
  const resolved: DiscordBadgeDef[] = [];

  for (const raw of rawBadges) {
    const key = raw.trim().toUpperCase().replace(/\s+/g, "_");
    const def = BADGE_MAP[key];

    if (!def || seen.has(def.key)) continue;

    seen.add(def.key);
    resolved.push(def);
  }

  for (const raw of rawBadges) {
    if (resolved.length > 0) break;

    const label = raw.trim();

    if (!label) continue;

    resolved.push({
      key: label,
      label,
      short: label.slice(0, 3).toUpperCase(),
      color: "#5865f2",
      glow: "rgba(88, 101, 242, 0.35)",
    });
  }

  return resolved;
}
