"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CreditCard,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import clsx from "clsx";

import {
  DashButton,
  DashPanel,
  StatCard,
} from "@/components/dashboard/dashboard-ui";
import { formatDate, formatTime } from "@/lib/format-datetime";

type DayTraffic = { date: string; signups: number; searches: number };

type OverviewResponse = {
  summary: {
    totalUsers: number;
    activeUsers: number;
    frozenUsers: number;
    bannedUsers: number;
    investigateUsers: number;
    openSafetyFlags: number;
    searches24h: number;
    searches7d: number;
    searches30d: number;
    signups24h: number;
    signups7d: number;
    revenue30d: number;
  };
  trafficByType: Array<{ type: string; count: number }>;
  trafficByDay: DayTraffic[];
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

function shortDay(date: string) {
  const parts = date.split("-");

  if (parts.length !== 3) return date;

  return `${parts[1]}/${parts[2]}`;
}

function TrafficChart({ days }: { days: DayTraffic[] }) {
  const width = 560;
  const height = 160;
  const padX = 28;
  const padY = 16;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2 - 18;
  const max = Math.max(
    1,
    ...days.map((d) => Math.max(d.searches, d.signups)),
  );
  const n = Math.max(days.length, 1);
  const groupW = chartW / n;
  const barW = Math.max(3, groupW * 0.32);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        aria-label="Searches and signups over the last 14 days"
        className="min-w-full"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padY + chartH * (1 - ratio);

          return (
            <g key={ratio}>
              <line
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
              />
              <text
                fill="rgba(161,161,170,0.7)"
                fontSize="8"
                textAnchor="end"
                x={padX - 4}
                y={y + 3}
              >
                {Math.round(max * ratio)}
              </text>
            </g>
          );
        })}

        {days.map((day, index) => {
          const x0 = padX + index * groupW + groupW * 0.18;
          const searchH = (day.searches / max) * chartH;
          const signupH = (day.signups / max) * chartH;
          const base = padY + chartH;

          return (
            <g key={day.date}>
              <rect
                fill="rgba(45,212,191,0.75)"
                height={Math.max(searchH, day.searches > 0 ? 2 : 0)}
                rx="1.5"
                width={barW}
                x={x0}
                y={base - searchH}
              >
                <title>
                  {day.date}: {day.searches} searches
                </title>
              </rect>
              <rect
                fill="rgba(251,191,36,0.8)"
                height={Math.max(signupH, day.signups > 0 ? 2 : 0)}
                rx="1.5"
                width={barW}
                x={x0 + barW + 2}
                y={base - signupH}
              >
                <title>
                  {day.date}: {day.signups} signups
                </title>
              </rect>
              <text
                fill="rgba(113,113,122,0.95)"
                fontSize="7"
                textAnchor="middle"
                x={x0 + barW}
                y={height - 4}
              >
                {shortDay(day.date)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-teal-400/80" />
          Searches
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-amber-400/80" />
          Signups
        </span>
        <span className="text-zinc-600">14-day platform activity</span>
      </div>
    </div>
  );
}

function ModuleShareChart({
  rows,
}: {
  rows: Array<{ type: string; count: number }>;
}) {
  const total = Math.max(
    1,
    rows.reduce((sum, row) => sum + row.count, 0),
  );
  const top = rows.slice(0, 8);

  return (
    <div className="space-y-1.5">
      {top.map((row) => {
        const pct = (row.count / total) * 100;

        return (
          <div key={row.type} className="grid grid-cols-[88px_1fr_36px] gap-2">
            <p className="truncate text-[10px] text-zinc-400" title={row.type}>
              {row.type}
            </p>
            <div className="h-1.5 self-center overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-teal-400/70"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <p className="text-right text-[10px] tabular-nums text-zinc-500">
              {row.count}
            </p>
          </div>
        );
      })}
      {top.length === 0 ? (
        <p className="text-[11px] text-zinc-600">No module traffic yet.</p>
      ) : null}
    </div>
  );
}

export function AdminWorkspaceDashboard() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workspace/overview", {
        cache: "no-store",
      });
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

  const days = overview?.trafficByDay ?? [];
  const searches14d = useMemo(
    () => days.reduce((sum, day) => sum + day.searches, 0),
    [days],
  );
  const signups14d = useMemo(
    () => days.reduce((sum, day) => sum + day.signups, 0),
    [days],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          {loading
            ? "Loading…"
            : `${searches14d} searches · ${signups14d} signups · last 14 days`}
        </p>
        <DashButton
          className="inline-flex h-7 items-center justify-center gap-1.5 px-2 text-[11px]"
          variant="secondary"
          onClick={loadOverview}
        >
          <RefreshCw className={clsx("size-3", loading && "animate-spin")} />
          Refresh
        </DashButton>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent="teal"
          className="!p-2.5 [&_.dash-stat-top]:!mb-1.5 [&_.dash-stat-value]:!text-xl [&_.dash-stat-hint]:!mt-1 [&_.dash-stat-hint]:!text-[10px] [&_.dash-stat-icon]:!size-7"
          hint={`${overview?.summary.signups24h ?? 0} new · 24h`}
          icon={Users}
          label="Users"
          value={overview?.summary.totalUsers ?? "—"}
        />
        <StatCard
          accent="violet"
          className="!p-2.5 [&_.dash-stat-top]:!mb-1.5 [&_.dash-stat-value]:!text-xl [&_.dash-stat-hint]:!mt-1 [&_.dash-stat-hint]:!text-[10px] [&_.dash-stat-icon]:!size-7"
          hint={`${overview?.summary.searches7d ?? 0} · 7d`}
          icon={Search}
          label="Searches 24h"
          value={overview?.summary.searches24h ?? "—"}
        />
        <StatCard
          accent="amber"
          className="!p-2.5 [&_.dash-stat-top]:!mb-1.5 [&_.dash-stat-value]:!text-xl [&_.dash-stat-hint]:!mt-1 [&_.dash-stat-hint]:!text-[10px] [&_.dash-stat-icon]:!size-7"
          hint="Completed"
          icon={CreditCard}
          label="Revenue 30d"
          value={overview ? formatMoney(overview.summary.revenue30d) : "—"}
        />
        <StatCard
          accent="rose"
          className="!p-2.5 [&_.dash-stat-top]:!mb-1.5 [&_.dash-stat-value]:!text-xl [&_.dash-stat-hint]:!mt-1 [&_.dash-stat-hint]:!text-[10px] [&_.dash-stat-icon]:!size-7"
          hint={`${overview?.summary.investigateUsers ?? 0} flagged`}
          icon={Activity}
          label="Open flags"
          value={overview ? overview.summary.openSafetyFlags : "—"}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        <DashPanel className="!bg-[#141417] !border-white/[0.07] !p-3 xl:col-span-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-zinc-200">
              Activity graph
            </h3>
            <p className="text-[10px] text-zinc-600">
              searches vs signups (site growth proxy)
            </p>
          </div>
          <TrafficChart days={days} />
        </DashPanel>

        <DashPanel className="!bg-[#141417] !border-white/[0.07] !p-3 xl:col-span-2">
          <h3 className="mb-2 text-xs font-semibold text-zinc-200">
            Top modules
          </h3>
          <ModuleShareChart rows={overview?.trafficByType ?? []} />
        </DashPanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <DashPanel className="!bg-[#141417] !border-white/[0.07] !p-3">
          <h3 className="mb-2 text-xs font-semibold text-zinc-200">
            Recent payments
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-zinc-600">
                  <th className="px-1.5 py-1.5 font-medium">User</th>
                  <th className="px-1.5 py-1.5 font-medium">Amount</th>
                  <th className="px-1.5 py-1.5 font-medium">Type</th>
                  <th className="px-1.5 py-1.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-1.5 py-4 text-zinc-600" colSpan={4}>
                      Loading…
                    </td>
                  </tr>
                ) : (overview?.payments.length ?? 0) === 0 ? (
                  <tr>
                    <td className="px-1.5 py-4 text-zinc-600" colSpan={4}>
                      No payments yet.
                    </td>
                  </tr>
                ) : (
                  overview?.payments.slice(0, 8).map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-white/[0.04]"
                    >
                      <td className="px-1.5 py-1.5 text-zinc-200">
                        {payment.username}
                      </td>
                      <td className="px-1.5 py-1.5 text-emerald-300">
                        {formatMoney(payment.amount)}
                      </td>
                      <td className="px-1.5 py-1.5 text-zinc-500">
                        {payment.type}
                      </td>
                      <td className="px-1.5 py-1.5 text-zinc-600">
                        {formatDate(payment.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashPanel>

        <DashPanel className="!bg-[#141417] !border-white/[0.07] !p-3">
          <h3 className="mb-2 text-xs font-semibold text-zinc-200">
            Live searches
          </h3>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {(overview?.recentActivity ?? []).slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-white/[0.05] bg-[#0c0c0e] px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-zinc-200">
                    {entry.username}
                    <span className="text-zinc-600"> · </span>
                    <span className="text-zinc-500">{entry.query}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right text-[10px] text-zinc-600">
                  <span className="mr-1 rounded border border-white/10 px-1 py-0.5 text-zinc-500">
                    {entry.searchType}
                  </span>
                  {formatTime(entry.createdAt)}
                </div>
              </div>
            ))}
            {!loading && (overview?.recentActivity.length ?? 0) === 0 ? (
              <p className="text-[11px] text-zinc-600">No recent searches.</p>
            ) : null}
          </div>
        </DashPanel>
      </div>
    </div>
  );
}
