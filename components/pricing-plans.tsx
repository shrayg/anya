"use client";

import { PricingPageContent } from "@/components/pricing-page-content";

/** @deprecated Prefer PricingPageContent on /pricing — kept for any old imports. */
export function PricingPlansGrid({
  className,
  onGetStarted,
}: {
  className?: string;
  onGetStarted?: () => void;
}) {
  void onGetStarted;

  return (
    <PricingPageContent
      className={className}
      authenticated={false}
    />
  );
}
