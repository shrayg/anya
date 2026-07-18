"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";

import { AdminUsersPanel } from "@/components/dashboard/admin-users-panel";
import { AdminWorkspaceDashboard } from "@/components/dashboard/admin-workspace-dashboard";
import { HelperUsersPanel } from "@/components/dashboard/helper-users-panel";
import { SafetyFlagsPanel } from "@/components/dashboard/safety-flags-panel";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { StaffBadge } from "@/components/dashboard/staff-badge";
import {
  AccountStatRail,
  AccountUsagePanel,
  UpgradeLink,
} from "@/components/dashboard/account-stat-rail";
import type { UserProfile, UserStats } from "@/lib/account-plan";
import { formatBalance } from "@/lib/account-plan";
import { siteConfig } from "@/config/site";

export default function SettingsPage() {
  const dashboardUser = useDashboardUser();
  const profile = useMemo<UserProfile>(
    () => ({
      username: dashboardUser.username,
      isAdmin: dashboardUser.isAdmin,
      staffRole: dashboardUser.staffRole,
      plan: dashboardUser.plan,
      balance: dashboardUser.balance,
      billingInterval: dashboardUser.billingInterval,
      apiAccess: dashboardUser.apiAccess,
      apiKey: dashboardUser.apiKey,
      freeTier: dashboardUser.freeTier,
      professionalTier: dashboardUser.professionalTier,
      investigatorTier: dashboardUser.investigatorTier,
      enterpriseTier: dashboardUser.enterpriseTier,
    }),
    [dashboardUser],
  );
  const [stats, setStats] = useState<UserStats | null>(null);
  const canManageWorkspace = dashboardUser.canManageWorkspace;
  const canAccessHelperDashboard = dashboardUser.canAccessHelperDashboard;

  useEffect(() => {
    fetch("/api/user/stats")
      .then((response) => response.json())
      .then((data) => {
        if (!data.error) {
          setStats(data);
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="anya-desk px-6 py-6 md:px-8 md:py-8">
      {canManageWorkspace ? (
        <section className="mb-10 space-y-8" id="admin">
          <section className="anya-hero">
            <div className="anya-hero-main">
              <span className="anya-hero-kicker">admin workspace</span>
              <h1 className="anya-hero-title font-[family-name:var(--font-bruno-ace-sc)]">
                Admin Dashboard
              </h1>
              <p className="anya-hero-lede">
                Manage users, plans, account status, and workspace activity for{" "}
                {siteConfig.name}
              </p>
            </div>
          </section>
          <AdminWorkspaceDashboard />
          <SafetyFlagsPanel mode="admin" />
          <AdminUsersPanel />
        </section>
      ) : canAccessHelperDashboard ? (
        <section className="mb-10 space-y-8" id="helper">
          <section className="anya-hero">
            <div className="anya-hero-main">
              <span className="anya-hero-kicker">helper workspace</span>
              <h1 className="anya-hero-title font-[family-name:var(--font-bruno-ace-sc)]">
                Helper Dashboard
              </h1>
              <p className="anya-hero-lede">
                Check safety flags, message flagged users, Investigate accounts,
                and view member cases. Payments and passwords are hidden.
              </p>
            </div>
          </section>
          <SafetyFlagsPanel mode="helper" />
          <HelperUsersPanel />
        </section>
      ) : (
        <>
          <section className="anya-hero mb-10">
            <div className="anya-hero-main">
              <span className="anya-hero-kicker">settings</span>
              <h1 className="anya-hero-title font-[family-name:var(--font-bruno-ace-sc)]">
                Account
              </h1>
              <p className="anya-hero-lede">
                Plan, usage limits, and membership details for{" "}
                <em>{profile?.username ?? "your account"}</em>
                {profile?.staffRole ? (
                  <>
                    {" "}
                    <StaffBadge role={profile.staffRole} size="sm" />
                  </>
                ) : null}
                .
              </p>
              <div className="anya-hero-actions">
                <span className="anya-pill">
                  <Shield className="size-3" />
                  2FA not enabled
                </span>
                <button className="anya-link-btn" type="button">
                  Enable now
                </button>
                <UpgradeLink />
              </div>
            </div>
          </section>

          <section className="mb-8 max-w-md">
            <AccountStatRail
              credits={formatBalance(profile?.balance)}
              profile={profile}
              stats={stats}
            />
          </section>

          <section className="mb-8 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-sm font-semibold text-white">Billing & API</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Manage credits, subscriptions, and API access on the pricing page.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <UpgradeLink />
              <a className="anya-link-btn" href="/pricing">
                Buy credits / API
              </a>
            </div>
            {dashboardUser.apiAccess && dashboardUser.apiKey ? (
              <div className="mt-4 rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-indigo-200">API key</p>
                <code className="mt-1 block break-all font-mono text-xs text-white">
                  {dashboardUser.apiKey}
                </code>
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">
                No API access on this account yet.
              </p>
            )}
          </section>

          <section className="max-w-2xl">
            <AccountUsagePanel stats={stats} />
          </section>
        </>
      )}
    </div>
  );
}
