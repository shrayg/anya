"use client";

import Image from "next/image";
import { ShieldCheck, Users } from "lucide-react";

import { HomeBackground } from "@/components/home-background";
import { HomeSearch } from "@/components/home-search";
import { IntelligenceModulesSection } from "@/components/intelligence-modules-section";
import ShinyText from "@/components/shiny-text";
import {
  brandTitleClassName,
  siteLogoClassName,
  siteLogoSrc,
} from "@/config/branding";
import { siteConfig } from "@/config/site";

export default function Home() {
  return (
    <>
      <HomeBackground />

      <section className="relative z-20 flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center gap-8 py-12 text-center">
        <div className="flex max-w-4xl flex-col items-center gap-5 overflow-visible">
          <div className="flex flex-col items-center gap-4">
            <Image
              alt={`${siteConfig.name} logo`}
              className={siteLogoClassName}
              height={72}
              priority
              src={siteLogoSrc}
              unoptimized
              width={72}
            />
            <ShinyText
              className={brandTitleClassName}
              data-splash-target
              text={siteConfig.name}
            />
          </div>
          <p className="max-w-2xl px-4 text-base leading-7 text-gray-300 md:text-xl">
            {siteConfig.tagline}. Create an account, run authorized lookups
            across exposure and social modules, and file intel into cases.
          </p>
        </div>

        <HomeSearch />

        <div className="grid w-full max-w-3xl gap-3 px-2 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-xl">
            <ShieldCheck className="size-5 shrink-0 text-emerald-300" />
            <span className="text-sm text-gray-300">
              Register now to secure your username and start searching.
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-xl">
            <Users className="size-5 shrink-0 text-white" />
            <span className="text-sm text-gray-300">
              Discord, Roblox, breaches, stealer logs, and dozens more modules.
            </span>
          </div>
        </div>
      </section>

      <IntelligenceModulesSection />
    </>
  );
}
