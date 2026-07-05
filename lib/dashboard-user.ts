"use client";

import type { UserProfile } from "@/lib/account-plan";
import type { AccountStatus } from "@/lib/workspace-admin";

export type DashboardUser = UserProfile & {
  username: string;
  isAdmin: boolean;
  staffRole?: string | null;
  accountStatus?: AccountStatus;
  canManageWorkspace: boolean;
};
