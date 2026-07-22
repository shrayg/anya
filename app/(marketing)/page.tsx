"use client";

import { HomeBackground } from "@/components/home-background";
import { HomeSearch } from "@/components/home-search";
import { HomeShowcase } from "@/components/home-showcase";
import { IntelligenceModulesSection } from "@/components/intelligence-modules-section";
import ShinyText from "@/components/shiny-text";
import { Reveal } from "@/components/craft/reveal";
import { brandTitleClassName } from "@/config/branding";
import { siteConfig } from "@/config/site";

export default function Home() {
  return (
    <>
      <HomeBackground />

      {/* Keep our search hero */}
      <section className="relative z-20 flex min-h-[calc(100svh-5rem)] flex-col items-center justify-end gap-8 px-4 pb-[min(10svh,5rem)] pt-28 text-center md:gap-10 md:pb-[min(12svh,7rem)] md:pt-36">
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

      {/* Product story + Anya fan-out agent mock + honest scale stats */}
      <Reveal mode="mount">
        <HomeShowcase />
      </Reveal>

      <Reveal delay={0.08} mode="mount">
        <IntelligenceModulesSection />
      </Reveal>
    </>
  );
}
