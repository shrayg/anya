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
      <div className="anya-desk px-4 py-4 md:px-6 md:py-5">
        <section className="mb-6 space-y-5" id="admin">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                admin workspace
              </p>
              <h1 className="text-xl font-semibold text-white">Admin</h1>
              <p className="mt-0.5 max-w-xl text-xs text-zinc-500">
                APIs, members, and activity for {siteConfig.name}. Admin-only.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Link
                className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.06]"
                href="#api-status"
              >
                APIs
              </Link>
              <Link
                className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.06]"
                href="#members"
              >
                Members
              </Link>
              <Link
                className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.06]"
                href="#account"
              >
                Account
              </Link>
            </div>
          </header>

          {/* Full endpoint catalog first — every gateway + BreachHub/CSINT path */}
          <AdminApiStatusPanel />

          <AdminWorkspaceDashboard />

          <div id="members">
            <AdminUsersPanel />
          </div>

          <AdminEventLogsPanel />
          <SafetyFlagsPanel mode="admin" />

          <section className="space-y-2" id="account">
            <h2 className="text-sm font-semibold text-white">Your account</h2>
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
    <div className="anya-desk px-4 py-4 md:px-6 md:py-5">
      <section className="mb-6 space-y-5" id="helper">
        <header className="border-b border-white/[0.06] pb-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
            helper workspace
          </p>
          <h1 className="text-xl font-semibold text-white">Helper</h1>
          <p className="mt-0.5 max-w-xl text-xs text-zinc-500">
            Flags, investigations, and member cases. Payments stay hidden.
          </p>
        </header>
        <SafetyFlagsPanel mode="helper" />
        <HelperUsersPanel />
      </section>
    </div>
  );
}
