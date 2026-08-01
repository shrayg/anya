"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AdminSubnav } from "@/components/dashboard/admin-subnav";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { siteConfig } from "@/config/site";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const dashboardUser = useDashboardUser();
  const canManageWorkspace = dashboardUser.canManageWorkspace;

  useEffect(() => {
    if (!canManageWorkspace) {
      if (dashboardUser.canAccessHelperDashboard) {
        router.replace("/dashboard/settings");

        return;
      }

      router.replace("/account");
    }
  }, [
    canManageWorkspace,
    dashboardUser.canAccessHelperDashboard,
    router,
  ]);

  if (!canManageWorkspace) {
    return (
      <div className="px-6 py-10 text-sm text-zinc-500 md:px-8">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="anya-desk px-4 py-4 md:px-6 md:py-5">
      <section className="mb-5 space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
              admin workspace
            </p>
            <h1 className="text-xl font-semibold text-white">Admin</h1>
            <p className="mt-0.5 max-w-xl text-xs text-zinc-500">
              Site analytics, members, blacklist, and APIs for {siteConfig.name}.
              Admin-only.
            </p>
          </div>
          <AdminSubnav />
        </header>
        {children}
      </section>
    </div>
  );
}
