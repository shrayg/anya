export type SiteConfig = typeof siteConfig;

export type NavItem = {
  label: string;
  href: string;
  newTab?: boolean;
};

export const siteConfig = {
  name: "Anya",
  navName: "Anya",
  description:
    "Anya | Look people up across socials, exposure, and public records",
  tagline: "Look people up. Connect the trail. Keep the file.",
  defaultWorkspacePath: "/dashboard/search/ai-search",
  /** Brand operator name used in legal copy (Snoop-style — no LLC string required on-site). */
  legalEntityName: "Anya",
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
    discord: "https://discord.gg/ZgHUpeYxr",
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
