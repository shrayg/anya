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

      <section className="relative z-20 flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center gap-10 px-4 py-12 text-center">
        <HomeReturnReveal className="flex max-w-5xl flex-col items-center gap-6 overflow-visible">
          <ShinyText
            className={brandTitleClassName}
            data-splash-target
            disabled
            text={siteConfig.name}
          />
          <p className="max-w-2xl px-2 text-base leading-7 text-gray-300 md:text-lg md:leading-8">
            {siteConfig.tagline}. Create an account, run authorized lookups
            across exposure and social modules, and file intel into cases.
          </p>
        </HomeReturnReveal>

        <HomeReturnReveal delay={0.08}>
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
