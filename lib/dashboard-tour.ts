export type DashboardTourStep = {
  id: string;
  title: string;
  body: string;
  /** CSS selector; omit for centered welcome step */
  target?: string;
  /** Try these selectors if primary target is missing */
  fallbackTargets?: string[];
};

export const DASHBOARD_TOUR_STORAGE_KEY = "anya-dashboard-tour-v1";

export const DASHBOARD_TOUR_STEPS: DashboardTourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Anya",
    body: "Quick tour of the workspace — every search module, what it does, and where to run lookups. Takes under a minute.",
  },
  {
    id: "sidebar",
    title: "Search modules",
    body: "All lookups live in the sidebar, grouped by type. Use the filter box to jump to a module fast.",
    target: "[data-tour='sidebar-filter']",
    fallbackTargets: ["[data-tour='sidebar-scroll']"],
  },
  {
    id: "ai",
    title: "AI Intelligence",
    body: "AI Search, Deep Scan, Crypto AI, and Threat Brief — cross-source synthesis in one pass when your plan includes AI.",
    target: "[data-tour='section-ai']",
  },
  {
    id: "stealer",
    title: "Stealer & breach intel",
    body: "IntelX pulls, stealer logs, email breaches, and hash or password pivots across leak indexes.",
    target: "[data-tour='section-stealer']",
  },
  {
    id: "identity",
    title: "Identity & network",
    body: "Phone, username, and name searches. IP and domain modules add geolocation, stealer hits, and COMB breach data.",
    target: "[data-tour='section-identity']",
    fallbackTargets: ["[data-tour='section-network']"],
  },
  {
    id: "financial",
    title: "Financial & assets",
    body: "Crypto wallets, BIN and IBAN checks, US bank lookup, VIN decode, and insurance provider directories.",
    target: "[data-tour='section-financial']",
  },
  {
    id: "platforms",
    title: "Platform lookups",
    body: "Discord ID, Roblox, Minecraft, Steam, Telegram, Instagram, TikTok, Reddit, GitHub, FiveM, and more — each module has its own hints.",
    target: "[data-tour='section-platforms']",
  },
  {
    id: "dating",
    title: "Dating app lookups",
    body: "Tinder, Bumble, Hinge, Match, OkCupid, Plenty of Fish, Grindr, and Badoo — search handles and profile links across breach indexes.",
    target: "[data-tour='section-dating']",
    fallbackTargets: ["[data-tour='section-platforms']"],
  },
  {
    id: "search-input",
    title: "Intelligence input",
    body: "Open any module, enter your target (email, username, domain, Discord ID, wallet, etc.), then run the search. Results can be exported or saved to a case.",
    target: "[data-tour='search-input']",
    fallbackTargets: ["[data-tour='search-hub']", "[data-tour='main-content']"],
  },
  {
    id: "cases",
    title: "Cases & account",
    body: "Case ID files intel from searches. Admin Dashboard manages users and plans. Search hub lists every module as cards if you prefer browsing.",
    target: "[data-tour='case-id']",
    fallbackTargets: [
      "[data-tour='footer-admin']",
      "[data-tour='dashboard-dock']",
    ],
  },
];

export function resolveTourTarget(step: DashboardTourStep): Element | null {
  const selectors = [step.target, ...(step.fallbackTargets ?? [])].filter(
    Boolean,
  ) as string[];

  for (const selector of selectors) {
    const element = document.querySelector(selector);

    if (element instanceof HTMLElement) {
      const rect = element.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        return element;
      }
    }
  }

  return null;
}
