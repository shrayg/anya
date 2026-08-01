"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Plus, RefreshCw, Trash2 } from "lucide-react";
import clsx from "clsx";

import {
  DashButton,
  DashInput,
  DashPanel,
  DashTextarea,
} from "@/components/dashboard/dashboard-ui";
import { formatDate, formatTime } from "@/lib/format-datetime";

type BlacklistEntry = {
  id: number;
  value: string;
  displayValue: string;
  note: string | null;
  createdById: number | null;
  createdByUsername: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  entries?: BlacklistEntry[];
  total?: number;
  error?: string;
};

export function AdminBlacklistPanel({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workspace/blacklist", {
        cache: "no-store",
      });
      const data = (await response.json()) as ListResponse;

      if (!response.ok) {
        setError(data.error || "Could not load blacklist.");
        setEntries([]);
        setTotal(0);

        return;
      }

      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch {
      setError("Could not load blacklist.");
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addEntry = async () => {
    const trimmed = value.trim();

    if (!trimmed || saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/workspace/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: trimmed,
          note: note.trim() || undefined,
        }),
      });
      const data = (await response.json()) as {
        entry?: BlacklistEntry;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error || "Could not add entry.");

        return;
      }

      setValue("");
      setNote("");
      await load();
    } catch {
      setError("Could not add entry.");
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (id: number) => {
    setError("");

    try {
      const response = await fetch(`/api/workspace/blacklist/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error || "Could not remove entry.");

        return;
      }

      setEntries((current) => current.filter((row) => row.id !== id));
      setTotal((current) => Math.max(0, current - 1));
    } catch {
      setError("Could not remove entry.");
    }
  };

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? entries.filter(
        (row) =>
          row.displayValue.toLowerCase().includes(needle) ||
          row.value.includes(needle) ||
          (row.note || "").toLowerCase().includes(needle),
      )
    : entries;

  const body = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {!embedded ? (
          <div>
            <div className="flex items-center gap-2 text-white">
              <Ban className="size-4 text-zinc-400" />
              <h2 className="text-lg font-semibold">Data blacklist</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Hide exact values (email, phone, username, domain, IP, password)
              from search results. Matching is case-insensitive after trim.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">
            {total} blacklisted value{total === 1 ? "" : "s"} · exact /
            normalized match
          </p>
        )}
        <DashButton
          className="inline-flex h-7 items-center gap-1.5 px-2 text-[11px]"
          disabled={loading}
          onClick={() => void load()}
          type="button"
          variant="secondary"
        >
          <RefreshCw className={clsx("size-3", loading && "animate-spin")} />
          Refresh
        </DashButton>
      </div>

      <div className="rounded-lg border border-white/[0.07] bg-[#0a0a0c] p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
          Add value
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <DashInput
            className="min-w-0 flex-1"
            placeholder="email, phone, username, domain, IP, password…"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addEntry();
              }
            }}
          />
          <DashButton
            className="inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-[12px]"
            disabled={saving || !value.trim()}
            onClick={() => void addEntry()}
            type="button"
          >
            <Plus className="size-3.5" />
            Blacklist
          </DashButton>
        </div>
        <DashTextarea
          className="mt-2 min-h-[56px]"
          placeholder="Optional note (why this is blocked)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DashInput
          className="max-w-xs"
          placeholder="Filter list…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <span className="text-[11px] text-zinc-600">
          Showing {visible.length}
          {needle ? ` of ${entries.length}` : ""}
        </span>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-400/20 bg-rose-500/10 px-2.5 py-1.5 text-[12px] text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-white/[0.07]">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">
                Note
              </th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">
                Added
              </th>
              <th className="px-3 py-2 text-right font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {loading && entries.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-zinc-500" colSpan={4}>
                  Loading…
                </td>
              </tr>
            ) : null}
            {!loading && visible.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-zinc-500" colSpan={4}>
                  {needle
                    ? "No entries match that filter."
                    : "No blacklisted values yet."}
                </td>
              </tr>
            ) : null}
            {visible.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/[0.04] last:border-0"
              >
                <td className="px-3 py-2 align-top">
                  <p className="break-all font-medium text-zinc-100">
                    {row.displayValue}
                  </p>
                  {row.displayValue.toLowerCase() !== row.value ? (
                    <p className="mt-0.5 break-all text-[10px] text-zinc-600">
                      match: {row.value}
                    </p>
                  ) : null}
                  {row.createdByUsername ? (
                    <p className="mt-0.5 text-[10px] text-zinc-600">
                      by {row.createdByUsername}
                    </p>
                  ) : null}
                </td>
                <td className="hidden max-w-[14rem] px-3 py-2 align-top text-zinc-400 md:table-cell">
                  {row.note || "—"}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 align-top text-zinc-500 sm:table-cell">
                  <span>{formatDate(row.createdAt)}</span>
                  <span className="ml-1 text-zinc-600">
                    {formatTime(row.createdAt)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <DashButton
                    aria-label={`Remove ${row.displayValue}`}
                    className="inline-flex h-7 items-center gap-1 px-2 text-[11px]"
                    onClick={() => void removeEntry(row.id)}
                    type="button"
                    variant="danger"
                  >
                    <Trash2 className="size-3" />
                    Remove
                  </DashButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (embedded) return body;

  return <DashPanel>{body}</DashPanel>;
}
