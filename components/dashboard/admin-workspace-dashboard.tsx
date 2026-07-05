"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CreditCard,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import clsx from "clsx";

import { DashButton, DashPanel, StatCard } from "@/components/dashboard/dashboard-ui";
import { formatDate, formatTime } from "@/lib/format-datetime";

type OverviewResponse = {
  summary: {
    totalUsers: number;
    activeUsers: number;
    frozenUsers: number;
    bannedUsers: number;
    investigateUsers: number;
    searches24h: number;
    searches7d: number;
    searches30d: number;
    signups24h: number;
    signups7d: number;
    revenue30d: number;
  };
  trafficByType: Array<{ type: string; count: number }>;
  trafficByDay: Array<{ date: string; signups: number; searches: number }>;
  payments: Array<{
    id: number;
    amount: number;
    currency: string;
    type: string;
    plan: string | null;
    status: string;
    description: string;
    createdAt: string;
    username: string;
  }>;
  recentActivity: Array<{
    id: number;
    query: string;
    searchType: string;
    createdAt: string;
    username: string;
  }>;
};

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export function AdminWorkspaceDashboard() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workspace/overview", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not load workspace overview.");
        return;
      }

      setOverview(data);
    } catch {
      setError("Could not load workspace overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const maxTraffic = Math.max(
    ...(overview?.trafficByDay.map((entry) => entry.searches) ?? [1]),
    1,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Workspace overview</h2>
          <p className="text-sm text-zinc-400">
            Payments, traffic, and platform activity in one place.
          </p>
        </div>
        <DashButton
          className="inline-flex items-center justify-center gap-2"
          onClick={loadOverview}
          variant="secondary"
        >
          <RefreshCw className={clsx("size-4", loading && "animate-spin")} />
          Refresh
        </DashButton>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent="teal"
          hint={`${overview?.summary.signups24h ?? 0} new in 24h`}
          icon={Users}
          label="Total users"
          value={overview?.summary.totalUsers ?? "—"}
        />
        <StatCard
          accent="violet"
          hint={`${overview?.summary.searches7d ?? 0} in 7 days`}
          icon={Search}
          label="Search traffic"
          value={overview?.summary.searches24h ?? "—"}
        />
        <StatCard
          accent="amber"
          hint="Completed payments"
          icon={CreditCard}
          label="Revenue (30d)"
          value={overview ? formatMoney(overview.summary.revenue30d) : "—"}
        />
        <StatCard
          accent="rose"
          hint={`${overview?.summary.investigateUsers ?? 0} flagged`}
          icon={Activity}
          label="Moderation"
          value={
            overview
              ? overview.summary.frozenUsers +
                overview.summary.bannedUsers +
                overview.summary.investigateUsers
              : "—"
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashPanel glow="teal">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-teal-300" />
            <h3 className="text-base font-semibold text-white">Traffic (7 days)</h3>
          </div>

          <div className="space-y-3">
            {(overview?.trafficByDay ?? []).map((entry) => (
              <div key={entry.date}>
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
                  <span>{entry.date}</span>
                  <span>
                    {entry.searches} searches · {entry.signups} signups
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-400/70 to-cyan-300/70"
                    style={{ width: `${Math.max((entry.searches / maxTraffic) * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Traffic by module
            </p>
            <div className="flex flex-wrap gap-2">
              {(overview?.trafficByType ?? []).map((entry) => (
                <span
                  key={entry.type}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300"
                >
                  {entry.type}: {entry.count}
                </span>
              ))}
            </div>
          </div>
        </DashPanel>

        <DashPanel glow="amber">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="size-4 text-amber-300" />
            <h3 className="text-base font-semibold text-white">Recent payments</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  <th className="px-2 py-2 font-semibold">User</th>
                  <th className="px-2 py-2 font-semibold">Amount</th>
                  <th className="px-2 py-2 font-semibold">Type</th>
                  <th className="px-2 py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-2 py-6 text-zinc-500" colSpan={4}>
                      Loading payments...
                    </td>
                  </tr>
                ) : (overview?.payments.length ?? 0) === 0 ? (
                  <tr>
                    <td className="px-2 py-6 text-zinc-500" colSpan={4}>
                      No payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  overview?.payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-white/5">
                      <td className="px-2 py-3 text-white">{payment.username}</td>
                      <td className="px-2 py-3 text-emerald-200">
                        {formatMoney(payment.amount)}
                      </td>
                      <td className="px-2 py-3 text-zinc-400">{payment.type}</td>
                      <td className="px-2 py-3 text-zinc-500">
                        {formatDate(payment.createdAt)} · {formatTime(payment.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashPanel>
      </div>

      <DashPanel glow="violet">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="size-4 text-violet-300" />
          <h3 className="text-base font-semibold text-white">Live activity</h3>
        </div>

        <div className="space-y-2">
          {(overview?.recentActivity ?? []).map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm text-white">{entry.username}</p>
                <p className="truncate text-xs text-zinc-500">{entry.query}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="rounded-full border border-white/10 px-2 py-0.5">
                  {entry.searchType}
                </span>
                <span>
                  {formatDate(entry.createdAt)} · {formatTime(entry.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DashPanel>
    </div>
  );
}
