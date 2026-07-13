"use client";

import Link from "next/link";

import {
  formatAvailableSearches,
  formatBalance,
  getPlanDisplayLabel,
  type UserProfile,
  type UserStats,
} from "@/lib/account-plan";

export function AccountStatRail({
  profile,
  stats,
  renewsIn = "11:35:25",
  credits = "$0.00",
}: {
  profile: UserProfile | null;
  stats: UserStats | null;
  renewsIn?: string;
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
        <span className="anya-stat-row-label">Balance</span>
        <span className="anya-stat-row-value">
          {stats ? formatBalance(stats.balance) : credits}
        </span>
      </div>
      <div className="anya-stat-row">
        <span className="anya-stat-row-label">Renews in</span>
        <span className="anya-stat-row-value">{renewsIn}</span>
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
    </div>
  );
}

export function UpgradeLink() {
  return (
    <Link className="anya-link-btn" href="/pricing">
      View plans
    </Link>
  );
}
