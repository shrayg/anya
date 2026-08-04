"use client";

import { useEffect, useState } from "react";
import { CreditCard, RefreshCw, RotateCcw, XCircle } from "lucide-react";

import { apiFetch } from "@/lib/csrf-client";
import {
  formatPlanEndDate,
  getPlanDisplayLabel,
  type UserProfile,
  type UserStats,
} from "@/lib/account-plan";
import { AccountBillingNote } from "@/components/dashboard/account-stat-rail";
import { SpecularButton } from "@/components/ui/specular-button";

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
      <section className="account-card account-billing">
        <header className="account-card-head">
          <h2>Plan & billing</h2>
          <p>
            You are on the free plan. Upgrade on Pricing for higher quotas and
            premium modules. Credits stay on your account for pay-per-use tools.
          </p>
        </header>
        <div className="account-billing-actions">
          <a className="account-btn-primary" href="/pricing">
            View plans
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="account-card account-billing">
      <header className="account-card-head">
        <h2>Plan & billing</h2>
        <p>
          Current access:{" "}
          <span className="capitalize text-zinc-300">{planLabel}</span>
          {stats?.billingInterval || profile.billingInterval
            ? ` · billed ${stats?.billingInterval ?? profile.billingInterval}`
            : null}
          {planEndsAt ? ` · period ends ${formatPlanEndDate(planEndsAt)}` : null}
          .
        </p>
      </header>

      {cancelAtPeriodEnd ? (
        <p className="account-billing-alert">
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

      <div className="account-billing-actions">
        <SpecularButton
          accent
          className="h-10 text-sm font-semibold"
          disabled={Boolean(busy)}
          size="sm"
          type="button"
          onClick={() => setShowRenewPicker(true)}
        >
          <RefreshCw className="size-3.5" />
          {busy === "renew-square" || busy === "renew-oxapay"
            ? "Working…"
            : "Renew plan"}
        </SpecularButton>

        {cancelAtPeriodEnd ? (
          <SpecularButton
            className="h-10 text-sm font-semibold"
            disabled={Boolean(busy)}
            size="sm"
            type="button"
            onClick={() => void runAction("resume")}
          >
            <RotateCcw className="size-3.5" />
            {busy === "resume" ? "Working…" : "Undo cancel"}
          </SpecularButton>
        ) : (
          <button
            className="dash-btn dash-btn-danger h-10 text-sm font-semibold"
            disabled={Boolean(busy) || !isPaid}
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Cancel at period end? You keep access until the current period ends, then drop to Free. Crypto never auto-renews anyway.",
                )
              ) {
                void runAction("cancel");
              }
            }}
          >
            <XCircle className="size-3.5" />
            {busy === "cancel" ? "Working…" : "Cancel plan"}
          </button>
        )}

        <a className="account-btn-ghost" href="/pricing">
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
              <SpecularButton
                accent
                className="h-11 w-full text-sm font-semibold"
                disabled={Boolean(busy)}
                type="button"
                onClick={() => void renew("square")}
              >
                <CreditCard className="size-4" />
                {busy === "renew-square" ? "Working…" : "Renew with card"}
              </SpecularButton>
              <SpecularButton
                className="h-11 w-full text-sm font-semibold"
                disabled={Boolean(busy)}
                type="button"
                onClick={() => void renew("oxapay")}
              >
                {busy === "renew-oxapay" ? "Working…" : "Renew with crypto"}
              </SpecularButton>
              <button
                className="h-10 w-full text-sm text-zinc-400 hover:text-zinc-200"
                type="button"
                onClick={() => setShowRenewPicker(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
