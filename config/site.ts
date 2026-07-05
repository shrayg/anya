export type SiteConfig = typeof siteConfig;

export type NavItem = {
  label: string;
  href: string;
  modal?: "partner" | "pricing";
  newTab?: boolean;
};

export const siteConfig = {
  name: "Enkidu.Int",
  navName: "Enkidu.Int",
  description: "Enkidu.Int | OSINT intelligence platform for investigators",
  tagline: "OSINT intelligence platform for investigators",
  defaultWorkspacePath: "/dashboard/search/ai-search",
  navItems: [
    { label: "Pricing", href: "#", modal: "pricing" },
    { label: "Partner", href: "#", modal: "partner" },
  ] as NavItem[],
  navMenuItems: [
    { label: "Pricing", href: "#", modal: "pricing" },
    { label: "Partner", href: "#", modal: "partner" },
  ] as NavItem[],
  links: {
    telegram: "https://t.me/enkiduintelligence",
    supportEmail: "support@enkidu.int",
  },
};
