"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  CreditCard,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
} from "lucide-react";

import Dock, { type DockItemData } from "@/components/dock";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { useDashboardSidebar } from "@/components/dashboard/dashboard-sidebar-context";

export function DashboardDock() {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useDashboardUser();
  const { collapsed, toggleCollapsed } = useDashboardSidebar();

  const items = useMemo<DockItemData[]>(() => {
    const next: DockItemData[] = [
      {
        icon: collapsed ? (
          <PanelLeftOpen />
        ) : (
          <PanelLeftClose />
        ),
        label: collapsed ? "Expand sidebar" : "Minimize",
        onClick: toggleCollapsed,
        tour: "dock-minimize",
      },
    ];

    if (profile.canManageWorkspace) {
      next.push({
        icon: (
          <span className="dash-dock-icon-wrap">
            <Shield />
            <span className="dash-dock-badge">ADMIN</span>
          </span>
        ),
        label: "Admin",
        onClick: () => router.push("/dashboard/settings#admin"),
        tour: "footer-admin",
        className:
          pathname.startsWith("/dashboard/settings") ? "dock-item--active" : "",
      });
    } else if (profile.canAccessHelperDashboard) {
      next.push({
        icon: (
          <span className="dash-dock-icon-wrap">
            <Shield />
            <span className="dash-dock-badge">HELPER</span>
          </span>
        ),
        label: "Helper",
        onClick: () => router.push("/dashboard/settings#helper"),
        tour: "footer-admin",
        className:
          pathname.startsWith("/dashboard/settings") ? "dock-item--active" : "",
      });
    }

    next.push(
      {
        icon: <LifeBuoy />,
        label: "Support",
        onClick: () => router.push("/support"),
        tour: "dock-support",
        className: pathname === "/support" ? "dock-item--active" : "",
      },
      {
        icon: <CreditCard />,
        label: "Pricing",
        onClick: () => router.push("/pricing"),
        tour: "dock-pricing",
        className: pathname.startsWith("/pricing") ? "dock-item--active" : "",
      },
      {
        icon: <Activity />,
        label: "Status",
        onClick: () => router.push("/status"),
        tour: "dock-status",
        className: pathname === "/status" ? "dock-item--active" : "",
      },
    );

    return next;
  }, [
    collapsed,
    pathname,
    profile.canAccessHelperDashboard,
    profile.canManageWorkspace,
    router,
    toggleCollapsed,
  ]);

  return (
    <div className="dash-dock" data-tour="dashboard-dock">
      <Dock
        baseItemSize={42}
        distance={140}
        dockHeight={180}
        items={items}
        magnification={58}
        panelHeight={56}
      />
    </div>
  );
}
