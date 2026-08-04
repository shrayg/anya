"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Send,
} from "lucide-react";
import clsx from "clsx";

import { apiFetch } from "@/lib/csrf-client";
import {
  DashButton,
  DashInput,
  DashPanel,
  DashSelect,
  StatCard,
} from "@/components/dashboard/dashboard-ui";
import { formatDate, formatTime } from "@/lib/format-datetime";
import { parseHelperMessageHistory } from "@/lib/safety-search-flags";

type SafetyFlagRow = {
  id: number;
  publicId: string;
  userId: number;
  source: string;
  reasonCode: string;
  category: string;
  status: "open" | "reviewing" | "resolved";
  queryPreview: string;
  moduleSlug: string | null;
  searchType: string | null;
  matchedRules: string;
  reason: string;
  helperMessage: string | null;
  helperMessageHistory?: string | null;
  notifiedAt: string | null;
  acknowledgedAt: string | null;
  reviewedByUsername: string | null;
  reviewNote: string | null;
  assignedHelperUsername: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: {
    id: number;
    username: string;
    accountStatus: string;
    investigationStatus: string | null;
  };
};

type FlagsSummary = {
  open: number;
  reviewing: number;
  needsReview: number;
};

const STATUS_META: Record<
  SafetyFlagRow["status"],
  { label: string; className: string }
> = {
  open: {
    label: "Open",
    className: "border-amber-400/30 bg-amber-500/15 text-amber-100",
  },
  reviewing: {
    label: "Reviewing",
    className: "border-sky-400/30 bg-sky-500/15 text-sky-100",
  },
  resolved: {
    label: "Resolved",
    className: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
  },
};

