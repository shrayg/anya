"use client";

import { useCallback, useEffect, useState } from "react";
import { Filter, RefreshCw, ScrollText } from "lucide-react";
import clsx from "clsx";

import {
  DashButton,
  DashInput,
  DashPanel,
  DashSelect,
} from "@/components/dashboard/dashboard-ui";
import { formatDate, formatTime } from "@/lib/format-datetime";

type EventLogRow = {
  id: number;
  userId: number;
  username: string;
  action: string;
  status: string;
  message: string | null;
  queryPreview: string | null;
  moduleSlug: string | null;
  metaJson: string | null;
  createdAt: string;
};

type EventLogsResponse = {
  total: number;
  limit: number;
  actions: string[];
  logs: EventLogRow[];
  error?: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ok", label: "ok" },
  { value: "error", label: "error" },
  { value: "partial", label: "partial" },
  { value: "rate_limited", label: "rate_limited" },
  { value: "info", label: "info" },
] as const;

function statusClass(status: string): string {
  if (status === "ok") return "text-emerald-300";
  if (status === "rate_limited") return "text-amber-200";
  if (status === "error") return "text-rose-300";
  if (status === "partial") return "text-sky-300";

  return "text-zinc-400";
}

export function AdminEventLogsPanel({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [logs, setLogs] = useState<EventLogRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (username.trim()) params.set("username", username.trim());
      if (userId.trim()) params.set("userId", userId.trim());
      if (action.trim()) params.set("action", action.trim());
      if (status.trim()) params.set("status", status.trim());
      params.set("limit", "100");

      const response = await fetch(
        `/api/workspace/event-logs?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as EventLogsResponse;

      if (!response.ok) {
        setError(data.error || "Could not load event logs.");
        setLogs([]);

        return;
      }

      setLogs(data.logs || []);
      setActions(data.actions || []);
      setTotal(data.total || 0);
    } catch {
      setError("Could not load event logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [action, status, userId, username]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const body = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {!embedded ? (
          <div>
            <div className="flex items-center gap-2 text-white">
              <ScrollText className="size-4 text-zinc-400" />
              <h2 className="text-lg font-semibold">OSINT event logs</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Staff-only trail of searches, partial failures, and rate limits.
              Users never see these messages on the search panel.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">
            Showing {logs.length} of {total.toLocaleString()} matching events
          </p>
        )}
        <DashButton
          className="inline-flex h-7 items-center gap-1.5 px-2 text-[11px]"
          disabled={loading}
          onClick={() => void loadLogs()}
          type="button"
          variant="ghost"
        >
          <RefreshCw className={clsx("size-3", loading && "animate-spin")} />
          Refresh
        </DashButton>
      </div>

      <div className="grid gap-1.5 md:grid-cols-4">
        <DashInput
          className="h-7 text-[11px]"
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Filter by username"
          value={username}
        />
        <DashInput
          className="h-7 text-[11px]"
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Filter by user id"
          value={userId}
        />
        <div className="relative">
          <Filter className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
          <DashSelect
            className="h-7 w-full appearance-none pl-8 text-[11px]"
            onChange={(e) => setAction(e.target.value)}
            value={action}
          >
            <option value="">All actions</option>
            {actions.map((row) => (
              <option key={row} value={row}>
                {row}
              </option>
            ))}
          </DashSelect>
        </div>
        <DashSelect
          className="h-7 w-full text-[11px]"
          onChange={(e) => setStatus(e.target.value)}
          value={status}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </DashSelect>
      </div>

      {!embedded ? (
        <p className="text-xs text-zinc-500">
          Showing {logs.length} of {total.toLocaleString()} matching events
        </p>
      ) : null}

      {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full text-left text-[11px]">
          <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2 py-1.5 font-medium">When</th>
              <th className="px-2 py-1.5 font-medium">User</th>
              <th className="px-2 py-1.5 font-medium">Action</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
              <th className="px-2 py-1.5 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && logs.length === 0 ? (
              <tr>
                <td className="px-2 py-3 text-zinc-500" colSpan={5}>
                  Loading logs…
                </td>
              </tr>
            ) : null}
            {!loading && logs.length === 0 ? (
              <tr>
                <td className="px-2 py-3 text-zinc-500" colSpan={5}>
                  No events match these filters yet.
                </td>
              </tr>
            ) : null}
            {logs.map((row) => (
              <tr key={row.id} className="align-top text-zinc-300">
                <td className="whitespace-nowrap px-2 py-1.5 text-[10px] text-zinc-500">
                  <div>{formatDate(row.createdAt)}</div>
                  <div>{formatTime(row.createdAt)}</div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="text-xs font-medium text-white">
                    {row.username}
                  </div>
                  <div className="text-[10px] text-zinc-500">#{row.userId}</div>
                </td>
                <td className="px-2 py-1.5 font-mono text-[10px] text-zinc-400">
                  <div>{row.action}</div>
                  {row.moduleSlug ? (
                    <div className="text-zinc-600">{row.moduleSlug}</div>
                  ) : null}
                </td>
                <td
                  className={clsx(
                    "px-2 py-1.5 font-mono text-[10px] uppercase",
                    statusClass(row.status),
                  )}
                >
                  {row.status}
                </td>
                <td className="max-w-md px-2 py-1.5 text-[11px]">
                  {row.queryPreview ? (
                    <p className="truncate text-zinc-400">
                      q: {row.queryPreview}
                    </p>
                  ) : null}
                  {row.message ? (
                    <p className="mt-0.5 break-words text-zinc-300">
                      {row.message}
                    </p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (embedded) {
    return body;
  }

  return <DashPanel className="!p-3">{body}</DashPanel>;
}
