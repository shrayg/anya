"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flag, FolderOpen, RefreshCw, Users } from "lucide-react";
import clsx from "clsx";

import { apiFetch } from "@/lib/csrf-client";
import {
  DashButton,
  DashInput,
  DashPanel,
  StatCard,
} from "@/components/dashboard/dashboard-ui";
import { StaffBadge } from "@/components/dashboard/staff-badge";
import { formatDate } from "@/lib/format-datetime";
import {
  ACCOUNT_STATUS_META,
  INVESTIGATION_STATUS_META,
  type AccountStatus,
  type InvestigationStatus,
} from "@/lib/workspace-admin";

type HelperUser = {
  id: number;
  username: string;
  staffRole?: string | null;
  accountStatus: AccountStatus;
  investigationStatus?: InvestigationStatus | null;
  investigationFlaggedAt?: string | null;
  investigationFlaggedByUsername?: string | null;
  investigationNote?: string | null;
  createdAt: string;
  _count?: {
    cases: number;
    searches: number;
  };
};

type HelperCase = {
  id: number;
  title: string;
  subjectName: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  _count?: { searches: number };
};

function StatusBadge({ status }: { status: AccountStatus }) {
  const meta = ACCOUNT_STATUS_META[status] ?? ACCOUNT_STATUS_META.active;

  return (
    <span
      className={clsx(
        "rounded-full border px-2.5 py-1 text-xs font-semibold",
        meta.badgeClass,
      )}
    >
      {meta.label}
    </span>
  );
}

