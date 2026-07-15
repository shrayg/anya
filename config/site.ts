export type SiteConfig = typeof siteConfig;

export type NavItem = {
  label: string;
  href: string;
  modal?: "partner" | "pricing";
  newTab?: boolean;
};

export const siteConfig = {
  name: "Anya.Int",
  navName: "Anya.Int",
  description: "Anya.Int | OSINT intelligence platform for investigators",
  tagline: "OSINT intelligence platform for investigators",
  defaultWorkspacePath: "/dashboard/search/ai-search",
  /** Replace with registered US entity name before treating policies as final. */
  legalEntityName: "Anya.Int",
  legalContactEmail: "support@anyaint.com",
  privacyContactEmail: "support@anyaint.com",
  governingLawState: "Delaware",
  navItems: [
    { label: "Pricing", href: "/pricing" },
    { label: "Partner", href: "#", modal: "partner" },
  ] as NavItem[],
  navMenuItems: [
    { label: "Pricing", href: "/pricing" },
    { label: "Partner", href: "#", modal: "partner" },
  ] as NavItem[],
  links: {
    telegram: "https://t.me/anyasearch",
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
