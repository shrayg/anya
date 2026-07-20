"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";

import { Reveal } from "@/components/craft/reveal";
import { PricingPageContent } from "@/components/pricing-page-content";

export default function PricingPage() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => setAuthenticated(Boolean(data?.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  return (
    <section className="brutal-page brutal-pricing-page relative z-20 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <Reveal className="brutal-page-header mb-10 text-center">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
          <p className="anya-hero-kicker">
            <CreditCard className="size-3.5" />
            Plans & pricing
          </p>
          <span className="anya-pill">
            Choose the tier that fits your workflow
          </span>
        </div>
        <h1 className="font-[family-name:var(--font-bruno-ace-sc)] text-3xl tracking-wide text-white sm:text-5xl">
          Simple monthly pricing
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base">
          Subscriptions for investigators, credit packs for pay-per-use modules,
          and API access for automation — billed monthly or annually via Square.
        </p>
      </Reveal>

      <PricingPageContent authenticated={authenticated} />
    </section>
  );
}
