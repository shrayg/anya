"use client";

import clsx from "clsx";

import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { FrozenAccountOverlay } from "@/components/dashboard/frozen-account-overlay";
import { HomeBackground } from "@/components/home-background";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import {
  DashboardSidebarProvider,
  useDashboardSidebar,
} from "@/components/dashboard/dashboard-sidebar-context";

type DashboardShellProps = {
  children: React.ReactNode;
  username: string;
};

function DashboardShellInner({
  children,
  username,
}: DashboardShellProps) {
  const { collapsed } = useDashboardSidebar();
  const profile = useDashboardUser();
  const isFrozen = profile.accountStatus === "frozen";

  return (
    <div
      className={clsx(
        "dash-shell text-white",
        collapsed && "dash-shell--sidebar-collapsed",
        isFrozen && "dash-shell--frozen",
      )}
    >
      <HomeBackground />
      <DashboardSidebar username={username} />
      <main className={clsx("dash-main", isFrozen && "dash-main--frozen")}>{children}</main>
      {isFrozen ? <FrozenAccountOverlay username={username} /> : null}
    </div>
  );
}

export function DashboardShell({ children, username }: DashboardShellProps) {
  return (
    <DashboardSidebarProvider>
      <DashboardShellInner username={username}>{children}</DashboardShellInner>
    </DashboardSidebarProvider>
  );
}
