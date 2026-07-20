export type SiteConfig = typeof siteConfig;

export type NavItem = {
  label: string;
  href: string;
  newTab?: boolean;
};

export const siteConfig = {
  name: "Anya.Int",
  navName: "Anya.Int",
  description: "Anya.Int | OSINT intelligence platform for investigators",
  tagline: "OSINT intelligence platform for investigators",
  defaultWorkspacePath: "/dashboard/search/ai-search",
  /** Brand operator name used in legal copy (Snoop-style — no LLC string required on-site). */
  legalEntityName: "Anya.Int",
  legalContactEmail: "support@anyaint.com",
  privacyContactEmail: "support@anyaint.com",
  governingLawState: "Delaware",
  navItems: [
    { label: "Home", href: "/" },
    { label: "Pricing", href: "/pricing" },
    { label: "Status", href: "/status" },
    { label: "Support", href: "/support" },
  ] as NavItem[],
  navMenuItems: [
    { label: "Home", href: "/" },
    { label: "Pricing", href: "/pricing" },
    { label: "Status", href: "/status" },
    { label: "Support", href: "/support" },
  ] as NavItem[],
  links: {
    telegram: "https://t.me/anyaintel",
    supportEmail: "support@anyaint.com",
  },
  legalLinks: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Acceptable Use", href: "/acceptable-use" },
    { label: "Refund Policy", href: "/refund" },
    { label: "Do Not Sell or Share", href: "/do-not-sell" },
    { label: "FAQ", href: "/faq" },
  ] as const,
};
