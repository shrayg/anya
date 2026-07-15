"use client";

import clsx from "clsx";

import { DashboardTour } from "@/components/dashboard/dashboard-tour";
import { WorkspaceAccessGuard } from "@/components/dashboard/workspace-access-guard";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { FrozenAccountOverlay } from "@/components/dashboard/frozen-account-overlay";
import { HomeBackground } from "@/components/home-background";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import {
  DashboardSidebarProvider,
  useDashboardSidebar,
} from "@/components/dashboard/dashboard-sidebar-context";
import { TEST_MAC_DASHBOARD_THEME } from "@/config/branding";

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
      {!TEST_MAC_DASHBOARD_THEME ? <HomeBackground /> : null}
      <DashboardSidebar username={username} />
      <main className={clsx("dash-main", isFrozen && "dash-main--frozen")} data-tour="main-content">
        {TEST_MAC_DASHBOARD_THEME ? (
          <div className="dash-mac-window">
            <div className="dash-mac-window-chrome" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <div className="dash-mac-window-body">{children}</div>
          </div>
        ) : (
          children
        )}
      </main>
      <DashboardTour />
      <WorkspaceAccessGuard />
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
