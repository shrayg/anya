"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import clsx from "clsx";

import { DashButton, DashPanel } from "@/components/dashboard/dashboard-ui";
import { formatDate, formatTime } from "@/lib/format-datetime";

type DayTraffic = { date: string; signups: number; searches: number; visits: number };

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
    revenuePrev30d?: number;
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

const ICE = "#c3d3e6";

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function shortDay(date: string) {
  const parts = date.split("-");

  if (parts.length !== 3) return date;

  return `${parts[1]}/${parts[2]}`;
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) {
    if (current <= 0) return 0;

    return 100;
  }

  return ((current - previous) / previous) * 100;
}

function formatPct(value: number) {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";

  return `${sign}${rounded}%`;
}

function sumSlice(
  days: DayTraffic[],
  start: number,
  end: number,
  key: keyof Pick<DayTraffic, "searches" | "signups" | "visits">,
) {
  return days
    .slice(start, end)
    .reduce((sum, day) => sum + (day[key] ?? 0), 0);
}

function Sparkline({
  values,
  color = ICE,
}: {
  values: number[];
  color?: string;
}) {
  const width = 72;
  const height = 28;
  const pad = 2;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x =
        pad +
        (values.length <= 1
          ? width / 2
          : (index / (values.length - 1)) * (width - pad * 2));
      const y = height - pad - ((value - min) / range) * (height - pad * 2);

      return `${x},${y}`;
    })
    .join(" ");

  if (values.length === 0) {
    return <div className="h-7 w-[72px]" />;
  }

  return (
    <svg
      aria-hidden
      className="shrink-0"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.85"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function MetricCard({
  period,
  value,
  changePct,
  series,
  loading,
}: {
  period: string;
  value: React.ReactNode;
  changePct: number | null;
  series: number[];
  loading?: boolean;
}) {
  const up = (changePct ?? 0) > 0;
  const down = (changePct ?? 0) < 0;
  const flat = changePct === 0 || changePct === null;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#141417] p-3.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        {period}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 tabular-nums">
        {loading ? "—" : value}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p
          className={clsx(
            "text-[11px] font-medium tabular-nums",
            flat && "text-zinc-500",
            up && "text-emerald-400",
            down && "text-rose-400",
          )}
        >
          {changePct === null ? "—" : formatPct(changePct)}
          <span className="ml-1 font-normal text-zinc-600">vs prev</span>
        </p>
        <Sparkline values={series} />
      </div>
    </div>
  );
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
    ...days.map((d) => Math.max(d.searches, d.signups, d.visits ?? 0)),
  );
  const n = Math.max(days.length, 1);
  const groupW = chartW / n;
  const barW = Math.max(2.5, groupW * 0.22);
  const gap = 1.5;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        aria-label="Searches, signups, and site visits over the last 14 days"
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
          const visits = day.visits ?? 0;
          const x0 = padX + index * groupW + groupW * 0.12;
          const searchH = (day.searches / max) * chartH;
          const signupH = (day.signups / max) * chartH;
          const visitH = (visits / max) * chartH;
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
                x={x0 + barW + gap}
                y={base - signupH}
              >
                <title>
                  {day.date}: {day.signups} signups
                </title>
              </rect>
              <rect
                fill="rgba(195,211,230,0.9)"
                height={Math.max(visitH, visits > 0 ? 2 : 0)}
                rx="1.5"
                width={barW}
                x={x0 + (barW + gap) * 2}
                y={base - visitH}
              >
                <title>
                  {day.date}: {visits} visits
                </title>
              </rect>
              <text
                fill="rgba(113,113,122,0.95)"
                fontSize="7"
                textAnchor="middle"
                x={x0 + barW + gap}
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
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ backgroundColor: ICE }} />
          Visits
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
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  backgroundColor: "color-mix(in srgb, #c3d3e6 70%, transparent)",
                }}
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

  const metrics = useMemo(() => {
    const mid = Math.max(days.length - 7, 0);
    const searchesNow = sumSlice(days, mid, days.length, "searches");
    const searchesPrev = sumSlice(days, 0, mid, "searches");
    const signupsNow = sumSlice(days, mid, days.length, "signups");
    const signupsPrev = sumSlice(days, 0, mid, "signups");
    const visitsNow = sumSlice(days, mid, days.length, "visits");
    const visitsPrev = sumSlice(days, 0, mid, "visits");
    const revenueNow = overview?.summary.revenue30d ?? 0;
    const revenuePrev = overview?.summary.revenuePrev30d ?? 0;

    return {
      searches: {
        value: searchesNow,
        change: percentChange(searchesNow, searchesPrev),
        series: days.map((d) => d.searches),
      },
      signups: {
        value: signupsNow,
        change: percentChange(signupsNow, signupsPrev),
        series: days.map((d) => d.signups),
      },
      visits: {
        value: visitsNow,
        change: percentChange(visitsNow, visitsPrev),
        series: days.map((d) => d.visits ?? 0),
      },
      revenue: {
        value: revenueNow,
        change:
          overview?.summary.revenuePrev30d == null
            ? null
            : percentChange(revenueNow, revenuePrev),
        series: [revenuePrev, revenueNow],
      },
    };
  }, [days, overview]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          {loading
            ? "Loading analytics…"
            : `${metrics.searches.value} searches · ${metrics.signups.value} signups · ${metrics.visits.value} visits · last 7 days`}
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

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          changePct={metrics.searches.change}
          loading={loading}
          period="Searches · 7d"
          series={metrics.searches.series}
          value={metrics.searches.value}
        />
        <MetricCard
          changePct={metrics.signups.change}
          loading={loading}
          period="Signups · 7d"
          series={metrics.signups.series}
          value={metrics.signups.value}
        />
        <MetricCard
          changePct={metrics.visits.change}
          loading={loading}
          period="Visits · 7d"
          series={metrics.visits.series}
          value={metrics.visits.value}
        />
        <MetricCard
          changePct={metrics.revenue.change}
          loading={loading}
          period="Revenue · 30d"
          series={metrics.revenue.series}
          value={formatMoney(metrics.revenue.value)}
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/[0.07] bg-[#141417] px-3.5 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Total users
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-50">
            {overview?.summary.totalUsers ?? "—"}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            {overview?.summary.activeUsers ?? 0} active ·{" "}
            {overview?.summary.frozenUsers ?? 0} frozen
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#141417] px-3.5 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Searches · 24h
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-50">
            {overview?.summary.searches24h ?? "—"}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            {overview?.summary.searches30d ?? 0} · 30d
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#141417] px-3.5 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            New · 24h
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-50">
            {overview?.summary.signups24h ?? "—"}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            {overview?.summary.signups7d ?? 0} · 7d
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#141417] px-3.5 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Open flags
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-50">
            {overview ? overview.summary.openSafetyFlags : "—"}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            {overview?.summary.investigateUsers ?? 0} investigate accounts
          </p>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        <DashPanel className="!bg-[#141417] !border-white/[0.07] !p-3 xl:col-span-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-zinc-200">
              Activity graph
            </h3>
            <p className="text-[10px] text-zinc-600">
              searches vs signups vs visits
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
