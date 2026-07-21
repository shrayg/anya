"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Cable,
  Filter,
  LayoutGrid,
  RefreshCw,
  Search,
  Server,
  Table2,
} from "lucide-react";
import clsx from "clsx";

import {
  DashButton,
  DashInput,
  DashPanel,
  DashSelect,
  StatCard,
} from "@/components/dashboard/dashboard-ui";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { formatDate, formatTime } from "@/lib/format-datetime";
import { hasWorkspaceAdminAccess } from "@/lib/workspace-admin";

type ApiHealthStatus = "online" | "slow" | "offline" | "maintenance";

type ApiStatusRow = {
  id: string;
  name: string;
  description: string;
  version: string;
  status: ApiHealthStatus;
  endpoint: string;
  method: string;
  lastRequest: string | null;
  lastResponseMs: number | null;
  gateway: string;
  vendor: string;
  role: "gateway" | "endpoint" | "fallback";
  section?: string;
  note?: string;
  error?: string;
};

type ApiStatusResponse = {
  checkedAt: string;
  openapiVersion: string | null;
  openapiFetched: boolean;
  summary: Record<ApiHealthStatus, number>;
  gateways: ApiStatusRow[];
  endpoints: ApiStatusRow[];
  error?: string;
};

const STATUS_META: Record<
  ApiHealthStatus,
  { label: string; emoji: string; dot: string; text: string; chip: string }
> = {
  online: {
    label: "Online",
    emoji: "🟢",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
  },
  slow: {
    label: "Slow",
    emoji: "🟡",
    dot: "bg-amber-400",
    text: "text-amber-200",
    chip: "bg-amber-500/10 text-amber-200 ring-amber-500/20",
  },
  offline: {
    label: "Offline",
    emoji: "🔴",
    dot: "bg-red-500",
    text: "text-rose-300",
    chip: "bg-red-500/10 text-rose-300 ring-red-500/20",
  },
  maintenance: {
    label: "Maintenance",
    emoji: "🟠",
    dot: "bg-orange-400",
    text: "text-orange-300",
    chip: "bg-orange-500/10 text-orange-300 ring-orange-500/20",
  },
};

function StatusPill({ status }: { status: ApiHealthStatus }) {
  const meta = STATUS_META[status];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        meta.chip,
      )}
    >
      <span aria-hidden className="text-[10px] leading-none">
        {meta.emoji}
      </span>
      {meta.label}
    </span>
  );
}

function formatLastRequest(value: string | null) {
  if (!value) return "—";

  try {
    return `${formatDate(value)} ${formatTime(value)}`;
  } catch {
    return value;
  }
}

function formatLatency(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;

  return `${(ms / 1000).toFixed(1)} s`;
}