export function HelperUsersPanel() {
  const [users, setUsers] = useState<HelperUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [flagNotes, setFlagNotes] = useState<Record<number, string>>({});
  const [casesUserId, setCasesUserId] = useState<number | null>(null);
  const [casesUsername, setCasesUsername] = useState("");
  const [cases, setCases] = useState<HelperCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workspace/helper/members", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not load users.");

        return;
      }

      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setError("Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return users;

    return users.filter((user) =>
      user.username.toLowerCase().includes(normalized),
    );
  }, [query, users]);

  const flaggedCount = useMemo(
    () => users.filter((user) => user.accountStatus === "investigate").length,
    [users],
  );

  const updateUser = (userId: number, patch: Partial<HelperUser>) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, ...patch } : user,
      ),
    );
  };

  const handleFlag = async (user: HelperUser) => {
    setActionId(user.id);
    setError("");

    try {
      const response = await apiFetch(
        `/api/workspace/helper/members/${user.id}/flag`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: flagNotes[user.id]?.trim() || undefined,
            investigationStatus: "flagged",
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not flag account.");

        return;
      }

      if (data.user) updateUser(user.id, data.user);
      setFlagNotes((current) => {
        const next = { ...current };

        delete next[user.id];

        return next;
      });
    } catch {
      setError("Could not flag account.");
    } finally {
      setActionId(null);
    }
  };

  const loadUserCases = async (user: HelperUser) => {
    setCasesUserId(user.id);
    setCasesUsername(user.username);
    setCasesLoading(true);
    setCasesError("");
    setCases([]);

    try {
      const response = await fetch(
        `/api/workspace/helper/members/${user.id}/cases`,
        { cache: "no-store" },
      );
      const data = await response.json();

      if (!response.ok) {
        setCasesError(data.error || "Could not load cases.");

        return;
      }

      setCases(Array.isArray(data.cases) ? data.cases : []);
    } catch {
      setCasesError("Could not load cases.");
    } finally {
      setCasesLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          accent="teal"
          hint="Accounts visible to helpers"
          icon={Users}
          label="Users"
          value={users.length}
        />
        <StatCard
          accent="amber"
          hint="Awaiting admin review"
          icon={Flag}
          label="Flagged"
          value={flaggedCount}
        />
      </div>

      <DashPanel glow="teal">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Helper roster</h2>
            <p className="text-sm text-zinc-400">
              Usernames only. Investigate flags the account for admins; Cases
              shows that member&apos;s case files (read-only).
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <DashInput
              className="sm:w-64"
              placeholder="Search username..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <DashButton
              className="inline-flex items-center justify-center gap-2"
              variant="secondary"
              onClick={loadUsers}
            >
              <RefreshCw
                className={clsx("size-4", loading && "animate-spin")}
              />
              Refresh
            </DashButton>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                <th className="px-3 py-3 font-semibold">User</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Activity</th>
                <th className="px-3 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-8 text-zinc-500" colSpan={4}>
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-zinc-500" colSpan={4}>
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const status = user.accountStatus ?? "active";
                  const flagged = status === "investigate";
                  const busy = actionId === user.id;
                  const phase = user.investigationStatus
                    ? INVESTIGATION_STATUS_META[user.investigationStatus]?.label
                    : null;

                  return (
                    <tr
                      key={user.id}
                      className={clsx(
                        "border-b border-white/5 transition hover:bg-white/[0.02]",
                        ACCOUNT_STATUS_META[status]?.rowClass,
                      )}
                    >
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-semibold text-white">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-white">
                                {user.username}
                              </p>
                              <StaffBadge role={user.staffRole} size="xs" />
                            </div>
                            <p className="text-xs text-zinc-500">
                              ID {user.id} · joined {formatDate(user.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <StatusBadge status={status} />
                        {flagged && (
                          <p className="mt-2 text-xs text-yellow-200/80">
                            {phase ?? "Flagged"}
                            {user.investigationFlaggedByUsername
                              ? ` · by ${user.investigationFlaggedByUsername}`
                              : ""}
                            {user.investigationFlaggedAt
                              ? ` · ${formatDate(user.investigationFlaggedAt)}`
                              : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-4 text-zinc-400">
                        <p>{user._count?.searches ?? 0} searches</p>
                        <p className="text-xs text-zinc-500">
                          {user._count?.cases ?? 0} cases
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex min-w-[12rem] flex-col gap-2">
                          {!flagged && (
                            <DashInput
                              className="text-xs"
                              disabled={busy}
                              placeholder="Optional note for admins"
                              value={flagNotes[user.id] ?? ""}
                              onChange={(event) =>
                                setFlagNotes((current) => ({
                                  ...current,
                                  [user.id]: event.target.value,
                                }))
                              }
                            />
                          )}
                          <div className="flex flex-wrap gap-2">
                            <button
                              className={clsx(
                                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
                                flagged
                                  ? "border-yellow-400/30 bg-yellow-500/10 text-yellow-100"
                                  : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20",
                              )}
                              disabled={busy || flagged}
                              type="button"
                              onClick={() => handleFlag(user)}
                            >
                              <Flag className="size-3.5" />
                              {flagged ? "Flagged" : "Investigate"}
                            </button>
                            <button
                              className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20"
                              type="button"
                              onClick={() => loadUserCases(user)}
                            >
                              <FolderOpen className="size-3.5" />
                              Cases
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DashPanel>

      {casesUserId !== null && (
        <DashPanel glow="amber">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Cases for {casesUsername}
              </h2>
              <p className="text-sm text-zinc-400">
                Read-only case files owned by this member.
              </p>
            </div>
            <DashButton
              variant="secondary"
              onClick={() => {
                setCasesUserId(null);
                setCases([]);
                setCasesError("");
              }}
            >
              Close
            </DashButton>
          </div>

          {casesError && (
            <p className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {casesError}
            </p>
          )}

          {casesLoading ? (
            <p className="text-sm text-zinc-500">Loading cases...</p>
          ) : cases.length === 0 ? (
            <p className="text-sm text-zinc-500">No cases for this user.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    <th className="px-3 py-3 font-semibold">Case</th>
                    <th className="px-3 py-3 font-semibold">Subject</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium text-white">{entry.title}</p>
                        <p className="text-xs text-zinc-500">
                          {entry._count?.searches ?? 0} linked searches
                        </p>
                      </td>
                      <td className="px-3 py-3 text-zinc-300">
                        <p>{entry.subjectName || "—"}</p>
                        {entry.username && (
                          <p className="text-xs text-zinc-500">
                            @{entry.username}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-zinc-400">
                        {entry.status}
                      </td>
                      <td className="px-3 py-3 text-zinc-500">
                        {formatDate(entry.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashPanel>
      )}
    </div>
  );
}
