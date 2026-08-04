"use client";

import clsx from "clsx";
import { Menu, X } from "lucide-react";
import type { CSSProperties } from "react";

import { DashboardTour } from "@/components/dashboard/dashboard-tour";
import { DashboardOnboarding } from "@/components/dashboard/dashboard-onboarding";
import { WorkspaceAccessGuard } from "@/components/dashboard/workspace-access-guard";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { FrozenAccountOverlay } from "@/components/dashboard/frozen-account-overlay";
import { SafetyNoticeOverlay } from "@/components/dashboard/safety-notice-overlay";
import { HomeBackground } from "@/components/home-background";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import {
  DashboardSidebarProvider,
  useDashboardSidebar,
} from "@/components/dashboard/dashboard-sidebar-context";
import { TEST_MAC_DASHBOARD_THEME } from "@/config/branding";
import { accentStyleVars } from "@/lib/dashboard-profile";

type DashboardShellProps = {
  children: React.ReactNode;
  username: string;
};

function DashboardShellInner({ children, username }: DashboardShellProps) {
  const {
    collapsed,
    isResizing,
    mobileOpen,
    toggleMobile,
    closeMobile,
  } = useDashboardSidebar();
  const profile = useDashboardUser();
  const isFrozen = profile.accountStatus === "frozen";
  const accentVars = accentStyleVars(profile.dashboardAccent);

  return (
    <div
      className={clsx(
        "dash-shell text-white",
        collapsed && "dash-shell--sidebar-collapsed",
        isResizing && "dash-shell--sidebar-resizing",
        mobileOpen && "dash-shell--mobile-nav-open",
        isFrozen && "dash-shell--frozen",
      )}
      style={accentVars as CSSProperties | undefined}
    >
      {!TEST_MAC_DASHBOARD_THEME ? <HomeBackground denser /> : null}
      <button
        aria-controls="dash-sidebar-nav"
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        className="dash-mobile-nav-toggle"
        type="button"
        onClick={toggleMobile}
      >
        {mobileOpen ? (
          <X aria-hidden className="size-5" />
        ) : (
          <Menu aria-hidden className="size-5" />
        )}
      </button>
      <button
        aria-hidden={!mobileOpen}
        aria-label="Close navigation"
        className="dash-mobile-nav-backdrop"
        tabIndex={mobileOpen ? 0 : -1}
        type="button"
        onClick={closeMobile}
      />
      <DashboardSidebar username={username} />
      <main
        className={clsx("dash-main", isFrozen && "dash-main--frozen")}
        data-tour="main-content"
      >
        {TEST_MAC_DASHBOARD_THEME ? (
          <div className="dash-mac-window">
            <div aria-hidden className="dash-mac-window-chrome">
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
      <DashboardOnboarding />
      <DashboardTour />
      <WorkspaceAccessGuard />
      <SafetyNoticeOverlay />
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