function ApiRowCard({ row }: { row: ApiStatusRow }) {
  return (
    <article
      className="rounded-[0.85rem] border border-white/[0.07] bg-[#141417] p-4 transition-colors hover:bg-[#16161a]"
      title={row.error || row.note || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-zinc-100">
              {row.name}
            </h3>
            <StatusPill status={row.status} />
            {row.role === "fallback" ? (
              <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                Fallback
              </span>
            ) : null}
            {row.section ? (
              <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-500">
                {row.section}
              </span>
            ) : null}
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            {row.description}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">
            Version
          </p>
          <p className="font-mono text-xs text-zinc-300">{row.version}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 border-t border-white/[0.05] pt-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">
            Vendor / Gateway
          </p>
          <p className="truncate text-xs text-zinc-300">
            {row.vendor}
            <span className="text-zinc-600"> · </span>
            {row.gateway}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">
            Endpoint
          </p>
          <p className="truncate font-mono text-[11px] text-zinc-400">
            <span className="mr-1.5 rounded bg-[#0c0c0e] px-1 py-0.5 text-[10px] text-sky-300/80">
              {row.method}
            </span>
            {row.endpoint}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">
            Last request
          </p>
          <p className="text-xs text-zinc-400">
            {formatLastRequest(row.lastRequest)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">
            Response time
          </p>
          <p
            className={clsx(
              "text-xs",
              row.lastResponseMs != null && row.lastResponseMs >= 4000
                ? "text-amber-200"
                : "text-zinc-400",
            )}
          >
            {formatLatency(row.lastResponseMs)}
          </p>
        </div>
      </div>

      {row.note || row.error ? (
        <p className="mt-2 text-[11px] text-zinc-600">
          {row.error ? (
            <span className="text-rose-300/90">Error: {row.error}</span>
          ) : (
            row.note
          )}
        </p>
      ) : null}
    </article>
  );
}

function ApiTable({ rows }: { rows: ApiStatusRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[0.85rem] border border-white/[0.07] bg-[#141417]">
      <table className="w-full min-w-[960px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-zinc-600">
            <th className="px-3 py-2.5 font-medium">API Name</th>
            <th className="px-3 py-2.5 font-medium">Description</th>
            <th className="px-3 py-2.5 font-medium">Version</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Method</th>
            <th className="px-3 py-2.5 font-medium">Endpoint</th>
            <th className="px-3 py-2.5 font-medium">Last request</th>
            <th className="px-3 py-2.5 font-medium">Response</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-white/[0.04] align-top last:border-0 hover:bg-white/[0.02]"
              title={row.error || row.note || undefined}
            >
              <td className="px-3 py-2.5">
                <p className="font-medium text-zinc-200">{row.name}</p>
                <p className="text-[10px] text-zinc-600">
                  {row.vendor} · {row.gateway}
                </p>
              </td>
              <td className="max-w-[220px] px-3 py-2.5 text-zinc-500">
                <p className="line-clamp-2">{row.description}</p>
                {row.error ? (
                  <p className="mt-1 line-clamp-2 text-rose-300/80">
                    {row.error}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-2.5 font-mono text-zinc-400">
                {row.version}
              </td>
              <td className="px-3 py-2.5">
                <StatusPill status={row.status} />
              </td>
              <td className="px-3 py-2.5">
                <span className="rounded bg-[#0c0c0e] px-1.5 py-0.5 font-mono text-[10px] text-sky-300/80">
                  {row.method}
                </span>
              </td>
              <td className="max-w-[200px] truncate px-3 py-2.5 font-mono text-[11px] text-zinc-400">
                {row.endpoint}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500">
                {formatLastRequest(row.lastRequest)}
              </td>
              <td
                className={clsx(
                  "whitespace-nowrap px-3 py-2.5",
                  row.lastResponseMs != null && row.lastResponseMs >= 4000
                    ? "text-amber-200"
                    : "text-zinc-400",
                )}
              >
                {formatLatency(row.lastResponseMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminApiStatusPanel() {
  const dashboardUser = useDashboardUser();
  const isAdmin =
    dashboardUser.canManageWorkspace ||
    hasWorkspaceAdminAccess({
      isAdmin: dashboardUser.isAdmin,
      staffRole: dashboardUser.staffRole,
    });

  const [data, setData] = useState<ApiStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [gateway, setGateway] = useState("");
  const [status, setStatus] = useState<"" | ApiHealthStatus>("");
  const [hideSkipped, setHideSkipped] = useState(true);
  const [view, setView] = useState<"cards" | "table">("table");

  const load = useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workspace/api-status", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiStatusResponse;

      if (!response.ok) {
        setError(payload.error || "Could not load API status.");
        setData(null);

        return;
      }

      setData(payload);
    } catch {
      setError("Could not load API status.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const gatewayOptions = useMemo(() => {
    const set = new Set<string>();

    for (const row of data?.gateways ?? []) set.add(row.gateway);
    for (const row of data?.endpoints ?? []) set.add(row.gateway);

    return [...set].sort();
  }, [data]);

  const filteredEndpoints = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (data?.endpoints ?? []).filter((row) => {
      if (hideSkipped && row.note?.includes("IntelBase mirror")) return false;
      if (gateway && row.gateway !== gateway) return false;
      if (status && row.status !== status) return false;
      if (!q) return true;

      return (
        row.name.toLowerCase().includes(q) ||
        row.vendor.toLowerCase().includes(q) ||
        row.endpoint.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.gateway.toLowerCase().includes(q) ||
        (row.error ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, gateway, hideSkipped, query, status]);

  const grouped = useMemo(() => {
    const map = new Map<string, ApiStatusRow[]>();

    for (const row of filteredEndpoints) {
      const key = row.gateway;
      const list = map.get(key) ?? [];

      list.push(row);
      map.set(key, list);
    }

    return [...map.entries()];
  }, [filteredEndpoints]);

  if (!isAdmin) {
    return null;
  }

  return (
    <section className="space-y-4" id="api-status">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            Admin · API visibility
          </p>
          <h2 className="text-lg font-semibold text-white">API status</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Admin-only. Gateways and endpoints from BreachHub OpenAPI +
            CSINT.pro — what each API does, live status, last request, response
            time, and errors.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-white/[0.07] bg-[#0c0c0e] p-0.5">
            <button
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px]",
                view === "cards"
                  ? "bg-[#1a1a1e] text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              onClick={() => setView("cards")}
              type="button"
            >
              <LayoutGrid className="size-3.5" />
              Cards
            </button>
            <button
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px]",
                view === "table"
                  ? "bg-[#1a1a1e] text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              onClick={() => setView("table")}
              type="button"
            >
              <Table2 className="size-3.5" />
              Table
            </button>
          </div>
          <DashButton
            className="inline-flex items-center gap-2"
            disabled={loading}
            onClick={load}
            type="button"
            variant="secondary"
          >
            <RefreshCw className={clsx("size-3.5", loading && "animate-spin")} />
            Refresh
          </DashButton>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent="teal"
          hint="Healthy latency"
          icon={Activity}
          label="🟢 Online"
          value={data?.summary.online ?? "—"}
        />
        <StatCard
          accent="amber"
          hint="≥ 4s response"
          icon={Cable}
          label="🟡 Slow"
          value={data?.summary.slow ?? "—"}
        />
        <StatCard
          accent="rose"
          hint="Probe / request failed"
          icon={Server}
          label="🔴 Offline"
          value={data?.summary.offline ?? "—"}
        />
        <StatCard
          accent="violet"
          hint="Disabled or skipped"
          icon={Filter}
          label="🟠 Maintenance"
          value={data?.summary.maintenance ?? "—"}
        />
      </div>

      <DashPanel className="!bg-[#0c0c0e] !border-white/[0.07]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-zinc-200">Gateways</p>
            <p className="text-xs text-zinc-500">
              {data?.openapiFetched
                ? `BreachHub OpenAPI v${data.openapiVersion ?? "—"} loaded`
                : "BreachHub OpenAPI unavailable — using catalog fallbacks"}
              {data?.checkedAt
                ? ` · checked ${formatTime(data.checkedAt)}`
                : null}
            </p>
          </div>
        </div>

        {error ? (
          <p className="mb-3 text-sm text-rose-300">{error}</p>
        ) : null}

        {view === "table" ? (
          <ApiTable rows={data?.gateways ?? []} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(data?.gateways ?? []).map((row) => (
              <ApiRowCard key={row.id} row={row} />
            ))}
            {loading && !data ? (
              <p className="text-sm text-zinc-500">Probing gateways…</p>
            ) : null}
          </div>
        )}
      </DashPanel>

      <DashPanel className="!bg-[#0c0c0e] !border-white/[0.07]">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
            <DashInput
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name, vendor, endpoint, error…"
              value={query}
            />
          </div>
          <DashSelect
            onChange={(event) => setGateway(event.target.value)}
            value={gateway}
          >
            <option value="">All gateways</option>
            {gatewayOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </DashSelect>
          <DashSelect
            onChange={(event) =>
              setStatus(event.target.value as "" | ApiHealthStatus)
            }
            value={status}
          >
            <option value="">All statuses</option>
            <option value="online">🟢 Online</option>
            <option value="slow">🟡 Slow</option>
            <option value="offline">🔴 Offline</option>
            <option value="maintenance">🟠 Maintenance</option>
          </DashSelect>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
            <input
              checked={hideSkipped}
              className="rounded border-white/10 bg-[#141417]"
              onChange={(event) => setHideSkipped(event.target.checked)}
              type="checkbox"
            />
            Hide IntelBase mirrors
          </label>
        </div>

        <div className="space-y-6">
          {view === "table" ? (
            <ApiTable rows={filteredEndpoints} />
          ) : (
            grouped.map(([group, rows]) => (
              <div key={group} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-zinc-200">{group}</h3>
                  <p className="text-[11px] text-zinc-600">
                    {rows.length} endpoint{rows.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="grid gap-3">
                  {rows.map((row) => (
                    <ApiRowCard key={row.id} row={row} />
                  ))}
                </div>
              </div>
            ))
          )}

          {!loading && filteredEndpoints.length === 0 ? (
            <p className="text-sm text-zinc-500">No endpoints match filters.</p>
          ) : null}
        </div>
      </DashPanel>
    </section>
  );
}
