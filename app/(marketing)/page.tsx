import { HomeSearch } from "@/components/home-search";
import {
  HomeAudiences,
  HomeFinalCta,
  HomeHowItWorks,
  HomeShowcase,
  HomeStatsStrip,
  HomeTrust,
} from "@/components/home-showcase";
import { IntelligenceModulesSection } from "@/components/intelligence-modules-section";
import ShinyText from "@/components/shiny-text";
import { Reveal } from "@/components/craft/reveal";
import { brandTitleClassName } from "@/config/branding";
import { siteConfig } from "@/config/site";
import { CATALOG_LANES, CATALOG_MODULE_COUNT } from "@/lib/featured-modules";
import { STARTER_MODULE_SLUGS } from "@/lib/plans";
import { getHubSections } from "@/lib/search-modules";

const HOME_LOCKED_MODULES = getHubSections()
  .flatMap((section) => section.items)
  .filter(
    (module) =>
      !module.comingSoon && !STARTER_MODULE_SLUGS.has(module.slug),
  )
  .map(({ name, slug }) => ({ name, slug }));

export default function Home() {
  return (
    <>
      <section className="home-hero relative z-20 flex min-h-[calc(100svh-5rem)] flex-col items-center justify-end gap-3 px-1 pb-[min(28svh,12rem)] pt-8 text-center sm:gap-4 sm:px-4 sm:pb-[min(34svh,15rem)] sm:pt-10 md:gap-5">
        <Reveal
          className="mb-2 flex max-w-5xl flex-col items-center gap-3 overflow-visible sm:mb-3 sm:gap-4 md:mb-4 md:gap-5"
          mode="mount"
        >
          <ShinyText
            data-splash-target
            disabled
            className={brandTitleClassName}
            text={siteConfig.navName}
          />
        </Reveal>

        <Reveal className="w-full max-w-[72rem]" delay={0.08} mode="mount">
          <HomeSearch lockedModules={HOME_LOCKED_MODULES} />
        </Reveal>
      </section>

      <HomeStatsStrip moduleCount={CATALOG_MODULE_COUNT} />
      <IntelligenceModulesSection
        catalogLanes={CATALOG_LANES}
        moduleCount={CATALOG_MODULE_COUNT}
      />

      <HomeShowcase />
      <HomeHowItWorks moduleCount={CATALOG_MODULE_COUNT} />
      <HomeAudiences />
      <HomeTrust />
      <HomeFinalCta />
    </>
  );
}
