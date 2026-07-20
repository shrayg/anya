"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { CreditCard, RefreshCw, RotateCcw, XCircle } from "lucide-react";

import { apiFetch } from "@/lib/csrf-client";
import {
  formatPlanEndDate,
  getPlanDisplayLabel,
  type UserProfile,
  type UserStats,
} from "@/lib/account-plan";
import { AccountBillingNote } from "@/components/dashboard/account-stat-rail";

type CheckoutProvider = "square" | "oxapay";

export function AccountPlanBillingPanel({
  profile,
  stats,
  onUpdated,
}: {
  profile: UserProfile;
  stats: UserStats | null;
  onUpdated?: () => void;
}) {
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(
    Boolean(stats?.cancelAtPeriodEnd),
  );
  const [planEndsAt, setPlanEndsAt] = useState(stats?.planEndsAt ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRenewPicker, setShowRenewPicker] = useState(false);

  useEffect(() => {
    setCancelAtPeriodEnd(Boolean(stats?.cancelAtPeriodEnd));
    setPlanEndsAt(stats?.planEndsAt ?? null);
  }, [stats?.cancelAtPeriodEnd, stats?.planEndsAt]);

  const isPaid = profile.plan !== "free" && profile.plan !== undefined;
  const planLabel = getPlanDisplayLabel(profile);

  async function runAction(action: "cancel" | "resume") {
    setBusy(action);
    setMessage(null);
    setError(null);
    try {
      const res = await apiFetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setCancelAtPeriodEnd(Boolean(data.cancelAtPeriodEnd));
      if (typeof data.planEndsAt === "string" || data.planEndsAt === null) {
        setPlanEndsAt(data.planEndsAt);
      }
      setMessage(data.message ?? "Updated");
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function renew(provider: CheckoutProvider) {
    setBusy(`renew-${provider}`);
    setMessage(null);
    setError(null);
    try {
      const res = await apiFetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renew",
          provider,
          planId: profile.plan,
          interval:
            stats?.billingInterval ?? profile.billingInterval ?? "monthly",
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error ?? "Renewal failed");
      if (typeof data.url === "string" && data.url) {
        window.location.assign(data.url);

        return;
      }
      throw new Error("Checkout URL missing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Renewal failed");
      setBusy(null);
    }
  }

  if (!isPaid && !stats?.planEndsAt) {
    return (
      <section className="mb-8 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-sm font-semibold text-white">Plan & billing</h3>
        <p className="mt-1 text-xs text-zinc-500">
          You are on the free plan. Upgrade on Pricing for higher quotas and
          premium modules. Credits stay on your account for pay-per-use tools.
        </p>
        <div className="mt-4">
          <a className="anya-link-btn" href="/pricing">
            View plans
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="text-sm font-semibold text-white">Plan & billing</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Current access:{" "}
        <span className="capitalize text-zinc-300">{planLabel}</span>
        {stats?.billingInterval || profile.billingInterval
          ? ` · billed ${stats?.billingInterval ?? profile.billingInterval}`
          : null}
        {planEndsAt ? ` · period ends ${formatPlanEndDate(planEndsAt)}` : null}.
      </p>

      {cancelAtPeriodEnd ? (
        <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
          Cancellation scheduled. You keep access until{" "}
          {planEndsAt
            ? formatPlanEndDate(planEndsAt)
            : "the end of this period"}
          , then the account returns to Free. Renew anytime before then.
        </p>
      ) : null}

      <AccountBillingNote
        stats={stats ? { ...stats, cancelAtPeriodEnd, planEndsAt } : stats}
      />

      {message ? (
        <p className="mt-3 text-xs text-emerald-300">{message}</p>
      ) : null}
      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          className="h-10 border border-pink-300/35 bg-pink-500 text-sm font-semibold text-white shadow-lg shadow-pink-500/20"
          isDisabled={Boolean(busy)}
          isLoading={busy === "renew-square" || busy === "renew-oxapay"}
          startContent={<RefreshCw className="size-3.5" />}
          onPress={() => setShowRenewPicker(true)}
        >
          Renew plan
        </Button>

        {cancelAtPeriodEnd ? (
          <Button
            className="h-10 border border-white/15 bg-white/10 text-sm font-semibold text-white"
            isDisabled={Boolean(busy)}
            isLoading={busy === "resume"}
            startContent={<RotateCcw className="size-3.5" />}
            onPress={() => void runAction("resume")}
          >
            Undo cancel
          </Button>
        ) : (
          <Button
            className="h-10 border border-rose-400/30 bg-rose-500/10 text-sm font-semibold text-rose-100"
            isDisabled={Boolean(busy) || !isPaid}
            isLoading={busy === "cancel"}
            startContent={<XCircle className="size-3.5" />}
            onPress={() => {
              if (
                window.confirm(
                  "Cancel at period end? You keep access until the current period ends, then drop to Free. Crypto never auto-renews anyway.",
                )
              ) {
                void runAction("cancel");
              }
            }}
          >
            Cancel plan
          </Button>
        )}

        <a className="anya-link-btn" href="/pricing">
          Change plan / credits
        </a>
      </div>

      {showRenewPicker ? (
        <div
          aria-labelledby="renew-method-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <h3
              className="text-lg font-semibold text-white"
              id="renew-method-title"
            >
              Renew {planLabel}
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Card (Square) is required for recurring billing. Crypto (OxaPay)
              is a one-time payment — you will need to renew again next period.
            </p>
            <div className="mt-5 grid gap-3">
              <Button
                className="h-11 w-full border border-pink-300/40 bg-pink-500 text-sm font-semibold text-white"
                isDisabled={Boolean(busy)}
                isLoading={busy === "renew-square"}
                startContent={<CreditCard className="size-4" />}
                onPress={() => void renew("square")}
              >
                Renew with card
              </Button>
              <Button
                className="h-11 w-full border border-white/15 bg-white/10 text-sm font-semibold text-white"
                isDisabled={Boolean(busy)}
                isLoading={busy === "renew-oxapay"}
                onPress={() => void renew("oxapay")}
              >
                Renew with crypto
              </Button>
              <Button
                className="h-10 w-full text-sm text-zinc-400"
                variant="light"
                onPress={() => setShowRenewPicker(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
