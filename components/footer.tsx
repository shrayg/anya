"use client";

import Image from "next/image";
import NextLink from "next/link";
import clsx from "clsx";

import { siteConfig } from "@/config/site";
import { siteLogoClassName, siteLogoSrc } from "@/config/branding";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative mt-20 w-full overflow-hidden border-t border-white/10 bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_0%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(ellipse_50%_40%_at_90%_100%,rgba(240,164,184,0.08),transparent_50%)]"
      />

      <div className="relative mx-auto max-w-7xl px-6 py-14 md:py-16">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)] md:items-start">
          <div className="max-w-md space-y-5">
            <div className="flex items-center gap-3">
              <Image
                src={siteLogoSrc}
                alt={`${siteConfig.name} logo`}
                width={40}
                height={40}
                unoptimized
                className={clsx(siteLogoClassName, "size-10")}
              />
              <p
                className={clsx(
                  "text-lg font-bold text-white",
                  "[font-family:var(--font-bruno-ace-sc)]",
                )}
              >
                {siteConfig.name}
              </p>
            </div>
            <p className="text-sm leading-6 text-zinc-400">
              {siteConfig.tagline}. Built for authorized investigative and
              security research use.
            </p>
            <p className="text-sm text-zinc-500">
              <a
                className="transition-colors hover:text-zinc-300"
                href={siteConfig.links.telegram}
                rel="noreferrer"
                target="_blank"
              >
                Telegram
              </a>
              <span className="mx-2 text-zinc-700">·</span>
              <NextLink
                className="transition-colors hover:text-zinc-300"
                href="/support"
              >
                Support
              </NextLink>
              <span className="mx-2 text-zinc-700">·</span>
              <NextLink
                className="transition-colors hover:text-zinc-300"
                href="/pricing"
              >
                Pricing
              </NextLink>
              <span className="mx-2 text-zinc-700">·</span>
              <NextLink
                className="transition-colors hover:text-zinc-300"
                href="/status"
              >
                Status
              </NextLink>
            </p>
          </div>

          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Legal
            </p>
            <ul className="space-y-3">
              {siteConfig.legalLinks.map((item) => (
                <li key={item.href}>
                  <NextLink
                    className="text-sm text-zinc-400 transition-colors hover:text-white"
                    href={item.href}
                  >
                    {item.label}
                  </NextLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-sm text-zinc-500" suppressHydrationWarning>
                © {currentYear} {siteConfig.legalEntityName}. All rights
                reserved.
              </p>
              <p className="max-w-2xl text-xs leading-5 text-zinc-600">
                Anya.Int is not a consumer reporting agency. Information returned
                must not be used for employment, tenant, credit, insurance, or
                any other FCRA-regulated decision.
              </p>
            </div>
            <p
              className={clsx(
                "shrink-0 text-sm font-semibold text-white/80",
                "[font-family:var(--font-bruno-ace-sc)]",
              )}
              suppressHydrationWarning
            >
              {siteConfig.name}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
