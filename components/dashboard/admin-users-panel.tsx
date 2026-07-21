"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Flag,
  KeyRound,
  RefreshCw,
  Shield,
  Snowflake,
  Trash2,
  Users,
} from "lucide-react";
import clsx from "clsx";

import { apiFetch } from "@/lib/csrf-client";
import {
  DashButton,
  DashInput,
  DashPanel,
  StatCard,
} from "@/components/dashboard/dashboard-ui";
import { PlanPicker } from "@/components/dashboard/plan-picker";
import {
  StaffBadge,
  StaffRolePicker,
} from "@/components/dashboard/staff-badge";
import { formatDate } from "@/lib/format-datetime";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { resolveUserPlan, type PlanId } from "@/lib/plans";
import { parseStaffRole, type StaffRole } from "@/lib/staff-roles";
import {
  ACCOUNT_STATUS_META,
  INVESTIGATION_STATUS_META,
  hasWorkspaceAdminAccess,
  type AccountStatus,
  type InvestigationStatus,
} from "@/lib/workspace-admin";

type StatusFilter = "all" | AccountStatus;

type AdminUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  staffRole?: string | null;
  plan: string;
  balance: number;
  accountStatus: AccountStatus;
  investigationStatus?: InvestigationStatus | null;
  investigationFlaggedAt?: string | null;
  investigationFlaggedById?: number | null;
  investigationFlaggedByUsername?: string | null;
  investigationNote?: string | null;
  createdAt: string;
  freeTier?: boolean;
  professionalTier?: boolean;
  investigatorTier?: boolean;
  enterpriseTier?: boolean;
  passwordSet?: boolean;
  passwordStatus?: "hashed";
  passwordHashPreview?: string | null;
  _count?: {
    searches: number;
    payments: number;
  };
};

