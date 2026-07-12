export type SearchTourStep = {
  id: string;
  title: string;
  body: string;
  target?: string;
  fallbackTargets?: string[];
};

export const HOME_SEARCH_TOUR_STORAGE_KEY = "anya-home-search-tour-v2";
export const WORKSPACE_SEARCH_TOUR_STORAGE_KEY = "anya-workspace-search-tour-v1";

export const HOME_SEARCH_TOUR_STEPS: SearchTourStep[] = [
  {
    id: "welcome",
    title: "How to search",
    body: "This short guide walks you through the search bar step by step. It only takes a moment.",
  },
  {
    id: "type-here",
    title: "Step 1 — Type what you want to find",
    body: "Click in this box and type your target. You can search an email, a username, a phone number, a website, or a Discord ID.",
    target: "[data-tour='home-search-input']",
    fallbackTargets: ["[data-tour='home-search']"],
  },
  {
    id: "examples",
    title: "Not sure what to type? Try these examples",
    body: "Email: jane@gmail.com · Username: MikeSmith2020 · Phone: 555-867-5309 · Dating profile link from Tinder or Bumble · Discord ID: a long number like 123456789012345678",
    target: "[data-tour='home-search-input']",
    fallbackTargets: ["[data-tour='home-search']"],
  },
  {
    id: "run",
    title: "Step 2 — Run your search",
    body: "When your text is in the box, click the Search button or press Enter on your keyboard. Wait a few seconds while we look.",
    target: "[data-tour='home-search-submit']",
    fallbackTargets: ["[data-tour='home-search-input']"],
  },
  {
    id: "results",
    title: "Step 3 — Read your results",
    body: "Matches appear below the search bar. Each card is a record we found — emails, passwords, profile links, and more. Click a card to see details.",
    target: "[data-tour='home-search-results']",
    fallbackTargets: ["[data-tour='home-search']", "[data-tour='home-search-input']"],
  },
  {
    id: "free-plan",
    title: "Free plan? Results may look blurred",
    body: "If you are on the Free plan, details are hidden until you upgrade. Paid plans show full results. You can still run searches to see that matches exist.",
  },
  {
    id: "done",
    title: "You are ready to search",
    body: "That is everything. Type something and hit Search. For dating apps, gaming, and dozens more modules, upgrade to Advanced for the full workspace.",
  },
];

export const WORKSPACE_SEARCH_TOUR_STEPS: SearchTourStep[] = [
  {
    id: "welcome",
    title: "How this search box works",
    body: "Each module has its own search box. This quick guide shows you how to run a lookup here.",
  },
  {
    id: "type-here",
    title: "Step 1 — Enter your target",
    body: "Type exactly what the hint above asks for — a username, email, phone number, wallet address, or other identifier for this module.",
    target: "[data-tour='search-input']",
    fallbackTargets: ["[data-tour='search-hub']"],
  },
  {
    id: "run",
    title: "Step 2 — Click Run",
    body: "Press the Run button (or Enter) to start. Results load on this page when the search finishes.",
    target: "[data-tour='search-submit']",
    fallbackTargets: ["[data-tour='search-input']"],
  },
  {
    id: "results",
    title: "Step 3 — Review and export",
    body: "Results appear below. You can export data, save findings to a case, or open another module from the sidebar for more pivots.",
    target: "[data-tour='search-results']",
    fallbackTargets: ["[data-tour='search-input']", "[data-tour='main-content']"],
  },
  {
    id: "done",
    title: "Ready when you are",
    body: "Pick a target, run the search, and follow the results. Use the sidebar to switch modules any time.",
  },
];

export function resolveSearchTourTarget(step: SearchTourStep): Element | null {
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
