"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import clsx from "clsx";
import {
  CheckCircle,
  Code2,
  CreditCard,
  Sparkles,
} from "lucide-react";
import NextLink from "next/link";

import {
  ANNUAL_MONTHS_CHARGED,
  API_PRODUCT,
  CREDIT_PACKS,
  annualSavingsLabel,
  getApiPrice,
  getCreditPackTotal,
  getPlanPrice,
  getPricingPlans,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";

type PricingTab = "subscriptions" | "credits" | "api";

type PricingPageContentProps = {
  className?: string;
  authenticated?: boolean;
};

function checkoutHref(plan: PlanId, interval: BillingInterval) {
  const params = new URLSearchParams({
    action: "register",
    plan,
    interval,
  });
  return `/auth?${params.toString()}`;
}

function billingStatusMessage(status: string | null): string | null {
  switch (status) {
    case "success":
      return "Payment successful. Your plan or credits are now active.";
    case "cancelled":
      return "Checkout cancelled. No charge was made.";
    case "error":
      return "Payment confirmation failed. If you were charged, contact support.";
    case "pending":
      return "Payment is still processing. Refresh in a moment or contact support.";
    default:
      return null;
  }
}

export function PricingPageContent({
  className,
  authenticated = false,
}: PricingPageContentProps) {
  const router = useRouter();
  const [tab, setTab] = useState<PricingTab>("subscriptions");
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("billing");
    const note = billingStatusMessage(status);
    if (note) {
      if (status === "success" || status === "cancelled") setMessage(note);
      else setError(note);
    }
  }, []);

  const plans = useMemo(() => getPricingPlans(), []);

  async function submitBilling(body: Record<string, unknown>, id: string) {
    setBusyId(id);
    setMessage(null);
    setError(null);

    try {
      if (!authenticated) {
        if (body.type === "subscription" && typeof body.planId === "string") {
          router.push(
            checkoutHref(body.planId as PlanId, (body.interval as BillingInterval) ?? "monthly"),
          );
          return;
        }
        router.push("/auth?action=register");
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Checkout failed");
      }
      if (typeof data.url === "string" && data.url) {
        window.location.assign(data.url);
        return;
      }
      setMessage(data.message ?? "Redirecting to Square…");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={clsx("mx-auto w-full max-w-6xl", className)}>
      <div className="mx-auto flex w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
        {(
          [
            { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
            { id: "credits", label: "Credits", icon: Sparkles },
            { id: "api", label: "API Access", icon: Code2 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={clsx(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              tab === id
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                : "text-zinc-400 hover:text-white",
            )}
            onClick={() => setTab(id)}
            type="button"
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {(tab === "subscriptions" || tab === "api") && (
        <div className="mx-auto mt-4 flex w-fit rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
          <button
            className={clsx(
              "rounded-xl px-5 py-2 text-sm font-medium transition",
              interval === "monthly"
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                : "text-zinc-400 hover:text-white",
            )}
            onClick={() => setInterval("monthly")}
            type="button"
          >
            Monthly
          </button>
          <button
            className={clsx(
              "rounded-xl px-5 py-2 text-sm font-medium transition",
              interval === "annual"
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                : "text-zinc-400 hover:text-white",
            )}
            onClick={() => setInterval("annual")}
            type="button"
          >
            Annual
            <span className="ml-2 text-xs font-semibold text-emerald-400">
              2 months free
            </span>
          </button>
        </div>
      )}

      {message && (
        <p className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      {tab === "subscriptions" && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const price = getPlanPrice(plan, interval);
            const savings =
              interval === "annual" && plan.monthlyPrice
                ? annualSavingsLabel(plan.monthlyPrice)
                : null;

            return (
              <article
                key={plan.id}
                className={clsx(
                  "relative flex h-full flex-col overflow-visible rounded-2xl border bg-white/[0.04] p-5 backdrop-blur-md transition hover:bg-white/[0.07]",
                  plan.highlighted
                    ? "border-indigo-400/40 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/30"
                    : "border-white/10",
                )}
              >
                {plan.highlighted && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-indigo-300/40 bg-indigo-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                    Most Popular
                  </span>
                )}

                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="mt-1 min-h-[2.5rem] text-xs leading-5 text-zinc-400">
                  {plan.description}
                </p>

                <div className="mt-4 min-h-[3.25rem]">
                  {price.value === null ? (
                    <span className="text-3xl font-bold text-white">Custom</span>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold tabular-nums text-white">
                          ${price.label}
                        </span>
                        <span className="text-sm text-zinc-400">
                          /{interval === "annual" ? "yr" : "mo"}
                        </span>
                      </div>
                      {interval === "annual" && price.monthlyEquivalent != null && (
                        <p className="mt-1 text-xs text-zinc-500">
                          ~${price.monthlyEquivalent.toFixed(2)}/mo · billed annually
                          {savings ? ` · ${savings}` : ""}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-indigo-300" />
                      <span className="text-xs leading-4 text-zinc-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={clsx(
                    "mt-5 h-10 w-full border text-sm font-semibold",
                    plan.highlighted
                      ? "border-indigo-300/40 bg-indigo-500 text-white"
                      : "border-white/15 bg-white/10 text-white",
                  )}
                  isDisabled={busyId === plan.id}
                  isLoading={busyId === plan.id}
                  onPress={() => {
                    if (plan.customPricing) {
                      router.push("/dashboard/support");
                      return;
                    }
                    void submitBilling(
                      {
                        type: "subscription",
                        planId: plan.id,
                        interval,
                      },
                      plan.id,
                    );
                  }}
                >
                  {plan.customPricing ? "Contact Sales" : "Get Started"}
                </Button>
              </article>
            );
          })}
        </div>
      )}

      {tab === "credits" && (
        <div className="mt-8">
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-zinc-400">
            Credits top up your account balance for pay-per-use modules like Stealer
            Logs (${0.25.toFixed(2)} / search). Credits never expire.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {CREDIT_PACKS.map((pack) => {
              const total = getCreditPackTotal(pack);
              return (
                <article
                  key={pack.id}
                  className={clsx(
                    "flex h-full flex-col rounded-2xl border bg-white/[0.04] p-5 backdrop-blur-md",
                    pack.highlighted
                      ? "border-indigo-400/40 shadow-lg shadow-indigo-500/20"
                      : "border-white/10",
                  )}
                >
                  <h3 className="text-lg font-bold text-white">{pack.name}</h3>
                  <p className="mt-1 text-xs text-zinc-400">{pack.description}</p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-white">${pack.price}</span>
                    <p className="mt-1 text-xs text-emerald-300">
                      ${total.toFixed(2)} credit applied
                      {pack.bonusCredits
                        ? ` (includes $${pack.bonusCredits.toFixed(2)} bonus)`
                        : ""}
                    </p>
                  </div>
                  <Button
                    className="mt-auto h-10 w-full border border-white/15 bg-white/10 text-sm font-semibold text-white"
                    isDisabled={busyId === pack.id}
                    isLoading={busyId === pack.id}
                    onPress={() =>
                      void submitBilling({ type: "credits", packId: pack.id }, pack.id)
                    }
                  >
                    Buy credits
                  </Button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {tab === "api" && (
        <div className="mt-8">
          {(() => {
            const price = getApiPrice(interval);
            return (
              <article className="mx-auto max-w-2xl rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/10 via-white/[0.04] to-transparent p-8 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/20 p-3">
                    <Code2 className="size-6 text-indigo-200" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{API_PRODUCT.name}</h3>
                    <p className="text-sm text-zinc-400">{API_PRODUCT.description}</p>
                  </div>
                </div>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">${price.label}</span>
                  <span className="text-sm text-zinc-400">
                    /{interval === "annual" ? "yr" : "mo"}
                  </span>
                </div>
                {interval === "annual" && (
                  <p className="mt-1 text-xs text-zinc-500">
                    ~${price.monthlyEquivalent.toFixed(2)}/mo · {ANNUAL_MONTHS_CHARGED} months
                    billed · {annualSavingsLabel(API_PRODUCT.monthlyPrice)}
                  </p>
                )}

                <ul className="mt-6 space-y-2">
                  {API_PRODUCT.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 size-4 shrink-0 text-indigo-300" />
                      <span className="text-sm text-zinc-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-8 h-11 w-full border border-indigo-300/40 bg-indigo-500 text-sm font-semibold text-white"
                  isDisabled={busyId === "api_access"}
                  isLoading={busyId === "api_access"}
                  onPress={() =>
                    void submitBilling(
                      { type: "api_access", interval },
                      "api_access",
                    )
                  }
                >
                  Get API Access
                </Button>
                <p className="mt-3 text-center text-xs text-zinc-500">
                  API keys are issued after purchase confirmation. Contact support for
                  volume pricing.
                </p>
              </article>
            );
          })()}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-zinc-500">
        Annual plans are billed as {ANNUAL_MONTHS_CHARGED} months upfront (2 months free).
        Need help choosing?{" "}
        <NextLink className="text-indigo-300 hover:underline" href="/dashboard/support">
          Contact support
        </NextLink>
        .
      </p>
    </div>
  );
}
