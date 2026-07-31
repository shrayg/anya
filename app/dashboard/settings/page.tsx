"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AccountSecurityPanel } from "@/components/dashboard/account-security-panel";
import { HelperUsersPanel } from "@/components/dashboard/helper-users-panel";
import { SafetyFlagsPanel } from "@/components/dashboard/safety-flags-panel";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";

export default function SettingsPage() {
  const router = useRouter();
  const dashboardUser = useDashboardUser();
  const canManageWorkspace = dashboardUser.canManageWorkspace;
  const canAccessHelperDashboard = dashboardUser.canAccessHelperDashboard;

  useEffect(() => {
    if (canManageWorkspace) {
      router.replace("/dashboard/admin");

      return;
    }

    if (!canAccessHelperDashboard) {
      router.replace("/account");
    }
  }, [canAccessHelperDashboard, canManageWorkspace, router]);

  if (canManageWorkspace) {
    return (
      <div className="px-6 py-10 text-sm text-zinc-500 md:px-8">
        Redirecting to admin…
      </div>
    );
  }

  if (!canAccessHelperDashboard) {
    return (
      <div className="px-6 py-10 text-sm text-zinc-500 md:px-8">
        Redirecting to account…
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
        <div className="overflow-hidden rounded-[0.85rem] border border-white/[0.07] bg-[#0c0c0e] px-3 py-3">
          <h2 className="mb-2 text-sm font-semibold text-zinc-100">Account</h2>
          <AccountSecurityPanel
            embedded
            initialRecoveryEmail={dashboardUser.recoveryEmail}
            username={dashboardUser.username}
          />
        </div>
      </section>
    </div>
  );
}
