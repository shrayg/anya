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
        <p className="pricing-sale-banner">
          Release sale pricing active
        </p>
      )}

      <div className="pricing-plans-grid">
        {PLAN_DEFINITIONS.map((plan) => {
          const price = getDisplayPrice(plan);

          return (
            <Card
              key={plan.id}
              className={clsx(
                "pricing-plan-card",
                plan.highlighted && "pricing-plan-card--highlighted",
              )}
            >
              {plan.highlighted && (
                <div className="pricing-plan-badge">
                  <span>Most Popular</span>
                </div>
              )}

              <CardHeader className="pricing-plan-header">
                <h3 className="pricing-plan-name">{plan.name}</h3>
                <p className="pricing-plan-description">{plan.description}</p>
              </CardHeader>

              <CardBody className="pricing-plan-body">
                <div className="pricing-plan-price">
                  {price.value === null ? (
                    <span className="pricing-plan-price-value">Custom</span>
                  ) : (
                    <div className="pricing-plan-price-stack">
                      {price.sale && price.original !== undefined && (
                        <span className="pricing-plan-price-original">
                          ${price.original.toFixed(2)}/mo
                        </span>
                      )}
                      <div className="pricing-plan-price-row">
                        <span className="pricing-plan-price-value">
                          ${price.label}
                        </span>
                        <span className="pricing-plan-price-period">/mo</span>
                      </div>
                    </div>
                  )}
                </div>

                <ul className="pricing-plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature} className="pricing-plan-feature">
                      <CheckCircle className="pricing-plan-feature-icon" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  as={NextLink}
                  className={clsx(
                    "pricing-plan-cta",
                    plan.highlighted && "pricing-plan-cta--highlighted",
                  )}
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

      <p className="pricing-footnote">
        IntelX and Stealer Logs on Starter/Basic are billed at $0.25 per search
        from your balance.
      </p>
    </div>
  );
}
