import { ArrowDownRight } from "lucide-react";

import { BrutalistReveal } from "@/components/brutalist-reveal";
import { HomeSearch } from "@/components/home-search";
import { IntelligenceModulesSection } from "@/components/intelligence-modules-section";
import {
  AiCrossReferenceScene,
  PremiumWorkspaceScene,
} from "@/components/landing-product-scenes";
import { CATALOG_LANES, CATALOG_MODULE_COUNT } from "@/lib/featured-modules";
import { STARTER_MODULE_SLUGS } from "@/lib/plans";
import { getHubSections } from "@/lib/search-modules";

const LANDING_LOCKED_MODULES = getHubSections()
  .flatMap((section) => section.items)
  .filter(
    (module) =>
      !module.comingSoon && !STARTER_MODULE_SLUGS.has(module.slug),
  )
  .map(({ name, slug }) => ({ name, slug }));

export function LandingExperience() {
  return (
    <div className="anya-landing">
      <section className="brutal-hero">
        <div className="brutal-hero-status brutal-hero-status--left">
          <span>ANYA / INTELLIGENCE BROKER</span>
          <span>ENTRY SEARCH: READY</span>
        </div>
        <div className="brutal-hero-status brutal-hero-status--right">
          <span>{CATALOG_MODULE_COUNT} LIVE MODULES</span>
          <span>PLATFORM: READY</span>
        </div>

        <div className="brutal-hero-copy">
          <p>[ UNIFIED INVESTIGATION ]</p>
          <h1>
            Every signal.
            <span>One picture.</span>
          </h1>
        </div>

        <div className="brutal-hero-search">
          <HomeSearch lockedModules={LANDING_LOCKED_MODULES} />
        </div>

        <a className="brutal-scroll-cue" href="#trace">
          Explore modules <ArrowDownRight className="size-4" />
        </a>
      </section>

      <IntelligenceModulesSection
        catalogLanes={CATALOG_LANES}
        moduleCount={CATALOG_MODULE_COUNT}
      />

      <section className="brutal-ai brutal-product-section" id="correlation">
        <BrutalistReveal>
          <header className="brutal-section-head">
            <p>[ 02 / AI CORRELATION ]</p>
            <h2>
              Search once.
              <span>Verify everywhere.</span>
            </h2>
          </header>
        </BrutalistReveal>
        <BrutalistReveal delay={80}>
          <AiCrossReferenceScene />
        </BrutalistReveal>
      </section>

      <section className="brutal-premium brutal-product-section" id="workspace">
        <BrutalistReveal>
          <header className="brutal-section-head">
            <p>[ 03 / PREMIUM PANEL ]</p>
            <h2>
              Every module.
              <span>One workspace.</span>
            </h2>
          </header>
        </BrutalistReveal>
        <BrutalistReveal delay={80}>
          <PremiumWorkspaceScene />
        </BrutalistReveal>
      </section>
    </div>
  );
}
