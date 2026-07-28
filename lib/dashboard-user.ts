"use client";

import type { UserProfile } from "@/lib/account-plan";
import type { AccountStatus } from "@/lib/workspace-admin";

export type DashboardUser = UserProfile & {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  dashboardAccent?: string | null;
  onboardingCompleted?: boolean;
  isAdmin: boolean;
  staffRole?: string | null;
  accountStatus?: AccountStatus;
  canManageWorkspace: boolean;
  canAccessHelperDashboard: boolean;
};
