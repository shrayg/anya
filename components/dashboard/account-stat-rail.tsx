"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  formatAvailableSearches,
  formatCountdown,
  formatCredits,
  formatPlanEndDate,
  getPlanDisplayLabel,
  isUnlimitedSearchQuota,
  type UserProfile,
  type UserStats,
} from "@/lib/account-plan";

function useLiveCountdown(targetIso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(id);
  }, [targetIso]);

  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();

  if (!Number.isFinite(target)) return null;

  return Math.max(0, target - now);
}

function QuotaRefreshValue({ stats }: { stats: UserStats | null }) {
  const remainingMs = useLiveCountdown(stats?.quotaRefreshAt);

  if (!stats) return <span className="anya-stat-row-value">—</span>;
  if (isUnlimitedSearchQuota(stats.quota)) {
    return <span className="anya-stat-row-value">Unlimited</span>;
  }
  if (!stats.quotaRefreshAt || remainingMs == null) {
    return <span className="anya-stat-row-value">Ready</span>;
  }
  if (remainingMs <= 0) {
    return <span className="anya-stat-row-value">Ready</span>;
  }

  return (
    <span className="anya-stat-row-value tabular-nums">
      {formatCountdown(remainingMs)}
    </span>
  );
}

function PlanEndsValue({ stats }: { stats: UserStats | null }) {
  const remainingMs = useLiveCountdown(stats?.planEndsAt);

  if (!stats || stats.plan === "free" || !stats.planEndsAt) {
    return <span className="anya-stat-row-value">—</span>;
  }

  if (remainingMs != null && remainingMs <= 0) {
    return <span className="anya-stat-row-value text-amber-300">Expired</span>;
  }

  if (remainingMs != null && remainingMs < 72 * 60 * 60 * 1000) {
    return (
      <span className="anya-stat-row-value tabular-nums">
        {formatCountdown(remainingMs)}
      </span>
    );
  }

  return (
    <span className="anya-stat-row-value">
      {formatPlanEndDate(stats.planEndsAt)}
    </span>
  );
}

export function AccountStatRail({
  profile,
  stats,
  credits = "$0.00",
}: {
  profile: UserProfile | null;
  stats: UserStats | null;
  credits?: string;
}) {
  return (
    <aside className="anya-stat-rail">
      <div className="anya-stat-row">
        <span className="anya-stat-row-label">Plan</span>
        <span className="anya-stat-row-value anya-stat-row-value--accent">
          {getPlanDisplayLabel(profile)}
        </span>
      </div>
      <div className="anya-stat-row">
        <span className="anya-stat-row-label">Searches left</span>
        <span className="anya-stat-row-value">
          {formatAvailableSearches(stats)}
        </span>
      </div>
      <div className="anya-stat-row">
        <span className="anya-stat-row-label">Credits</span>
        <span className="anya-stat-row-value">
          {stats ? formatCredits(stats.balance) : credits}
        </span>
      </div>
      <div className="anya-stat-row">
        <span className="anya-stat-row-label">Quota refreshes</span>
        <QuotaRefreshValue stats={stats} />
      </div>
      <div className="anya-stat-row">
        <span className="anya-stat-row-label">Plan ends</span>
        <PlanEndsValue stats={stats} />
      </div>
    </aside>
  );
}

export function AccountUsagePanel({ stats }: { stats: UserStats | null }) {
  if (!stats) return null;

  return (
    <div className="dash-panel">
      <h3 className="mb-4 text-sm font-semibold text-white">Search activity</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="anya-result-strip">
          <p className="anya-result-label">Last 24 hours</p>
          <p className="anya-result-value">{stats.usage.last24h}</p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Last 7 days</p>
          <p className="anya-result-value">{stats.usage.last1w}</p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Last 30 days</p>
          <p className="anya-result-value">{stats.usage.last1m}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        Daily search limits use a rolling 24-hour window. “Quota refreshes” is
        when your oldest search in that window ages out and frees a slot.
      </p>
    </div>
  );
}

export function AccountBillingNote({ stats }: { stats: UserStats | null }) {
  if (!stats || stats.plan === "free") return null;

  if (stats.billingChannel === "crypto") {
    return (
      <p className="mt-3 text-xs leading-5 text-amber-200/90">
        Paid with crypto — this period does not auto-renew. Use Renew plan below
        before it ends
        {stats.planEndsAt ? ` (${formatPlanEndDate(stats.planEndsAt)})` : ""}.
        Prefer card (Square) if you want easier recurring renewals.
      </p>
    );
  }

  if (stats.billingChannel === "card") {
    return (
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        Paid by card. Renew from here before the period ends to keep access.
        {stats.planEndsAt
          ? ` Current period ends ${formatPlanEndDate(stats.planEndsAt)}.`
          : ""}
      </p>
    );
  }

  return (
    <p className="mt-3 text-xs leading-5 text-zinc-500">
      Crypto invoices are one-time and must be renewed manually. Card (Square)
      is the path for recurring-style renewals.
    </p>
  );
}

export function UpgradeLink() {
  return (
    <Link className="anya-link-btn" href="/pricing">
      View plans
    </Link>
  );
}
