"use client";

import type { DashboardUser } from "@/lib/dashboard-user";

import { Suspense } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { DashboardModuleProvider } from "@/components/dashboard/dashboard-module-context";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ModuleHealthProvider } from "@/components/dashboard/module-status-provider";
import { HomeBackground } from "@/components/home-background";
import {
  hasHelperDashboardAccess,
  hasWorkspaceAdminAccess,
  type AccountStatus,
} from "@/lib/workspace-admin";

type MeResponseUser = {
  username: string;
  isAdmin?: boolean;
  staffRole?: string | null;
  canManageWorkspace?: boolean;
  canAccessHelperDashboard?: boolean;
  accountStatus?: AccountStatus;
  plan?: DashboardUser["plan"];
  balance?: number;
  billingInterval?: string;
  apiAccess?: boolean;
  apiKey?: string | null;
  recoveryEmail?: string | null;
  freeTier?: boolean;
  professionalTier?: boolean;
  investigatorTier?: boolean;
  enterpriseTier?: boolean;
};

function mapMeUser(
  user: MeResponseUser,
  canManageWorkspace?: boolean,
  canAccessHelperDashboard?: boolean,
): DashboardUser {
  const workspaceAdmin =
    typeof canManageWorkspace === "boolean"
      ? canManageWorkspace
      : typeof user.canManageWorkspace === "boolean"
        ? user.canManageWorkspace
        : hasWorkspaceAdminAccess(user);

  const helperDashboard =
    typeof canAccessHelperDashboard === "boolean"
      ? canAccessHelperDashboard
      : typeof user.canAccessHelperDashboard === "boolean"
        ? user.canAccessHelperDashboard
        : hasHelperDashboardAccess(user);

  return {
    username: user.username,
    isAdmin: Boolean(user.isAdmin),
    staffRole: user.staffRole ?? null,
    canManageWorkspace: workspaceAdmin,
    canAccessHelperDashboard: helperDashboard,
    accountStatus: user.accountStatus ?? "active",
    plan: user.plan ?? "free",
    balance: user.balance ?? 0,
    billingInterval: user.billingInterval ?? "monthly",
    apiAccess: Boolean(user.apiAccess),
    apiKey: user.apiKey ?? null,
    recoveryEmail: user.recoveryEmail ?? null,
    freeTier: Boolean(user.freeTier),
    professionalTier: Boolean(user.professionalTier),
    investigatorTier: Boolean(user.investigatorTier),
    enterpriseTier: Boolean(user.enterpriseTier),
  };
}

type DashboardAuthContextValue = {
  user: DashboardUser;
};

const DashboardAuthContext = createContext<DashboardAuthContextValue | null>(
  null,
);

export function useDashboardAuth() {
  const context = useContext(DashboardAuthContext);

  if (!context) {
    throw new Error(
      "useDashboardAuth must be used within DashboardAuthProvider",
    );
  }

  return context;
}

export function useDashboardUser() {
  return useDashboardAuth().user;
}

export function DashboardAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [checked, setChecked] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();

      if (response.status === 403 && data?.blocked) {
        router.replace("/");

        return;
      }

      if (!response.ok || !data?.authenticated || !data.user?.username) {
        router.replace("/");

        return;
      }

      setUser(
        mapMeUser(
          data.user,
          data.canManageWorkspace,
          data.canAccessHelperDashboard,
        ),
      );
    } catch {
      router.replace("/");
    } finally {
      setChecked(true);
    }
  }, [router]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!user) return;

    const refreshStatus = () => {
      void loadUser();
    };

    const interval = window.setInterval(refreshStatus, 20_000);

    window.addEventListener("focus", refreshStatus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshStatus);
    };
  }, [loadUser, user]);

  const value = useMemo(() => (user ? { user } : null), [user]);

  if (!checked) {
    return (
      <div className="dash-shell text-white">
        <HomeBackground />
        <div className="dash-sidebar shrink-0 animate-pulse opacity-40" />
        <main className="dash-main flex items-center justify-center text-gray-400">
          Loading workspace...
        </main>
      </div>
    );
  }

  if (!value) {
    return null;
  }

  return (
    <DashboardAuthContext.Provider value={value}>
      <Suspense
        fallback={
          <div className="dash-shell text-white">
            <HomeBackground />
            <div className="dash-sidebar w-[17rem] shrink-0 animate-pulse opacity-40" />
            <main className="dash-main ml-[17rem] flex items-center justify-center text-gray-400">
              Loading workspace...
            </main>
          </div>
        }
      >
        <DashboardModuleProvider>
          <ModuleHealthProvider>
            <DashboardShell username={value.user.username}>
              {children}
            </DashboardShell>
          </ModuleHealthProvider>
        </DashboardModuleProvider>
      </Suspense>
    </DashboardAuthContext.Provider>
  );
}
