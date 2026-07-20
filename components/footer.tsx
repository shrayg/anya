import Link from "next/link";

import { siteConfig } from "@/config/site";

const footerLinks = [
  { label: "Pricing", href: "/pricing" },
  { label: "Status", href: "/status" },
  { label: "Support", href: "/support" },
  { label: "Terms", href: "/terms" },
];

export const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="site-footer-brandline">
        <strong>{siteConfig.navName}</strong>
        <span>INTELLIGENCE BROKER</span>
      </div>

      <nav aria-label="Footer navigation" className="site-footer-links">
        {footerLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>

      <p className="site-footer-legal">
        © {new Date().getFullYear()} / AUTHORIZED USE ONLY
      </p>
    </footer>
  );
};
