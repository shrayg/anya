"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Code2, CreditCard, Mail, Sparkles } from "lucide-react";
import NextLink from "next/link";
import { SiTelegram } from "react-icons/si";

import { apiFetch } from "@/lib/csrf-client";
import {
  BillingStatusBanner,
  billingStatusFromQuery,
  type BillingStatusKind,
} from "@/components/billing-status-banner";
import AnimatedPrice from "@/components/animated-price";
import { SpecularButton } from "@/components/ui/specular-button";
import { siteConfig } from "@/config/site";
import {
  ANNUAL_MONTHS_CHARGED,
  ANNUAL_MONTHS_FREE,
  API_PRODUCT,
  CREDIT_PACKS,
  getApiPrice,
  getCompareAtPrice,
  getCreditPackTotal,
  getPlanLedgerRows,
  getPlanPrice,
  getPlanQuotaSummary,
  getPricingPlans,
  type BillingInterval,
} from "@/lib/plans";
import { toast } from "@/lib/toast";

const PAYMENT_CARD_BASE =
  "pricing-credit-card group relative flex h-full flex-col border p-6";
const PAYMENT_CARD_DEFAULT =
  "border-white/10 bg-white/[0.03] hover:border-white/20";
const PAYMENT_CARD_HIGHLIGHTED =
  "border-[var(--anya-blush)]/45 bg-gradient-to-b from-[color-mix(in_srgb,var(--anya-blush)_14%,transparent)] to-white/[0.03] shadow-[0_0_0_1px_color-mix(in_srgb,var(--anya-blush)_20%,transparent),0_24px_48px_-28px_rgba(0,0,0,0.75)]";

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
  const [pendingCheckout, setPendingCheckout] =
    useState<PendingCheckout | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [enterpriseContactOpen, setEnterpriseContactOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");

    if (tabParam === "credits" || tabParam === "api" || tabParam === "subscriptions") {
      setTab(tabParam);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setCreditBalance(null);

      return;
    }

    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.authenticated && typeof data.user?.balance === "number") {
          setCreditBalance(data.user.balance);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, [authenticated, billingStatus]);

  function replaceBillingQuery(next: BillingStatusKind | null) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);

    if (next) url.searchParams.set("billing", next);
    else url.searchParams.delete("billing");
    url.searchParams.delete("reason");
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  async function checkBillingConfirmation(options?: { silent?: boolean }) {
    if (!options?.silent) setBillingChecking(true);
    try {
      const res = await fetch("/api/billing/status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (data?.confirmed) {
        setBillingStatus("success");
        replaceBillingQuery("success");
        try {
          sessionStorage.setItem("anya:dashboard-unlock", "1");
        } catch {
          /* ignore */
        }
        toast.success("Payment confirmed", {
          description: "Your plan or credits are active.",
        });

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

    if (kind === "success") {
      try {
        sessionStorage.setItem("anya:dashboard-unlock", "1");
      } catch {
        /* ignore */
      }
      toast.success("Payment confirmed", {
        description: "Your plan or credits are active.",
      });
    }

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
        window.setTimeout(
          () => {
            void tick();
          },
          attempts < 10 ? 2000 : 4000,
        );
      }
    };

    void tick();

    return () => {
      cancelled = true;
    };
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
            interval: String((body.interval as BillingInterval) ?? "monthly"),
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
      <div className="pricing-control-strip mx-auto flex w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
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
                ? "bg-[var(--anya-blush)]/85 text-[#0c1019] shadow-lg shadow-[color-mix(in_srgb,var(--anya-blush)_28%,transparent)]"
                : "text-zinc-400 hover:text-white",
            )}
            type="button"
            onClick={() => setTab(id)}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {(tab === "subscriptions" || tab === "api") && (
        <div className="pricing-interval-strip mx-auto mt-3 flex w-fit rounded-2xl border border-white/10 bg-white/[0.04] p-0.5 backdrop-blur-xl">
          <button
            className={clsx(
              "pricing-interval-option rounded-xl px-3 py-1.5 text-xs font-medium transition",
              interval === "monthly"
                ? "bg-[var(--anya-blush)]/85 text-[#0c1019] shadow-lg shadow-[color-mix(in_srgb,var(--anya-blush)_28%,transparent)]"
                : "text-zinc-400 hover:text-white",
            )}
            type="button"
            onClick={() => setInterval("monthly")}
          >
            Monthly
          </button>
          <button
            className={clsx(
              "pricing-interval-option rounded-xl px-3 py-1.5 text-xs font-medium transition",
              interval === "annual"
                ? "bg-[var(--anya-blush)]/85 text-[#0c1019] shadow-lg shadow-[color-mix(in_srgb,var(--anya-blush)_28%,transparent)]"
                : "text-zinc-400 hover:text-white",
            )}
            type="button"
            onClick={() => setInterval("annual")}
          >
            Annual
            <span className="pricing-interval-saving ml-1.5 text-[10px] font-semibold text-emerald-400">
              {ANNUAL_MONTHS_FREE} months free
            </span>
          </button>
        </div>
      )}

      {billingStatus ? (
        <BillingStatusBanner
          kind={billingStatus}
          refreshing={billingChecking}
          onRefresh={
            billingStatus === "pending"
              ? () => {
                  void checkBillingConfirmation();
                }
              : undefined
          }
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

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={tab}
          animate={{ opacity: 1, y: 0 }}
          className="pricing-tab-panel overflow-visible pt-1"
          exit={{ opacity: 0, y: -8 }}
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "subscriptions" && (
            <div className="pricing-credit-grid mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan, index) => {
                const price = getPlanPrice(plan, interval);
                const compareAt = getCompareAtPrice(plan, interval);
                const heroPrice =
                  interval === "annual" && price.monthlyEquivalent != null
                    ? price.monthlyEquivalent
                    : price.value;
                const heroCompareAt =
                  compareAt != null && interval === "annual"
                    ? Number((compareAt / 12).toFixed(2))
                    : compareAt;
                const quotaSummary = getPlanQuotaSummary(plan);
                const ledgerRows = getPlanLedgerRows(plan);
                const unlimited = plan.dailySearchLimit === Infinity;

                return (
                  <article
                    key={plan.id}
                    className={clsx(
                      PAYMENT_CARD_BASE,
                      plan.highlighted
                        ? PAYMENT_CARD_HIGHLIGHTED
                        : PAYMENT_CARD_DEFAULT,
                    )}
                  >
                    {plan.highlighted ? (
                      <span className="absolute right-4 top-4 rounded-full bg-[var(--anya-blush)]/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0c1019]">
                        Popular
                      </span>
                    ) : null}

                    <div className="pricing-credit-head">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                        <Sparkles className="size-3 text-[var(--anya-blush)]" />
                        Plan {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold tracking-tight text-white">
                          {plan.name}
                        </h3>
                        {plan.saleBadge && heroCompareAt != null ? (
                          <span className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                            {plan.saleBadge}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-sm leading-snug text-zinc-400">
                        {plan.description}
                      </p>
                    </div>

                    <div className="pricing-credit-value mt-6">
                      {heroPrice === null ? (
                        <button
                          className="text-left text-4xl font-semibold tracking-tight text-white transition hover:text-[var(--anya-blush)]"
                          type="button"
                          onClick={() => setEnterpriseContactOpen(true)}
                        >
                          Custom
                        </button>
                      ) : (
                        <div className="flex items-baseline gap-1.5">
                          {heroCompareAt != null ? (
                            <AnimatedPrice
                              className="text-lg tabular-nums text-zinc-500 line-through"
                              duration={0.65}
                              value={heroCompareAt}
                            />
                          ) : null}
                          <AnimatedPrice
                            className="text-4xl font-semibold tracking-tight text-white tabular-nums"
                            duration={0.65}
                            value={heroPrice}
                          />
                          <span className="text-sm text-zinc-500">/mo</span>
                        </div>
                      )}
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-300">
                        <Sparkles className="size-3.5 shrink-0 text-[var(--anya-blush)]" />
                        <span
                          className={clsx(
                            "font-medium",
                            unlimited ? "text-emerald-400/90" : "text-white",
                          )}
                        >
                          {quotaSummary}
                        </span>
                      </p>
                    </div>

                    <ul className="pricing-credit-ledger mt-5 flex min-h-0 flex-1 flex-col space-y-2 border-t border-white/8 pt-4 text-sm text-zinc-400">
                      {ledgerRows.map((row) => (
                        <li
                          key={row.label}
                          className="flex items-center justify-between gap-3"
                        >
                          <span>{row.label}</span>
                          <strong
                            className={clsx(
                              "shrink-0 font-medium tabular-nums",
                              row.accent
                                ? "text-[var(--anya-blush)]"
                                : "text-white",
                            )}
                          >
                            {row.value}
                          </strong>
                        </li>
                      ))}
                    </ul>

                    <SpecularButton
                      accent={plan.highlighted}
                      autoAnimate={false}
                      className="mt-10 h-11 w-full shrink-0 text-sm font-semibold"
                      disabled={busyId === plan.id}
                      radius={999}
                      type="button"
                      onClick={() => {
                        if (plan.customPricing) {
                          setEnterpriseContactOpen(true);

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
                      {busyId === plan.id
                        ? "Working…"
                        : plan.customPricing
                          ? "Contact us"
                          : "Get Started"}
                    </SpecularButton>
                  </article>
                );
              })}
            </div>
          )}

          {tab === "credits" && (
            <div className="pricing-credit-view mt-10">
              <div className="pricing-credit-hero mx-auto mb-8 max-w-2xl text-center">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                  <Sparkles className="size-3.5 text-[var(--anya-blush)]" />
                  1 credit ≈ $1
                </div>
                <p className="pricing-credit-intro text-sm leading-relaxed text-zinc-400">
                  Top up once, spend across pay-per-use modules on Professional+
                  (Stealer Logs, and IntelX after the daily included quota).
                  Credits never expire
                  {creditBalance != null ? (
                    <>
                      {" "}
                      · your balance is{" "}
                      <span className="font-medium text-white tabular-nums">
                        {creditBalance % 1 === 0
                          ? creditBalance.toFixed(0)
                          : creditBalance.toFixed(2)}{" "}
                        credits
                      </span>
                    </>
                  ) : null}
                  .
                </p>
              </div>

              <div className="pricing-credit-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {CREDIT_PACKS.map((pack, index) => {
                  const total = getCreditPackTotal(pack);
                  const bonus = pack.bonusCredits ?? 0;

                  return (
                    <article
                      key={pack.id}
                      className={clsx(
                        PAYMENT_CARD_BASE,
                        pack.highlighted
                          ? PAYMENT_CARD_HIGHLIGHTED
                          : PAYMENT_CARD_DEFAULT,
                      )}
                    >
                      {pack.highlighted ? (
                        <span className="absolute right-4 top-4 rounded-full bg-[var(--anya-blush)]/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0c1019]">
                          Popular
                        </span>
                      ) : null}

                      <div className="pricing-credit-head">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                          <Sparkles className="size-3 text-[var(--anya-blush)]" />
                          Pack {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">
                          {pack.name}
                        </h3>
                        <p className="mt-1.5 text-sm leading-snug text-zinc-400">
                          {pack.description}
                        </p>
                      </div>

                      <div className="pricing-credit-value mt-6">
                        <div className="flex items-baseline gap-1.5">
                          <AnimatedPrice
                            className="text-4xl font-semibold tracking-tight text-white tabular-nums"
                            duration={0.65}
                            value={pack.price}
                          />
                          <span className="text-sm text-zinc-500">USD</span>
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-300">
                          <Sparkles className="size-3.5 shrink-0 text-[var(--anya-blush)]" />
                          <span className="tabular-nums font-medium text-white">
                            {total}
                          </span>{" "}
                          credits total
                          {bonus > 0 ? (
                            <span className="text-emerald-400/90">
                              · +{bonus} bonus
                            </span>
                          ) : null}
                        </p>
                      </div>

                      <ul className="pricing-credit-ledger mt-5 space-y-2 border-t border-white/8 pt-4 text-sm text-zinc-400">
                        <li className="flex items-center justify-between gap-3">
                          <span>Base credits</span>
                          <strong className="font-medium text-white tabular-nums">
                            {pack.credits}
                          </strong>
                        </li>
                        <li className="flex items-center justify-between gap-3">
                          <span>Bonus</span>
                          <strong className="font-medium text-white tabular-nums">
                            {bonus > 0 ? `+${bonus}` : "—"}
                          </strong>
                        </li>
                        <li className="flex items-center justify-between gap-3">
                          <span>You receive</span>
                          <strong className="font-medium text-[var(--anya-blush)] tabular-nums">
                            {total} credits
                          </strong>
                        </li>
                      </ul>

                      <SpecularButton
                        accent={pack.highlighted}
                        autoAnimate={false}
                        className="mt-10 h-11 w-full shrink-0 text-sm font-semibold"
                        disabled={busyId === pack.id}
                        radius={999}
                        type="button"
                        onClick={() =>
                          requestCheckout(
                            { type: "credits", packId: pack.id },
                            pack.id,
                          )
                        }
                      >
                        {busyId === pack.id
                          ? "Working…"
                          : `Buy ${total} credits`}
                      </SpecularButton>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "api" && (
            <div className="pricing-credit-view mt-10">
              {(() => {
                const price = getApiPrice(interval);
                const heroPrice =
                  interval === "annual"
                    ? price.monthlyEquivalent
                    : price.value;
                const apiLedger = [
                  { label: "REST OSINT modules", value: "Included" },
                  { label: "API key auth", value: "Included" },
                  { label: "Rate limits", value: "Higher" },
                  { label: "Usage analytics", value: "Included" },
                  { label: "Support", value: "Email" },
                ];

                return (
                  <div className="pricing-credit-grid mx-auto grid max-w-md grid-cols-1">
                    <article
                      className={clsx(
                        PAYMENT_CARD_BASE,
                        PAYMENT_CARD_HIGHLIGHTED,
                      )}
                    >
                      <span className="absolute right-4 top-4 rounded-full bg-[var(--anya-blush)]/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0c1019]">
                        API
                      </span>

                      <div className="pricing-credit-head">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                          <Code2 className="size-3 text-[var(--anya-blush)]" />
                          Product 01
                        </span>
                        <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">
                          {API_PRODUCT.name}
                        </h3>
                        <p className="mt-1.5 text-sm leading-snug text-zinc-400">
                          {API_PRODUCT.description}
                        </p>
                      </div>

                      <div className="pricing-credit-value mt-6">
                        <div className="flex items-baseline gap-1.5">
                          <AnimatedPrice
                            className="text-4xl font-semibold tracking-tight text-white tabular-nums"
                            duration={0.65}
                            value={heroPrice}
                          />
                          <span className="text-sm text-zinc-500">/mo</span>
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-300">
                          <Sparkles className="size-3.5 shrink-0 text-[var(--anya-blush)]" />
                          <span className="font-medium text-white">
                            Programmatic intelligence access
                          </span>
                        </p>
                      </div>

                      <ul className="pricing-credit-ledger mt-5 space-y-2 border-t border-white/8 pt-4 text-sm text-zinc-400">
                        {apiLedger.map((row) => (
                          <li
                            key={row.label}
                            className="flex items-center justify-between gap-3"
                          >
                            <span>{row.label}</span>
                            <strong className="shrink-0 font-medium text-white">
                              {row.value}
                            </strong>
                          </li>
                        ))}
                      </ul>

                      <SpecularButton
                        accent
                        autoAnimate={false}
                        className="mt-10 h-11 w-full shrink-0 text-sm font-semibold"
                        disabled={busyId === "api_access"}
                        radius={999}
                        type="button"
                        onClick={() =>
                          requestCheckout(
                            { type: "api_access", interval },
                            "api_access",
                          )
                        }
                      >
                        {busyId === "api_access"
                          ? "Working…"
                          : "Get API Access"}
                      </SpecularButton>
                      <p className="mt-3 text-center text-xs text-zinc-500">
                        API keys are issued after purchase confirmation. Contact
                        support for volume pricing.
                      </p>
                    </article>
                  </div>
                );
              })()}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <p className="mt-10 text-center text-xs text-zinc-500">
        Annual plans are billed as {ANNUAL_MONTHS_CHARGED} months upfront (
        {ANNUAL_MONTHS_FREE} months free). Pay with card (Square) or crypto
        (OxaPay). Need help choosing?{" "}
        <NextLink
          className="text-[var(--anya-blush)] hover:underline"
          href="/support"
        >
          Contact support
        </NextLink>
        .
      </p>

      {pendingCheckout && (
        <div
          aria-labelledby="checkout-method-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <h3
              className="text-lg font-semibold text-white"
              id="checkout-method-title"
            >
              Choose payment method
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Card checkout uses Square. Crypto invoices are powered by OxaPay
              and unlock after network confirmation.
            </p>
            <div className="mt-5 grid gap-3">
              <SpecularButton
                accent
                autoAnimate={false}
                className="h-11 w-full text-sm font-semibold"
                disabled={busyId === pendingCheckout.id}
                radius={999}
                type="button"
                onClick={() =>
                  void runCheckout(
                    pendingCheckout.body,
                    pendingCheckout.id,
                    "square",
                  )
                }
              >
                {busyId === pendingCheckout.id
                  ? "Working…"
                  : "Pay with card"}
              </SpecularButton>
              <SpecularButton
                autoAnimate={false}
                className="h-11 w-full text-sm font-semibold"
                disabled={busyId === pendingCheckout.id}
                radius={999}
                type="button"
                onClick={() =>
                  void runCheckout(
                    pendingCheckout.body,
                    pendingCheckout.id,
                    "oxapay",
                  )
                }
              >
                {busyId === pendingCheckout.id
                  ? "Working…"
                  : "Pay with crypto"}
              </SpecularButton>
              <button
                className="mt-1 text-sm text-zinc-500 hover:text-zinc-300"
                type="button"
                onClick={() => setPendingCheckout(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {enterpriseContactOpen ? (
        <div
          aria-labelledby="enterprise-contact-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          onClick={() => setEnterpriseContactOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              className="text-lg font-semibold text-white"
              id="enterprise-contact-title"
            >
              Enterprise is custom
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Team and agency pricing is handled directly. Reach out on Telegram
              or email and we&apos;ll set up the right plan.
            </p>
            <div className="mt-5 grid gap-3">
              <a
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--anya-blush)]/40 bg-[var(--anya-blush)] text-sm font-semibold text-[#0c1019] transition hover:brightness-110"
                href={siteConfig.links.telegram}
                rel="noreferrer"
                target="_blank"
              >
                <SiTelegram className="size-4" />
                Message on Telegram
              </a>
              <a
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 text-sm font-semibold text-white transition hover:bg-white/[0.14]"
                href={`mailto:${siteConfig.links.supportEmail}?subject=${encodeURIComponent("Enterprise pricing inquiry")}`}
              >
                <Mail className="size-4" />
                Email {siteConfig.links.supportEmail}
              </a>
              <button
                className="mt-1 text-sm text-zinc-500 hover:text-zinc-300"
                type="button"
                onClick={() => setEnterpriseContactOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
