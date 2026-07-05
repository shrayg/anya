import Image from "next/image";
import { Link } from "@heroui/link";
import NextLink from "next/link";
import clsx from "clsx";

import { siteConfig } from "@/config/site";
import { siteLogoClassName, siteLogoSrc } from "@/config/branding";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-white/10 bg-black/40 backdrop-blur-md mt-16">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Image
                src={siteLogoSrc}
                alt={`${siteConfig.name} logo`}
                width={40}
                height={40}
                unoptimized
                className={clsx(
                  siteLogoClassName,
                  "size-10 hover:scale-105 transition-all duration-200 ease-in-out",
                )}
              />
              <p
                className={clsx(
                  "font-bold text-lg text-white hover:-rotate-6 transition-all duration-200 ease-in-out",
                  "[font-family:var(--font-bruno-ace-sc)]"
                )}
              >
                {siteConfig.name}
              </p>
            </div>
            <p className="text-gray-400 text-sm">
              {siteConfig.tagline}
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-white text-sm uppercase tracking-wider">
              Navigation
            </p>
            <ul className="space-y-2">
              {siteConfig.navItems
                .filter((item) => !item.modal)
                .map((item) => (
                <li key={item.href}>
                  <NextLink href={item.href}>
                    <span className="text-gray-400 hover:text-white transition-colors duration-200 text-sm">
                      {item.label}
                    </span>
                  </NextLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Additional Links */}
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-white text-sm uppercase tracking-wider">
              Resources
            </p>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.links.telegram}
                  rel="noreferrer"
                  target="_blank"
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Telegram
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.links.telegram}
                  rel="noreferrer"
                  target="_blank"
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-8"></div>

        {/* Footer Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-sm" suppressHydrationWarning>
            © {currentYear} {siteConfig.name}. All rights reserved.
          </p>
          <p
            className={clsx(
              "font-mono text-white text-sm font-semibold",
              "[font-family:var(--font-bruno-ace-sc)]",
            )}
            suppressHydrationWarning
          >
            {siteConfig.name} @ {currentYear}
          </p>
        </div>
      </div>
    </footer>
  );
};
