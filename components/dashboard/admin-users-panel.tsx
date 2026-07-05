"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, KeyRound, RefreshCw, Shield, Snowflake, Trash2, Users } from "lucide-react";
import clsx from "clsx";

import {
  DashButton,
  DashInput,
  DashPanel,
  StatCard,
} from "@/components/dashboard/dashboard-ui";
import { PlanPicker } from "@/components/dashboard/plan-picker";
import { StaffBadge, StaffRolePicker } from "@/components/dashboard/staff-badge";
import { formatDate } from "@/lib/format-datetime";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { resolveUserPlan, type PlanId } from "@/lib/plans";
import { parseStaffRole, type StaffRole } from "@/lib/staff-roles";
import {
  ACCOUNT_STATUS_META,
  hasWorkspaceAdminAccess,
  type AccountStatus,
} from "@/lib/workspace-admin";

type AdminUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  staffRole?: string | null;
  plan: string;
  balance: number;
  accountStatus: AccountStatus;
  createdAt: string;
  freeTier?: boolean;
  professionalTier?: boolean;
  investigatorTier?: boolean;
  enterpriseTier?: boolean;
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
        "rounded-full border px-2.5 py-1 text-xs font-semibold",
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
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>({});
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({});

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/workspace/members", { cache: "no-store" });
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

    return users.filter((user) => user.username.toLowerCase().includes(normalized));
  }, [query, users]);

  const updateUser = (userId: number, patch: Partial<AdminUser>) => {
    setUsers((current) =>
      current.map((user) => (user.id === userId ? { ...user, ...patch } : user)),
    );
  };

  const handleStaffRoleChange = async (userId: number, staffRole: StaffRole | null) => {
    setActionId(userId);
    setError("");

    try {
      const response = await fetch(`/api/workspace/members/${userId}/staff-role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffRole }),
      });
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
      const response = await fetch(`/api/workspace/members/${userId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
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
      const response = await fetch(`/api/workspace/members/${userId}/plan`, {
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

  const handleStatusChange = async (userId: number, status: AccountStatus) => {
    setActionId(userId);
    setError("");

    try {
      const response = await fetch(`/api/workspace/members/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
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
      const response = await fetch(`/api/workspace/members/${user.id}`, {
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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          value={users.filter((user) => resolveUserPlan(user) !== "free").length}
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
          hint="Banned or flagged"
          icon={Ban}
          label="Restricted"
          value={
            users.filter(
              (user) =>
                user.accountStatus === "banned" || user.accountStatus === "investigate",
            ).length
          }
        />
      </div>

      <DashPanel glow="violet">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Member control</h2>
            <p className="text-sm text-zinc-400">
              Assign plans, reset passwords, freeze, ban, investigate, or delete accounts.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <DashInput
              className="sm:w-64"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search username..."
              value={query}
            />
            <DashButton
              className="inline-flex items-center justify-center gap-2"
              onClick={loadUsers}
              variant="secondary"
            >
              <RefreshCw className={clsx("size-4", loading && "animate-spin")} />
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
                <th className="px-3 py-3 font-semibold">Staff badge</th>
                <th className="px-3 py-3 font-semibold">Plan</th>
                <th className="px-3 py-3 font-semibold">Password</th>
                <th className="px-3 py-3 font-semibold">Activity</th>
                <th className="px-3 py-3 font-semibold">Actions</th>
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
                  const rowClass =
                    ACCOUNT_STATUS_META[status]?.rowClass ?? "";
                  const busy = actionId === user.id;

                  return (
                    <tr
                      key={user.id}
                      className={clsx(
                        "border-b border-white/5 transition hover:bg-white/[0.02]",
                        rowClass,
                      )}
                    >
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-semibold text-white">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-white">{user.username}</p>
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
                        {isWorkspaceAdmin && (
                          <p className="mt-2 text-xs text-zinc-500">Admin dashboard access</p>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <StaffRolePicker
                          disabled={busy}
                          onChange={(staffRole) => handleStaffRoleChange(user.id, staffRole)}
                          value={parseStaffRole(user.staffRole)}
                        />
                        <button
                          className={clsx(
                            "mt-2 w-full rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
                            isWorkspaceAdmin
                              ? "border-zinc-500/30 bg-white/5 text-zinc-300 hover:bg-white/10"
                              : "border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20",
                          )}
                          disabled={busy}
                          onClick={() =>
                            handleStaffRoleChange(user.id, isWorkspaceAdmin ? null : "admin")
                          }
                          type="button"
                        >
                          {isWorkspaceAdmin ? "Revoke admin dashboard" : "Grant admin dashboard"}
                        </button>
                        <p className="mt-2 text-[10px] text-zinc-500">
                          Admin unlocks the sidebar Admin Panel and Settings controls
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <PlanPicker
                          disabled={busy || isWorkspaceAdmin}
                          onChange={(plan) => handlePlanChange(user.id, plan)}
                          value={currentPlan}
                        />
                        <p className="mt-2 text-xs text-zinc-500">
                          Balance ${user.balance.toFixed(2)}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="mb-2 text-xs text-zinc-500">
                          Stored encrypted — cannot view old password
                        </p>
                        {resetPasswords[user.id] ? (
                          <p className="mb-2 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-2 font-mono text-xs text-emerald-100">
                            New password: {resetPasswords[user.id]}
                          </p>
                        ) : null}
                        <DashInput
                          className="mb-2 font-mono text-xs"
                          disabled={busy}
                          minLength={MIN_PASSWORD_LENGTH}
                          onChange={(event) =>
                            setPasswordDrafts((current) => ({
                              ...current,
                              [user.id]: event.target.value,
                            }))
                          }
                          placeholder={`New password (min ${MIN_PASSWORD_LENGTH})`}
                          type="text"
                          value={passwordDrafts[user.id] ?? ""}
                        />
                        <button
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2.5 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/20"
                          disabled={busy}
                          onClick={() => handlePasswordReset(user.id)}
                          type="button"
                        >
                          <KeyRound className="size-3.5" />
                          Reset password
                        </button>
                      </td>
                      <td className="px-3 py-4 text-zinc-400">
                        <p>{user._count?.searches ?? 0} searches</p>
                        <p className="text-xs text-zinc-500">
                          {user._count?.payments ?? 0} payments
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        {!isWorkspaceAdmin ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              className={clsx(
                                "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
                                ACCOUNT_STATUS_META.frozen.actionClass,
                              )}
                              disabled={busy}
                              onClick={() => handleStatusChange(user.id, "frozen")}
                              type="button"
                            >
                              Freeze
                            </button>
                            <button
                              className={clsx(
                                "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
                                ACCOUNT_STATUS_META.banned.actionClass,
                              )}
                              disabled={busy}
                              onClick={() => handleStatusChange(user.id, "banned")}
                              type="button"
                            >
                              Ban
                            </button>
                            <button
                              className={clsx(
                                "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
                                ACCOUNT_STATUS_META.investigate.actionClass,
                              )}
                              disabled={busy}
                              onClick={() => handleStatusChange(user.id, "investigate")}
                              type="button"
                            >
                              Investigate
                            </button>
                            {status !== "active" && (
                              <button
                                className={clsx(
                                  "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
                                  ACCOUNT_STATUS_META.active.actionClass,
                                )}
                                disabled={busy}
                                onClick={() => handleStatusChange(user.id, "active")}
                                type="button"
                              >
                                Restore
                              </button>
                            )}
                            <button
                              className="inline-flex items-center gap-1 rounded-md border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
                              disabled={busy}
                              onClick={() => handleDelete(user)}
                              type="button"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500">Protected staff account</span>
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
