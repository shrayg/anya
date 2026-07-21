"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";

type ProviderRow = {
  id: string;
  label: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  unprobed?: boolean;
};

/**
 * Compact provider status strip for the dashboard sidebar.
 * Green = ok, amber = unprobed/degraded, red = failing.
 */
export function ProviderHealthPanel({ collapsed }: { collapsed?: boolean }) {
  const [rows, setRows] = useState<ProviderRow[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch("/api/osint/provider-health", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          if (cancelled) return;
          if (Array.isArray(data?.providers)) {
            setRows(
              (data.providers as ProviderRow[]).filter(
                (row) => row.id !== "builtin",
              ),
            );
          }
          if (typeof data?.checkedAt === "string") {
            setCheckedAt(data.checkedAt);
          }
        })
        .catch(() => undefined);
    };

    load();
    const interval = window.setInterval(load, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (collapsed) {
    const down = rows?.filter((row) => !row.ok && !row.unprobed).length ?? 0;
    const color =
      !rows ? "bg-zinc-500" : down > 0 ? "bg-red-500" : "bg-emerald-400";

    return (
      <div
        className="flex items-center justify-center py-1"
        title={
          down > 0
            ? `${down} source(s) down`
            : rows
              ? "Sources online"
              : "Checking sources…"
        }
      >
        <span className={clsx("size-1.5 rounded-full", color)} />
      </div>
    );
  }

  return (
    <div className="dash-provider-health mx-2 mb-2 rounded-lg border border-white/5 bg-black/20 px-2.5 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Sources
        </p>
        {checkedAt ? (
          <p className="truncate text-[9px] text-zinc-600">
            {new Date(checkedAt).toLocaleTimeString()}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(rows ?? []).map((row) => {
          const tone = row.unprobed
            ? "bg-amber-400"
            : row.ok
              ? "bg-emerald-400"
              : "bg-red-500";

          return (
            <span
              key={row.id}
              className="inline-flex items-center gap-1 rounded-md bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-zinc-400"
              title={
                row.unprobed
                  ? `${row.label}: unprobed`
                  : row.ok
                    ? `${row.label}: ok (${row.latencyMs}ms)`
                    : `${row.label}: ${row.error || "down"}`
              }
            >
              <span className={clsx("size-1.5 shrink-0 rounded-full", tone)} />
              {row.label}
            </span>
          );
        })}
        {!rows ? (
          <span className="text-[10px] text-zinc-600">Checking…</span>
        ) : null}
      </div>
    </div>
  );
}
