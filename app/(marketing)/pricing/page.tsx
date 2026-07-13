import { CreditCard } from "lucide-react";

import { HomeBackground } from "@/components/home-background";
import { PricingPlansGrid } from "@/components/pricing-plans";

export default function PricingPage() {
  return (
    <>
      <HomeBackground />

      <section className="relative z-20 py-10 md:py-14" id="pricing">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 md:mb-10">
            <span className="anya-hero-kicker">
              <CreditCard className="size-3.5" />
              Plans & pricing
            </span>
            <h1 className="mt-4 font-[family-name:var(--font-bruno-ace-sc)] text-3xl tracking-wide text-white sm:text-4xl">
              Simple monthly pricing
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
              Choose the tier that fits your workflow. Upgrade any time from your
              dashboard.
            </p>
          </div>

          <PricingPlansGrid />
        </div>
      </section>
    </>
  );
}
