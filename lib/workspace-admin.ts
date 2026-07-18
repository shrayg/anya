import { parseStaffRole } from "@/lib/staff-roles";

export type AccountStatus = "active" | "frozen" | "banned" | "investigate";

export type InvestigationStatus = "flagged" | "under_investigation";

export const ACCOUNT_STATUSES: AccountStatus[] = [
  "active",
  "frozen",
  "banned",
  "investigate",
];

export const INVESTIGATION_STATUSES: InvestigationStatus[] = [
  "flagged",
  "under_investigation",
];

export const ACCOUNT_STATUS_META: Record<
  AccountStatus,
  { label: string; badgeClass: string; rowClass: string; actionClass: string }
> = {
  active: {
    label: "Active",
    badgeClass:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    rowClass: "",
    actionClass:
      "border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20",
  },
  frozen: {
    label: "Frozen",
    badgeClass: "border-blue-400/30 bg-blue-500/15 text-blue-200",
    rowClass: "bg-blue-500/[0.04]",
    actionClass:
      "border-blue-400/30 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25",
  },
  banned: {
    label: "Banned",
    badgeClass: "border-red-400/30 bg-red-500/15 text-red-200",
    rowClass: "bg-red-500/[0.04]",
    actionClass:
      "border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25",
  },
  investigate: {
    label: "Flagged",
    badgeClass: "border-yellow-400/30 bg-yellow-500/15 text-yellow-200",
    rowClass: "bg-yellow-500/[0.04]",
    actionClass:
      "border-yellow-400/30 bg-yellow-500/15 text-yellow-100 hover:bg-yellow-500/25",
  },
};

export const INVESTIGATION_STATUS_META: Record<
  InvestigationStatus,
  { label: string }
> = {
  flagged: { label: "Flagged" },
  under_investigation: { label: "Under investigation" },
};

export function isInvestigationStatus(
  value: string,
): value is InvestigationStatus {
  return INVESTIGATION_STATUSES.includes(value as InvestigationStatus);
}

/** Clears investigation metadata when an account leaves investigate status. */
export const CLEARED_INVESTIGATION_FIELDS = {
  investigationStatus: null,
  investigationFlaggedAt: null,
  investigationFlaggedById: null,
  investigationFlaggedByUsername: null,
  investigationNote: null,
} as const;

export function isAccountStatus(value: string): value is AccountStatus {
  return ACCOUNT_STATUSES.includes(value as AccountStatus);
}

export function isAccountBlocked(status: string | null | undefined) {
  return status === "banned" || status === "frozen";
}

export function hasWorkspaceAdminAccess(user: {
  isAdmin?: boolean | null;
  staffRole?: string | null;
}) {
  if (user.isAdmin) return true;

  return parseStaffRole(user.staffRole) === "admin";
}

/** Helpers get a limited user list + investigate tools (no payments/passwords). */
export function hasHelperDashboardAccess(user: {
  isAdmin?: boolean | null;
  staffRole?: string | null;
}) {
  if (hasWorkspaceAdminAccess(user)) return false;

  return parseStaffRole(user.staffRole) === "helper";
}

export function getAccountStatusMessage(status: string | null | undefined) {
  if (status === "banned") {
    return "This account has been banned.";
  }

  if (status === "frozen") {
    return "This account is frozen. Contact support to restore access.";
  }

  return null;
}
