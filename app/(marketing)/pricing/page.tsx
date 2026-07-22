"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";

import { Reveal } from "@/components/craft/reveal";
import { HomeBackground } from "@/components/home-background";
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
    <>
      <HomeBackground />

      <section className="brutal-page brutal-pricing-page relative z-20 mx-auto w-full max-w-6xl px-2 pb-24 pt-2 md:pt-4">
        <Reveal mode="mount">
          <header className="brutal-page-header mb-12 space-y-5">
            <p className="craft-kicker">
              <CreditCard className="size-3.5" />
              Plans & pricing
            </p>
            <h1 className="craft-display text-4xl md:text-6xl">Pricing</h1>
            <p className="craft-lede">
              Subscriptions for investigators, credit packs at about $1 per
              credit, and API access for automation — billed monthly or annually
              via Square.
            </p>
          </header>
        </Reveal>

        <Reveal delay={0.08} mode="mount">
          <PricingPageContent authenticated={authenticated} />
        </Reveal>
      </section>
    </>
  );
}
