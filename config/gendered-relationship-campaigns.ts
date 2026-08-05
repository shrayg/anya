export type RelationshipAudience = "men" | "women";

export type RelationshipCampaign = {
  id: string;
  slug: string;
  audience: RelationshipAudience;
  audienceLabel: string;
  ageBand: string;
  platformLane: "Paid-edgy" | "Organic-first";
  hook: string;
  eyebrow: string;
  inputKind: "phone" | "username";
  inputLabel: string;
  inputValue: string;
  profileName: string;
  profileAge: number;
  profileHandle: string;
  profileImage: string;
  profileDescriptor: string;
  stats: readonly [
    { label: string; value: string },
    { label: string; value: string },
    { label: string; value: string },
  ];
  resultTitle: string;
  payoff: string;
  cta: string;
  caption: string;
  headline: string;
  extraFormat?: "square";
};

const WOMAN_PROFILE = {
  profileName: "Maya Bennett",
  profileAge: 29,
  profileHandle: "@maya.bennett",
  profileImage: "/images/campaigns/relationship/fictional-maya-bennett.png",
  profileDescriptor: "Fictional adult profile",
} as const;

const MAN_PROFILE = {
  profileName: "Marcus Cole",
  profileAge: 31,
  profileHandle: "@marcus.cole",
  profileImage: "/images/campaigns/relationship/fictional-marcus-cole.png",
  profileDescriptor: "Fictional adult profile",
} as const;

const WOMEN_BASE = {
  audience: "women",
  audienceLabel: "Women evaluating a male partner's unexplained contact",
  ageBand: "25–54",
  platformLane: "Paid-edgy",
  inputKind: "phone",
  inputLabel: "PHONE NUMBER",
  inputValue: "+1 (646) 555-0147",
  ...WOMAN_PROFILE,
  stats: [
    { label: "PUBLIC PROFILES", value: "4" },
    { label: "HANDLE VARIANTS", value: "2" },
    { label: "CONNECTED SIGNALS", value: "7" },
  ],
  resultTitle: "See who the number connects to.",
  payoff: "One number. A clearer picture.",
  cta: "Check the number",
} as const;

const MEN_BASE = {
  audience: "men",
  audienceLabel: "Men evaluating a female partner's unexplained contact",
  ageBand: "25–54",
  platformLane: "Paid-edgy",
  inputKind: "phone",
  inputLabel: "PHONE NUMBER",
  inputValue: "+1 (917) 555-0136",
  ...MAN_PROFILE,
  stats: [
    { label: "PUBLIC PROFILES", value: "5" },
    { label: "HANDLE VARIANTS", value: "3" },
    { label: "CONNECTED SIGNALS", value: "8" },
  ],
  resultTitle: "See who the number connects to.",
  payoff: "One number. A clearer picture.",
  cta: "Check the number",
} as const;

export const GENDERED_RELATIONSHIP_CAMPAIGNS: RelationshipCampaign[] = [
  {
    ...WOMEN_BASE,
    id: "HER-01",
    slug: "women-who-is-he-texting-midnight",
    hook: "Who is he texting after midnight?",
    eyebrow: "START WITH THE NUMBER",
    caption:
      "A phone number can connect to public profiles, handles, and other context. Start with what you know and review the source trail in Anya.",
    headline: "See who the number connects to",
    extraFormat: "square",
  },
  {
    ...WOMEN_BASE,
    id: "HER-02",
    slug: "women-who-is-she-in-his-phone",
    hook: "Who is she in his phone?",
    eyebrow: "ONE NUMBER CAN CONNECT A NAME",
    caption:
      "The contact name is only one clue. Search the number and review the public profiles and handles that connect.",
    headline: "Look beyond the saved name",
  },
  {
    ...WOMEN_BASE,
    id: "HER-03",
    slug: "women-why-her-name-keeps-showing",
    hook: "Why does her name keep showing up?",
    eyebrow: "CHECK THE PUBLIC CONNECTIONS",
    caption:
      "When the same name keeps appearing, a public-source search can help you understand which profiles and identifiers connect.",
    headline: "Connect the public signals",
  },
  {
    ...WOMEN_BASE,
    id: "HER-04",
    slug: "women-is-he-talking-to-someone-else",
    hook: "Is he talking to someone else?",
    eyebrow: "FOLLOW THE PUBLIC SIGNALS",
    caption:
      "Anya connects public profile and contact signals so you can review the identity context without relying on a guess.",
    headline: "Start with the number",
  },
  {
    ...WOMEN_BASE,
    id: "HER-05",
    slug: "women-who-keeps-calling-him-back",
    hook: "Who keeps calling him back?",
    eyebrow: "START WITH THE CALLER",
    caption:
      "Search the phone number and review the public names, profiles, and related handles that appear in the source trail.",
    headline: "See what connects to the number",
  },
  {
    ...MEN_BASE,
    id: "HIM-01",
    slug: "men-who-is-she-texting-midnight",
    hook: "Who is she texting after midnight?",
    eyebrow: "START WITH THE NUMBER",
    caption:
      "A phone number can connect to public profiles, handles, and other context. Start with what you know and review the source trail in Anya.",
    headline: "See who the number connects to",
    extraFormat: "square",
  },
  {
    ...MEN_BASE,
    id: "HIM-02",
    slug: "men-who-is-he-in-her-phone",
    hook: "Who is he in her phone?",
    eyebrow: "ONE NUMBER CAN CONNECT A NAME",
    caption:
      "The contact name is only one clue. Search the number and review the public profiles and handles that connect.",
    headline: "Look beyond the saved name",
  },
  {
    ...MEN_BASE,
    id: "HIM-03",
    slug: "men-why-his-name-keeps-showing",
    hook: "Why does his name keep showing up?",
    eyebrow: "CHECK THE PUBLIC CONNECTIONS",
    caption:
      "When the same name keeps appearing, a public-source search can help you understand which profiles and identifiers connect.",
    headline: "Connect the public signals",
  },
  {
    ...MEN_BASE,
    id: "HIM-04",
    slug: "men-is-she-talking-to-someone-else",
    hook: "Is she talking to someone else?",
    eyebrow: "FOLLOW THE PUBLIC SIGNALS",
    caption:
      "Anya connects public profile and contact signals so you can review the identity context without relying on a guess.",
    headline: "Start with the number",
  },
  {
    ...MEN_BASE,
    id: "HIM-05",
    slug: "men-who-keeps-calling-her-back",
    hook: "Who keeps calling her back?",
    eyebrow: "START WITH THE CALLER",
    caption:
      "Search the phone number and review the public names, profiles, and related handles that appear in the source trail.",
    headline: "See what connects to the number",
  },
];

export const GENDERED_RELATIONSHIP_BY_SLUG = new Map(
  GENDERED_RELATIONSHIP_CAMPAIGNS.map((campaign) => [campaign.slug, campaign]),
);

export function getGenderedRelationshipCampaign(
  slug: string | null | undefined,
) {
  if (!slug) return null;

  return GENDERED_RELATIONSHIP_BY_SLUG.get(slug) ?? null;
}