function StatusBadge({ status }: { status: AccountStatus }) {
  const meta = ACCOUNT_STATUS_META[status] ?? ACCOUNT_STATUS_META.active;

  return (
    <span
      className={clsx(
        "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
        meta.badgeClass,
      )}
    >
      {meta.label}
    </span>
  );
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>(
    {},
  );
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>(
    {},
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workspace/members", {
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

  const flaggedCount = useMemo(
    () => users.filter((user) => user.accountStatus === "investigate").length,
    [users],
  );

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return users.filter((user) => {
      if (
        statusFilter !== "all" &&
        (user.accountStatus ?? "active") !== statusFilter
      ) {
        return false;
      }

      if (!normalized) return true;

      return user.username.toLowerCase().includes(normalized);
    });
  }, [query, statusFilter, users]);

  const updateUser = (userId: number, patch: Partial<AdminUser>) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, ...patch } : user,
      ),
    );
  };

  const handleStaffRoleChange = async (
    userId: number,
    staffRole: StaffRole | null,
  ) => {
    setActionId(userId);
    setError("");

    try {
      const response = await apiFetch(
        `/api/workspace/members/${userId}/staff-role`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ staffRole }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not update staff badge.");

        return;
      }

      if (data.user) updateUser(userId, data.user);
    } catch {
      setError("Could not update staff badge.");
    } finally {
      setActionId(null);
    }
  };

  const handlePasswordReset = async (userId: number) => {
    const password = passwordDrafts[userId]?.trim() ?? "";

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

      return;
    }

    setActionId(userId);
    setError("");

    try {
      const response = await apiFetch(
        `/api/workspace/members/${userId}/password`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not reset password.");

        return;
      }

      setResetPasswords((current) => ({
        ...current,
        [userId]: String(data.password ?? password),
      }));
      setPasswordDrafts((current) => ({ ...current, [userId]: "" }));
    } catch {
      setError("Could not reset password.");
    } finally {
      setActionId(null);
    }
  };

  const handlePlanChange = async (userId: number, plan: PlanId) => {
    setActionId(userId);
    setError("");

    try {
      const response = await apiFetch(`/api/workspace/members/${userId}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not update plan.");

        return;
      }

      if (data.user) updateUser(userId, data.user);
    } catch {
      setError("Could not update plan.");
    } finally {
      setActionId(null);
    }
  };

  const handleStatusChange = async (
    userId: number,
    status: AccountStatus,
    options?: { investigationStatus?: InvestigationStatus },
  ) => {
    setActionId(userId);
    setError("");

    try {
      const response = await apiFetch(
        `/api/workspace/members/${userId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            investigationStatus: options?.investigationStatus,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not update account status.");

        return;
      }

      if (data.user) updateUser(userId, data.user);
    } catch {
      setError("Could not update account status.");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    const confirmed = window.confirm(
      `Delete ${user.username}? This permanently removes their account, searches, and cases.`,
    );

    if (!confirmed) return;

    setActionId(user.id);
    setError("");

    try {
      const response = await apiFetch(`/api/workspace/members/${user.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not delete user.");

        return;
      }

      setUsers((current) => current.filter((entry) => entry.id !== user.id));
    } catch {
      setError("Could not delete user.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          accent="violet"
          hint="Registered accounts"
          icon={Users}
          label="Total users"
          value={users.length}
        />
        <StatCard
          accent="teal"
          hint="Paid or trial plans"
          icon={Shield}
          label="Subscribed"
          value={
            users.filter((user) => resolveUserPlan(user) !== "free").length
          }
        />
        <StatCard
          accent="violet"
          hint="Frozen accounts"
          icon={Snowflake}
          label="Frozen"
          value={users.filter((user) => user.accountStatus === "frozen").length}
        />
        <StatCard
          accent="rose"
          hint="Banned accounts"
          icon={Ban}
          label="Banned"
          value={users.filter((user) => user.accountStatus === "banned").length}
        />
        <StatCard
          accent="amber"
          hint="Awaiting admin review"
          icon={Flag}
          label="Flagged"
          value={flaggedCount}
        />
      </div>

      <DashPanel glow="violet">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Members</h2>
            <p className="text-xs text-zinc-500">
              Plans, passwords, freeze / ban / flag / delete
              {flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <select
              className="h-8 rounded-md border border-white/10 bg-zinc-950/80 px-2 text-xs text-zinc-200 outline-none transition focus:border-violet-400/40"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="frozen">Frozen</option>
              <option value="banned">Banned</option>
              <option value="investigate">Flagged / Investigate</option>
            </select>
            <DashInput
              className="h-8 sm:w-52"
              placeholder="Search username..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <DashButton
              className="inline-flex h-8 items-center justify-center gap-1.5 px-2.5 text-xs"
              variant="secondary"
              onClick={loadUsers}
            >
              <RefreshCw
                className={clsx("size-3.5", loading && "animate-spin")}
              />
              Refresh
            </DashButton>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                <th className="px-2 py-2 font-semibold">User</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Staff</th>
                <th className="px-2 py-2 font-semibold">Plan</th>
                <th className="px-2 py-2 font-semibold">Password</th>
                <th className="px-2 py-2 font-semibold">Activity</th>
                <th className="px-2 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-8 text-zinc-500" colSpan={7}>
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-zinc-500" colSpan={7}>
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const currentPlan = resolveUserPlan(user);
                  const status = user.accountStatus ?? "active";
                  const isWorkspaceAdmin = hasWorkspaceAdminAccess(user);
                  const rowClass = ACCOUNT_STATUS_META[status]?.rowClass ?? "";
                  const busy = actionId === user.id;

                  return (
                    <tr
                      key={user.id}
                      className={clsx(
                        "border-b border-white/5 transition hover:bg-white/[0.02]",
                        rowClass,
                      )}
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-white">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-medium text-white">
                                {user.username}
                              </p>
                              <StaffBadge role={user.staffRole} size="xs" />
                            </div>
                            <p className="text-[10px] text-zinc-500">
                              #{user.id} · {formatDate(user.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge status={status} />
                        {status === "investigate" &&
                        user.investigationFlaggedByUsername ? (
                          <p className="mt-0.5 text-[10px] text-yellow-200/70">
                            by {user.investigationFlaggedByUsername}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <StaffRolePicker
                          disabled={busy}
                          value={parseStaffRole(user.staffRole)}
                          onChange={(staffRole) =>
                            handleStaffRoleChange(user.id, staffRole)
                          }
                        />
                        <button
                          className={clsx(
                            "mt-1 w-full rounded border px-1.5 py-0.5 text-[10px] font-medium transition",
                            isWorkspaceAdmin
                              ? "border-zinc-500/30 bg-white/5 text-zinc-400 hover:bg-white/10"
                              : "border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20",
                          )}
                          disabled={busy}
                          type="button"
                          onClick={() =>
                            handleStaffRoleChange(
                              user.id,
                              isWorkspaceAdmin ? null : "admin",
                            )
                          }
                        >
                          {isWorkspaceAdmin ? "Revoke admin" : "Grant admin"}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <PlanPicker
                          disabled={busy || isWorkspaceAdmin}
                          value={currentPlan}
                          onChange={(plan) => handlePlanChange(user.id, plan)}
                        />
                        <p className="mt-0.5 text-[10px] text-zinc-500">
                          ${user.balance.toFixed(2)}
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex max-w-[160px] flex-col gap-1">
                          <DashInput
                            className="h-7 font-mono text-[11px]"
                            disabled={busy}
                            minLength={MIN_PASSWORD_LENGTH}
                            placeholder={`New pw (min ${MIN_PASSWORD_LENGTH})`}
                            type="text"
                            value={passwordDrafts[user.id] ?? ""}
                            onChange={(event) =>
                              setPasswordDrafts((current) => ({
                                ...current,
                                [user.id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            className="inline-flex items-center justify-center gap-1 rounded border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-violet-100 transition hover:bg-violet-500/20"
                            disabled={busy}
                            type="button"
                            onClick={() => handlePasswordReset(user.id)}
                          >
                            <KeyRound className="size-3" />
                            Reset
                          </button>
                          {resetPasswords[user.id] ? (
                            <p className="break-all font-mono text-[10px] text-emerald-200">
                              {resetPasswords[user.id]}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-[11px] text-zinc-400">
                        <p>{user._count?.searches ?? 0} s</p>
                        <p className="text-zinc-500">
                          {user._count?.payments ?? 0} $
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        {!isWorkspaceAdmin ? (
                          <div className="flex flex-wrap gap-1">
                            <button
                              className={clsx(
                                "rounded border px-1.5 py-0.5 text-[10px] font-semibold transition",
                                ACCOUNT_STATUS_META.frozen.actionClass,
                              )}
                              disabled={busy}
                              type="button"
                              onClick={() =>
                                handleStatusChange(user.id, "frozen")
                              }
                            >
                              Freeze
                            </button>
                            <button
                              className={clsx(
                                "rounded border px-1.5 py-0.5 text-[10px] font-semibold transition",
                                ACCOUNT_STATUS_META.banned.actionClass,
                              )}
                              disabled={busy}
                              type="button"
                              onClick={() =>
                                handleStatusChange(user.id, "banned")
                              }
                            >
                              Ban
                            </button>
                            <button
                              className={clsx(
                                "rounded border px-1.5 py-0.5 text-[10px] font-semibold transition",
                                ACCOUNT_STATUS_META.investigate.actionClass,
                              )}
                              disabled={busy}
                              type="button"
                              onClick={() =>
                                handleStatusChange(user.id, "investigate", {
                                  investigationStatus: "flagged",
                                })
                              }
                            >
                              Flag
                            </button>
                            {status !== "active" && (
                              <button
                                className={clsx(
                                  "rounded border px-1.5 py-0.5 text-[10px] font-semibold transition",
                                  ACCOUNT_STATUS_META.active.actionClass,
                                )}
                                disabled={busy}
                                type="button"
                                onClick={() =>
                                  handleStatusChange(user.id, "active")
                                }
                              >
                                {status === "investigate"
                                  ? "Clear"
                                  : "Restore"}
                              </button>
                            )}
                            <button
                              className="inline-flex items-center gap-0.5 rounded border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-100 transition hover:bg-rose-500/20"
                              disabled={busy}
                              type="button"
                              onClick={() => handleDelete(user)}
                            >
                              <Trash2 className="size-3" />
                              Del
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-500">
                            Protected
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DashPanel>
    </div>
  );
}
