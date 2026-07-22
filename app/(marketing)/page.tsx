"use client";

import { HomeBackground } from "@/components/home-background";
import { HomeSearch } from "@/components/home-search";
import { IntelligenceModulesSection } from "@/components/intelligence-modules-section";
import { StatsSection } from "@/components/stats-section";
import ShinyText from "@/components/shiny-text";
import { HomeReturnReveal } from "@/components/craft/reveal";
import { brandTitleClassName } from "@/config/branding";
import { siteConfig } from "@/config/site";

export default function Home() {
  return (
    <>
      <HomeBackground />

      {/* One viewport on load — title + search pack under the nav; stats stay below */}
      <section className="relative z-20 flex min-h-[calc(100svh-5rem)] flex-col items-center justify-start gap-5 px-4 pb-16 pt-4 text-center md:gap-6 md:pt-8">
        <HomeReturnReveal className="flex max-w-5xl flex-col items-center gap-3 overflow-visible md:gap-4">
          <ShinyText
            className={brandTitleClassName}
            data-splash-target
            disabled
            text={siteConfig.navName}
          />
          <p className="max-w-2xl px-2 text-sm leading-6 text-gray-300 md:text-base md:leading-7">
            {siteConfig.tagline}. Create an account, run authorized lookups
            across exposure and social modules, and file intel into cases.
          </p>
        </HomeReturnReveal>

        <HomeReturnReveal className="w-full max-w-[72rem]" delay={0.08}>
          <HomeSearch />
        </HomeReturnReveal>
      </section>

      <HomeReturnReveal delay={0.14}>
        <StatsSection />
      </HomeReturnReveal>
      <HomeReturnReveal delay={0.2}>
        <IntelligenceModulesSection />
      </HomeReturnReveal>
    </>
  );
}
