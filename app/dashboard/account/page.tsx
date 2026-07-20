"use client";

import type { UserProfile, UserStats } from "@/lib/account-plan";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";

import { AccountSecurityPanel } from "@/components/dashboard/account-security-panel";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { StaffBadge } from "@/components/dashboard/staff-badge";
import { AccountPlanBillingPanel } from "@/components/dashboard/account-plan-billing-panel";
import {
  AccountStatRail,
  AccountUsagePanel,
  UpgradeLink,
} from "@/components/dashboard/account-stat-rail";
import { formatCredits } from "@/lib/account-plan";
import { getPlanDefinition, resolveUserPlan } from "@/lib/plans";
import { siteConfig } from "@/config/site";

export default function AccountPage() {
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
  const planName = getPlanDefinition(resolveUserPlan(profile)).name;
  const showStaffLink =
    dashboardUser.canManageWorkspace || dashboardUser.canAccessHelperDashboard;

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
      <section className="anya-hero mb-10">
        <div className="anya-hero-main">
          <span className="anya-hero-kicker">account</span>
          <h1 className="anya-hero-title font-[family-name:var(--font-bruno-ace-sc)]">
            Account
          </h1>
          <p className="anya-hero-lede">
            Profile, security, and plan for <em>{profile.username}</em>
            {profile.staffRole ? (
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
            {showStaffLink ? (
              <Link
                className="anya-pill"
                href={
                  dashboardUser.canManageWorkspace
                    ? "/dashboard/settings#admin"
                    : "/dashboard/settings#helper"
                }
              >
                Open staff workspace
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mb-8 max-w-md">
        <AccountStatRail
          credits={formatCredits(profile.balance)}
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

      <AccountPlanBillingPanel
        profile={profile}
        stats={stats}
        onUpdated={() => {
          fetch("/api/user/stats")
            .then((response) => response.json())
            .then((data) => {
              if (!data.error) setStats(data);
            })
            .catch(() => undefined);
        }}
      />

      <section className="mb-8 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-sm font-semibold text-white">API access</h3>
        {dashboardUser.apiAccess && dashboardUser.apiKey ? (
          <div className="mt-3 rounded-xl border border-pink-400/20 bg-pink-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-pink-200">
              API key
            </p>
            <code className="mt-1 block break-all font-mono text-xs text-white">
              {dashboardUser.apiKey}
            </code>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            No API access on this account yet. See{" "}
            <Link className="text-pink-300 hover:underline" href="/pricing">
              pricing
            </Link>{" "}
            for API products.
          </p>
        )}
      </section>

      <section className="max-w-2xl">
        <AccountUsagePanel stats={stats} />
      </section>

      <p className="mt-10 max-w-2xl text-xs text-zinc-600">
        Need help with billing or access? Visit{" "}
        <Link
          className="text-zinc-400 underline-offset-4 hover:underline"
          href="/support"
        >
          Support
        </Link>{" "}
        or open a ticket in the{" "}
        <Link
          className="text-zinc-400 underline-offset-4 hover:underline"
          href="/dashboard/support"
        >
          panel desk
        </Link>
        . {siteConfig.name} account tools stay inside your authenticated
        workspace.
      </p>
    </div>
  );
}
