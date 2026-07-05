"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import clsx from "clsx";
import { CheckCircle } from "lucide-react";
import NextLink from "next/link";

import {
  getDisplayPrice,
  PLAN_DEFINITIONS,
  RELEASE_SALE,
} from "@/lib/plans";

type PricingPlansGridProps = {
  className?: string;
  onGetStarted?: () => void;
};

export function PricingPlansGrid({ className, onGetStarted }: PricingPlansGridProps) {
  return (
    <div className={clsx("mx-auto w-full", className)}>
      {RELEASE_SALE && (
        <p className="mb-6 text-center text-xs font-medium uppercase tracking-[0.2em] text-anya-accent">
          Release sale pricing active
        </p>
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_DEFINITIONS.map((plan, index) => {
          const price = getDisplayPrice(plan);

          return (
            <Card
              key={plan.id}
              className={clsx(
                "relative h-full min-w-0 overflow-visible border bg-white/5 backdrop-blur-md transition-all duration-300 hover:bg-white/10",
                index === 4 && "lg:col-start-2",
                plan.highlighted
                  ? "border-white/30 shadow-lg shadow-white/20 ring-1 ring-white/20"
                  : "border-white/10",
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2">
                  <span className="whitespace-nowrap rounded-full border border-white/50 bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                    Most Popular
                  </span>
                </div>
              )}

              <CardHeader className="flex flex-col gap-1 px-3 pb-0 pt-5">
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <p className="text-[11px] leading-4 text-gray-300">
                  {plan.description}
                </p>
              </CardHeader>

              <CardBody className="gap-3 px-3 pb-4">
                <div className="flex min-h-[2rem] flex-col justify-end">
                  {price.value === null ? (
                    <span className="text-2xl font-bold text-white">Custom</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {price.sale && price.original !== undefined && (
                        <span className="text-[10px] text-zinc-500 line-through">
                          ${price.original.toFixed(2)}/mo
                        </span>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold tabular-nums text-white">
                          ${price.label}
                        </span>
                        <span className="text-xs text-gray-400">/mo</span>
                      </div>
                    </div>
                  )}
                </div>

                <ul className="flex-grow space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-white/70" />
                      <span className="text-[11px] leading-4 text-gray-300">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  as={NextLink}
                  className={`mt-0.5 h-8 w-full border text-xs font-semibold backdrop-blur-sm transition-all duration-300 ${
                    plan.highlighted
                      ? "border-white/30 bg-white/20 text-white hover:bg-white/30"
                      : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  }`}
                  href={
                    plan.customPricing ? "/dashboard/support" : "/auth?action=register"
                  }
                  onClick={() => {
                    if (!plan.customPricing) onGetStarted?.();
                  }}
                  size="sm"
                >
                  {plan.customPricing ? "Contact Sales" : "Get Started"}
                </Button>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400">
          IntelX and Stealer Logs on Starter/Basic are billed at $0.25 per search
          from your balance.
        </p>
      </div>
    </div>
  );
}