function parseRules(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function SafetyFlagsPanel({
  mode,
  embedded = false,
}: {
  mode: "helper" | "admin";
  embedded?: boolean;
}) {
  const [flags, setFlags] = useState<SafetyFlagRow[]>([]);
  const [summary, setSummary] = useState<FlagsSummary>({
    open: 0,
    reviewing: 0,
    needsReview: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    mode === "admin" ? "all" : "needs",
  );
  const [actionId, setActionId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deliveryNote, setDeliveryNote] = useState("");

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (
        statusFilter === "open" ||
        statusFilter === "reviewing" ||
        statusFilter === "resolved"
      ) {
        params.set("status", statusFilter);
      }

      const response = await fetch(
        `/api/workspace/flags${params.toString() ? `?${params}` : ""}`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not load safety flags.");

        return;
      }

      setFlags(Array.isArray(data.flags) ? data.flags : []);
      setSummary(data.summary ?? { open: 0, reviewing: 0, needsReview: 0 });
    } catch {
      setError("Could not load safety flags.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const visibleFlags = useMemo(() => {
    if (statusFilter === "needs") {
      return flags.filter(
        (flag) => flag.status === "open" || flag.status === "reviewing",
      );
    }

    return flags;
  }, [flags, statusFilter]);

  const selected = useMemo(
    () => visibleFlags.find((flag) => flag.id === selectedId) ?? null,
    [selectedId, visibleFlags],
  );

  const messageHistory = useMemo(
    () =>
      selected
        ? parseHelperMessageHistory(selected.helperMessageHistory).reverse()
        : [],
    [selected],
  );

  const patchFlag = async (flagId: number, body: Record<string, unknown>) => {
    setActionId(flagId);
    setError("");
    setDeliveryNote("");

    try {
      const response = await apiFetch(`/api/workspace/flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not update flag.");

        return;
      }

      if (data.flag) {
        setFlags((current) =>
          current.map((flag) => (flag.id === flagId ? data.flag : flag)),
        );
      }

      if (body.action === "message" && data.deliveredTo?.username) {
        setMessages((current) => ({ ...current, [flagId]: "" }));
        setDeliveryNote(
          `Delivered to @${data.deliveredTo.username} — they see a dashboard notice until they acknowledge. Staff can only view it here.`,
        );
      }

      await loadFlags();
    } catch {
      setError("Could not update flag.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className={clsx(embedded ? "space-y-3" : "space-y-6")}>
      <div className="grid gap-2 sm:grid-cols-3">
        <StatCard
          accent="amber"
          className={
            embedded
              ? "!p-2.5 [&_.dash-stat-top]:!mb-1.5 [&_.dash-stat-value]:!text-xl [&_.dash-stat-hint]:!mt-1 [&_.dash-stat-hint]:!text-[10px] [&_.dash-stat-icon]:!size-7"
              : undefined
          }
          hint="Needs first look"
          icon={AlertTriangle}
          label="Open"
          value={summary.open}
        />
        <StatCard
          accent="violet"
          className={
            embedded
              ? "!p-2.5 [&_.dash-stat-top]:!mb-1.5 [&_.dash-stat-value]:!text-xl [&_.dash-stat-hint]:!mt-1 [&_.dash-stat-hint]:!text-[10px] [&_.dash-stat-icon]:!size-7"
              : undefined
          }
          hint="In progress"
          icon={ClipboardList}
          label="Reviewing"
          value={summary.reviewing}
        />
        <StatCard
          accent="teal"
          className={
            embedded
              ? "!p-2.5 [&_.dash-stat-top]:!mb-1.5 [&_.dash-stat-value]:!text-xl [&_.dash-stat-hint]:!mt-1 [&_.dash-stat-hint]:!text-[10px] [&_.dash-stat-icon]:!size-7"
              : undefined
          }
          hint="Helpers must clear this queue"
          icon={CheckCircle2}
          label="Needs review"
          value={summary.needsReview}
        />
      </div>

      <DashPanel className={embedded ? "!p-3" : undefined} glow="amber">
        <div
          className={clsx(
            "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
            embedded ? "mb-2" : "mb-5 gap-3",
          )}
        >
          {!embedded ? (
            <div>
              <h2 className="text-lg font-semibold text-white">Flags to check</h2>
              <p className="text-sm text-zinc-400">
                Auto-detected underage-risk searches and helper Investigate
                flags. Open a case, mark reviewing, send a message to the user,
                then resolve with a note.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500">
              {summary.needsReview} need review · {visibleFlags.length} shown
            </p>
          )}

          <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row">
            <DashSelect
              className={clsx(
                embedded ? "h-7 text-[11px]" : "text-sm",
              )}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="needs">Open + reviewing</option>
              <option value="open">Open only</option>
              <option value="reviewing">Reviewing only</option>
              {mode === "admin" && <option value="resolved">Resolved</option>}
              {mode === "admin" && <option value="all">All</option>}
            </DashSelect>
            <DashButton
              className={clsx(
                "inline-flex items-center justify-center gap-1.5",
                embedded && "h-7 px-2 text-[11px]",
              )}
              variant="secondary"
              onClick={loadFlags}
            >
              <RefreshCw
                className={clsx(
                  loading && "animate-spin",
                  embedded ? "size-3" : "size-4",
                )}
              />
              Refresh
            </DashButton>
          </div>
        </div>

        {error && (
          <p
            className={clsx(
              "rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-200",
              embedded
                ? "mb-2 px-2.5 py-1.5 text-[11px]"
                : "mb-4 px-3 py-2 text-sm",
            )}
          >
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table
            className={clsx(
              "min-w-full text-left",
              embedded ? "text-[11px]" : "text-sm",
            )}
          >
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                <th className={clsx(embedded ? "px-1.5 py-1.5" : "px-3 py-3", "font-semibold")}>
                  Case
                </th>
                <th className={clsx(embedded ? "px-1.5 py-1.5" : "px-3 py-3", "font-semibold")}>
                  User
                </th>
                <th className={clsx(embedded ? "px-1.5 py-1.5" : "px-3 py-3", "font-semibold")}>
                  Status
                </th>
                <th className={clsx(embedded ? "px-1.5 py-1.5" : "px-3 py-3", "font-semibold")}>
                  Signal
                </th>
                <th className={clsx(embedded ? "px-1.5 py-1.5" : "px-3 py-3", "font-semibold")}>
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className={clsx(
                      "text-zinc-500",
                      embedded ? "px-2 py-4" : "px-3 py-8",
                    )}
                    colSpan={5}
                  >
                    Loading flags...
                  </td>
                </tr>
              ) : visibleFlags.length === 0 ? (
                <tr>
                  <td
                    className={clsx(
                      "text-zinc-500",
                      embedded ? "px-2 py-4" : "px-3 py-8",
                    )}
                    colSpan={5}
                  >
                    No flags in this filter.
                  </td>
                </tr>
              ) : (
                visibleFlags.map((flag) => {
                  const meta = STATUS_META[flag.status];
                  const cell = embedded ? "px-1.5 py-1.5" : "px-3 py-3";

                  return (
                    <tr
                      key={flag.id}
                      className={clsx(
                        "cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03]",
                        selectedId === flag.id && "bg-amber-500/[0.06]",
                      )}
                      onClick={() => {
                        setSelectedId(flag.id);
                        setDeliveryNote("");
                      }}
                    >
                      <td className={cell}>
                        <p className="font-medium text-white">
                          #{flag.id} · {flag.reasonCode || flag.source}
                        </p>
                        <p className="max-w-xs truncate text-[10px] text-zinc-500">
                          {flag.moduleSlug || flag.searchType || "manual"}
                        </p>
                      </td>
                      <td className={clsx(cell, "text-zinc-200")}>
                        {flag.user.username}
                      </td>
                      <td className={cell}>
                        <span
                          className={clsx(
                            "rounded-full border font-semibold",
                            embedded
                              ? "px-1.5 py-0.5 text-[10px]"
                              : "px-2.5 py-1 text-xs",
                            meta.className,
                          )}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className={clsx(cell, "text-zinc-400")}>
                        <p className="max-w-sm truncate">
                          {flag.reason || "—"}
                        </p>
                      </td>
                      <td className={clsx(cell, "text-zinc-500")}>
                        {formatDate(flag.createdAt)}{" "}
                        <span className="text-zinc-600">
                          {formatTime(flag.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DashPanel>

      {selected && (
        <DashPanel className={embedded ? "!p-3" : undefined} glow="violet">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3
                className={clsx(
                  "font-semibold text-white",
                  embedded ? "text-sm" : "text-lg",
                )}
              >
                Case #{selected.id}
              </h3>
              <p className={clsx(embedded ? "text-[11px]" : "text-sm", "text-zinc-400")}>
                {selected.reasonCode} · {selected.source} · user{" "}
                {selected.user.username}
              </p>
            </div>
            <DashButton
              className={embedded ? "h-7 px-2 text-[11px]" : undefined}
              variant="secondary"
              onClick={() => setSelectedId(null)}
            >
              Close
            </DashButton>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Triggered query (staff only)
                </p>
                <p className="mt-1 break-words rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-zinc-200">
                  {selected.queryPreview}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Matched rules
                </p>
                <p className="mt-1 text-zinc-300">
                  {parseRules(selected.matchedRules).join(", ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Reason
                </p>
                <p className="mt-1 text-zinc-300">{selected.reason || "—"}</p>
              </div>
              {selected.helperMessage && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Latest message to @{selected.user.username}
                  </p>
                  <p className="mt-1 text-zinc-300">{selected.helperMessage}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {selected.notifiedAt
                      ? `Delivered ${formatDate(selected.notifiedAt)}`
                      : "Not sent"}
                    {selected.acknowledgedAt
                      ? ` · user acknowledged ${formatDate(selected.acknowledgedAt)}`
                      : " · awaiting user acknowledgment"}
                  </p>
                </div>
              )}
              {messageHistory.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Message history (staff view)
                  </p>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-zinc-400">
                    {messageHistory.map((entry, index) => (
                      <li
                        key={`${entry.at}-${index}`}
                        className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2"
                      >
                        <p className="text-zinc-300 whitespace-pre-wrap">
                          {entry.message}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-500">
                          {entry.byUsername} · {formatDate(entry.at)}{" "}
                          {formatTime(entry.at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.reviewedByUsername && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    Handled by
                  </p>
                  <p className="mt-1 text-zinc-300">
                    {selected.reviewedByUsername}
                    {selected.reviewNote ? ` — ${selected.reviewNote}` : ""}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Message to flagged user (@{selected.user.username})
                </p>
                <DashInput
                  disabled={
                    actionId === selected.id || selected.status === "resolved"
                  }
                  placeholder="Shown as their on-screen dashboard notice until they acknowledge"
                  value={messages[selected.id] ?? ""}
                  onChange={(event) =>
                    setMessages((current) => ({
                      ...current,
                      [selected.id]: event.target.value,
                    }))
                  }
                />
                <button
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2.5 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-50"
                  disabled={
                    actionId === selected.id ||
                    selected.status === "resolved" ||
                    !messages[selected.id]?.trim()
                  }
                  type="button"
                  onClick={() =>
                    patchFlag(selected.id, {
                      action: "message",
                      helperMessage: messages[selected.id]?.trim(),
                    })
                  }
                >
                  <Send className="size-3.5" />
                  Send to @{selected.user.username}
                </button>
                {deliveryNote && (
                  <p className="mt-2 text-xs text-emerald-300/90">
                    {deliveryNote}
                  </p>
                )}
              </div>

              <DashInput
                disabled={actionId === selected.id}
                placeholder="Internal review note (required when resolving)"
                value={notes[selected.id] ?? selected.reviewNote ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [selected.id]: event.target.value,
                  }))
                }
              />
              <div className="flex flex-wrap gap-2">
                {selected.status === "open" && (
                  <button
                    className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20"
                    disabled={actionId === selected.id}
                    type="button"
                    onClick={() =>
                      patchFlag(selected.id, { status: "reviewing" })
                    }
                  >
                    Mark reviewing
                  </button>
                )}
                {selected.status !== "resolved" && (
                  <button
                    className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                    disabled={
                      actionId === selected.id ||
                      !(notes[selected.id]?.trim() || selected.reviewNote)
                    }
                    type="button"
                    onClick={() =>
                      patchFlag(selected.id, {
                        status: "resolved",
                        reviewNote: notes[selected.id]?.trim(),
                      })
                    }
                  >
                    Mark checked / resolved
                  </button>
                )}
                {mode === "admin" && selected.status !== "resolved" && (
                  <button
                    className="rounded-md border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
                    disabled={actionId === selected.id}
                    type="button"
                    onClick={() =>
                      patchFlag(selected.id, {
                        status: "reviewing",
                        escalateAccount: true,
                        reviewNote: notes[selected.id]?.trim(),
                      })
                    }
                  >
                    Escalate account
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Passwords and payments stay hidden from helpers. Resolving a
                search flag does not auto-clear the account investigate badge —
                admins clear that separately.
              </p>
            </div>
          </div>
        </DashPanel>
      )}
    </div>
  );
}
