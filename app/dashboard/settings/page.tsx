"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { AccountSecurityPanel } from "@/components/dashboard/account-security-panel";
import { AdminApiStatusPanel } from "@/components/dashboard/admin-api-status-panel";
import { AdminUsersPanel } from "@/components/dashboard/admin-users-panel";
import { AdminWorkspaceDashboard } from "@/components/dashboard/admin-workspace-dashboard";
import { AdminEventLogsPanel } from "@/components/dashboard/admin-event-logs-panel";
import { HelperUsersPanel } from "@/components/dashboard/helper-users-panel";
import { SafetyFlagsPanel } from "@/components/dashboard/safety-flags-panel";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { siteConfig } from "@/config/site";

export default function SettingsPage() {
  const router = useRouter();
  const dashboardUser = useDashboardUser();
  const canManageWorkspace = dashboardUser.canManageWorkspace;
  const canAccessHelperDashboard = dashboardUser.canAccessHelperDashboard;

  useEffect(() => {
    if (!canManageWorkspace && !canAccessHelperDashboard) {
      router.replace("/dashboard/account");
    }
  }, [canAccessHelperDashboard, canManageWorkspace, router]);

  if (!canManageWorkspace && !canAccessHelperDashboard) {
    return (
      <div className="px-6 py-10 text-sm text-zinc-500 md:px-8">
        Redirecting to account…
      </div>
    );
  }

  if (canManageWorkspace) {
    return (
      <div className="anya-desk px-6 py-6 md:px-8 md:py-8">
        <section className="mb-10 space-y-8" id="admin">
          <section className="anya-hero">
            <div className="anya-hero-main">
              <span className="anya-hero-kicker">admin workspace</span>
              <h1 className="anya-hero-title font-[family-name:var(--font-bruno-ace-sc)]">
                Admin
              </h1>
              <p className="anya-hero-lede">
                Manage users, plans, account status, API health, and workspace
                activity for {siteConfig.name}. This surface stays inside the
                panel — there is no public admin endpoint.
              </p>
              <div className="anya-hero-actions">
                <Link className="anya-pill" href="/dashboard/account">
                  Your account
                </Link>
                <Link className="anya-pill" href="#api-status">
                  API status
                </Link>
              </div>
            </div>
          </section>
          <AdminWorkspaceDashboard />
          <AdminApiStatusPanel />
          <AdminEventLogsPanel />
          <SafetyFlagsPanel mode="admin" />
          <AdminUsersPanel />

          <section className="space-y-4" id="account">
            <h2 className="text-lg font-semibold text-white">Your account</h2>
            <AccountSecurityPanel
              initialRecoveryEmail={dashboardUser.recoveryEmail}
              username={dashboardUser.username}
            />
          </section>
        </section>
      </div>
    );
  }

  return (
    <div className="anya-desk px-6 py-6 md:px-8 md:py-8">
      <section className="mb-10 space-y-8" id="helper">
        <section className="anya-hero">
          <div className="anya-hero-main">
            <span className="anya-hero-kicker">helper workspace</span>
            <h1 className="anya-hero-title font-[family-name:var(--font-bruno-ace-sc)]">
              Helper
            </h1>
            <p className="anya-hero-lede">
              Check safety flags, message flagged users, investigate accounts,
              and view member cases. Payments and passwords stay hidden.
            </p>
            <div className="anya-hero-actions">
              <Link className="anya-pill" href="/dashboard/account">
                Your account
              </Link>
            </div>
          </div>
        </section>
        <SafetyFlagsPanel mode="helper" />
        <HelperUsersPanel />
      </section>
    </div>
  );
}
