"use client";

import { apiFetch } from "@/lib/csrf-client";

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
  BillingStatusBanner,
  billingStatusFromQuery,
  type BillingStatusKind,
} from "@/components/billing-status-banner";
import {
  ANNUAL_MONTHS_CHARGED,
  API_PRODUCT,
  CREDIT_PACKS,
  annualSavingsLabel,
  getApiPrice,
  getCompareAtPrice,
  getCreditPackTotal,
  getPlanPrice,
  getPricingPlans,
  type BillingInterval,
} from "@/lib/plans";

type PricingTab = "subscriptions" | "credits" | "api";

type PricingPageContentProps = {
  className?: string;
  authenticated?: boolean;
};

type CheckoutProvider = "square" | "oxapay";

type PendingCheckout = {
  body: Record<string, unknown>;
  id: string;
};


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
  const [billingStatus, setBillingStatus] = useState<BillingStatusKind | null>(
    null,
  );
  const [billingChecking, setBillingChecking] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(
    null,
  );

  function replaceBillingQuery(next: BillingStatusKind | null) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("billing", next);
    else url.searchParams.delete("billing");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function checkBillingConfirmation(options?: { silent?: boolean }) {
    if (!options?.silent) setBillingChecking(true);
    try {
      const res = await fetch("/api/billing/status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data?.confirmed) {
        setBillingStatus("success");
        replaceBillingQuery("success");
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      if (!options?.silent) setBillingChecking(false);
    }
  }

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("billing");
    const kind = billingStatusFromQuery(status);
    setBillingStatus(kind);

    if (kind !== "pending") return;

    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      const confirmed = await checkBillingConfirmation({ silent: true });
      if (confirmed || cancelled) return;
      // Keep polling briefly after crypto return; webhook may beat the browser.
      if (attempts < 40) {
        window.setTimeout(() => {
          void tick();
        }, attempts < 10 ? 2000 : 4000);
      }
    };

    void tick();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for return URL
  }, []);

  const plans = useMemo(() => getPricingPlans(), []);

  async function runCheckout(
    body: Record<string, unknown>,
    id: string,
    provider: CheckoutProvider,
  ) {
    setBusyId(id);
    setMessage(null);
    setError(null);
    setBillingStatus(null);
    setPendingCheckout(null);

    try {
      if (!authenticated) {
        if (body.type === "subscription" && typeof body.planId === "string") {
          const params = new URLSearchParams({
            action: "register",
            plan: body.planId,
            interval: String(
              (body.interval as BillingInterval) ?? "monthly",
            ),
            method: provider === "oxapay" ? "crypto" : "card",
          });
          router.push(`/auth?${params.toString()}`);
          return;
        }
        router.push("/auth?action=register");
        return;
      }

      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...body, provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Checkout failed");
      }
      if (typeof data.url === "string" && data.url) {
        window.location.assign(data.url);
        return;
      }
      setMessage(data.message ?? "Opening secure checkout…");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusyId(null);
    }
  }

  function requestCheckout(body: Record<string, unknown>, id: string) {
    setPendingCheckout({ body, id });
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

      {billingStatus ? (
        <BillingStatusBanner
          kind={billingStatus}
          onRefresh={
            billingStatus === "pending"
              ? () => {
                  void checkBillingConfirmation();
                }
              : undefined
          }
          refreshing={billingChecking}
        />
      ) : null}
      {!billingStatus && message ? (
        <p className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200">
          {message}
        </p>
      ) : null}
      {!billingStatus && error ? (
        <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {tab === "subscriptions" && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const price = getPlanPrice(plan, interval);
            const compareAt = getCompareAtPrice(plan, interval);
            const savings =
              interval === "annual" && plan.monthlyPrice
                ? annualSavingsLabel(plan.monthlyPrice)
                : null;

            return (
              <div
                key={plan.id}
                className={clsx(
                  "relative h-full",
                  plan.highlighted && "pt-3",
                )}
              >
                {plan.highlighted ? (
                  <span className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-indigo-300/50 bg-indigo-600 px-3 py-1 text-[10px] font-semibold tracking-wide text-white shadow-lg shadow-indigo-500/30">
                    Most Popular
                  </span>
                ) : null}

                <article
                  className={clsx(
                    "relative flex h-full flex-col rounded-2xl border bg-white/[0.04] p-5 backdrop-blur-md transition hover:bg-white/[0.07]",
                    plan.highlighted
                      ? "border-indigo-400/40 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/30"
                      : "border-white/10",
                  )}
                >
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  {plan.saleBadge && compareAt != null && (
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                      {plan.saleBadge}
                    </span>
                  )}
                </div>
                <p className="mt-1 min-h-[2.5rem] text-xs leading-5 text-zinc-400">
                  {plan.description}
                </p>

                <div className="mt-4 min-h-[3.25rem]">
                  {price.value === null ? (
                    <span className="text-3xl font-bold text-white">Custom</span>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-2">
                        {compareAt != null && (
                          <span className="text-lg tabular-nums text-zinc-500 line-through">
                            ${compareAt.toFixed(2)}
                          </span>
                        )}
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
                    requestCheckout(
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
              </div>
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
                      requestCheckout({ type: "credits", packId: pack.id }, pack.id)
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
                    requestCheckout(
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
        Pay with card (Square) or crypto (OxaPay). Need help choosing?{" "}
        <NextLink className="text-indigo-300 hover:underline" href="/support">
          Contact support
        </NextLink>
        .
      </p>

      {pendingCheckout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-method-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <h3
              className="text-lg font-semibold text-white"
              id="checkout-method-title"
            >
              Choose payment method
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Card checkout uses Square. Crypto invoices are powered by OxaPay and
              unlock after network confirmation.
            </p>
            <div className="mt-5 grid gap-3">
              <Button
                className="h-11 w-full border border-indigo-300/40 bg-indigo-500 text-sm font-semibold text-white"
                isDisabled={busyId === pendingCheckout.id}
                isLoading={busyId === pendingCheckout.id}
                onPress={() =>
                  void runCheckout(
                    pendingCheckout.body,
                    pendingCheckout.id,
                    "square",
                  )
                }
              >
                Pay with card
              </Button>
              <Button
                className="h-11 w-full border border-white/15 bg-white/10 text-sm font-semibold text-white"
                isDisabled={busyId === pendingCheckout.id}
                isLoading={busyId === pendingCheckout.id}
                onPress={() =>
                  void runCheckout(
                    pendingCheckout.body,
                    pendingCheckout.id,
                    "oxapay",
                  )
                }
              >
                Pay with crypto
              </Button>
              <button
                className="mt-1 text-sm text-zinc-500 hover:text-zinc-300"
                onClick={() => setPendingCheckout(null)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
