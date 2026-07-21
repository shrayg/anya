"use client";

import { HomeBackground } from "@/components/home-background";
import { HomeSearch } from "@/components/home-search";
import { IntelligenceModulesSection } from "@/components/intelligence-modules-section";
import { StatsSection } from "@/components/stats-section";
import ShinyText from "@/components/shiny-text";
import { brandTitleClassName } from "@/config/branding";
import { siteConfig } from "@/config/site";

export default function Home() {
  return (
    <>
      <HomeBackground />

      <section className="relative z-20 flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center gap-10 px-4 py-12 text-center">
        <div className="flex max-w-5xl flex-col items-center gap-6 overflow-visible">
          <ShinyText
            className={brandTitleClassName}
            data-splash-target
            disabled
            text={siteConfig.name}
          />
          <p className="max-w-3xl px-2 text-lg leading-8 text-gray-300 md:text-2xl md:leading-9">
            {siteConfig.tagline}. Create an account, run authorized lookups
            across exposure and social modules, and file intel into cases.
          </p>
        </div>

        <HomeSearch />
      </section>

      <StatsSection />
      <IntelligenceModulesSection />
    </>
  );
}
