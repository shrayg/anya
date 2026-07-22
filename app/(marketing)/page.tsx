"use client";

import { HomeBackground } from "@/components/home-background";
import { HomeSearch } from "@/components/home-search";
import {
  HomeAudiences,
  HomeFinalCta,
  HomeHowItWorks,
  HomeShowcase,
  HomeStatsStrip,
} from "@/components/home-showcase";
import { IntelligenceModulesSection } from "@/components/intelligence-modules-section";
import ShinyText from "@/components/shiny-text";
import { Reveal } from "@/components/craft/reveal";
import { brandTitleClassName } from "@/config/branding";
import { siteConfig } from "@/config/site";

export default function Home() {
  return (
    <>
      <HomeBackground />

      <section className="relative z-20 flex min-h-[calc(100svh-5rem)] flex-col items-center justify-end gap-8 px-4 pb-[min(40svh,22rem)] pt-10 text-center md:gap-10">
        <Reveal
          className="flex max-w-5xl flex-col items-center gap-5 overflow-visible md:gap-6"
          mode="mount"
        >
          <ShinyText
            className={brandTitleClassName}
            data-splash-target
            disabled
            text={siteConfig.navName}
          />
          <p className="max-w-2xl px-2 text-sm leading-6 text-gray-300 md:text-base md:leading-7">
            {siteConfig.heroLede}
          </p>
        </Reveal>

        <Reveal className="w-full max-w-[72rem]" delay={0.08} mode="mount">
          <HomeSearch />
        </Reveal>
      </section>

      <Reveal mode="mount">
        <HomeShowcase />
      </Reveal>

      <Reveal delay={0.04} mode="mount">
        <HomeHowItWorks />
      </Reveal>

      <Reveal delay={0.06} mode="mount">
        <HomeAudiences />
      </Reveal>

      <Reveal delay={0.08} mode="mount">
        <HomeStatsStrip />
      </Reveal>

      <Reveal delay={0.1} mode="mount">
        <IntelligenceModulesSection />
      </Reveal>

      <Reveal delay={0.12} mode="mount">
        <HomeFinalCta />
      </Reveal>
    </>
  );
}
