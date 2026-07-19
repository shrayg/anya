"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";

import { AccountSecurityPanel } from "@/components/dashboard/account-security-panel";
import { AdminUsersPanel } from "@/components/dashboard/admin-users-panel";
import { AdminWorkspaceDashboard } from "@/components/dashboard/admin-workspace-dashboard";
import { HelperUsersPanel } from "@/components/dashboard/helper-users-panel";
import { SafetyFlagsPanel } from "@/components/dashboard/safety-flags-panel";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { StaffBadge } from "@/components/dashboard/staff-badge";
import {
  AccountBillingNote,
  AccountStatRail,
  AccountUsagePanel,
  UpgradeLink,
} from "@/components/dashboard/account-stat-rail";
import type { UserProfile, UserStats } from "@/lib/account-plan";
import { formatCredits, getPlanDisplayLabel } from "@/lib/account-plan";
import { getPlanDefinition, resolveUserPlan } from "@/lib/plans";
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
      recoveryEmail: dashboardUser.recoveryEmail,
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
  const planName = getPlanDefinition(resolveUserPlan(profile)).name;

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

          <section className="space-y-4" id="account">
            <h2 className="text-lg font-semibold text-white">Your account</h2>
            <AccountSecurityPanel
              initialRecoveryEmail={profile.recoveryEmail}
              username={profile.username}
            />
          </section>
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
              <span className="anya-hero-kicker">account</span>
              <h1 className="anya-hero-title font-[family-name:var(--font-bruno-ace-sc)]">
                Account settings
              </h1>
              <p className="anya-hero-lede">
                Manage profile, security, and plan for{" "}
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
                <span className="anya-pill capitalize">
                  <Shield className="size-3" />
                  {planName} plan
                </span>
                <UpgradeLink />
              </div>
            </div>
          </section>

          <section className="mb-8 max-w-md">
            <AccountStatRail
              credits={formatCredits(profile?.balance)}
              profile={profile}
              stats={stats}
            />
          </section>

          <section className="mb-8 max-w-2xl" id="security">
            <AccountSecurityPanel
              initialRecoveryEmail={profile.recoveryEmail}
              username={profile.username}
            />
          </section>

          <section className="mb-8 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-sm font-semibold text-white">Plan & billing</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Current access:{" "}
              <span className="capitalize text-zinc-300">
                {getPlanDisplayLabel(profile)}
              </span>
              {stats?.billingInterval
                ? ` · billed ${stats.billingInterval}`
                : profile.billingInterval
                  ? ` · billed ${profile.billingInterval}`
                  : null}
              {stats?.planEndsAt
                ? ` · period ends ${new Date(stats.planEndsAt).toLocaleDateString()}`
                : null}
              . Upgrade, switch plans, or buy credits on Pricing.
            </p>
            <AccountBillingNote stats={stats} />
            <div className="mt-4 flex flex-wrap gap-3">
              <UpgradeLink />
              <a className="anya-link-btn" href="/pricing">
                Manage plan / credits
              </a>
            </div>
            {dashboardUser.apiAccess && dashboardUser.apiKey ? (
              <div className="mt-4 rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-indigo-200">
                  API key
                </p>
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
