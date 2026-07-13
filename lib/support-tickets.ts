import { parseStaffRole } from "@/lib/staff-roles";

export const TICKET_CATEGORIES = [
  "account",
  "billing",
  "search",
  "cases",
  "general",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_STATUSES = [
  "open",
  "awaiting_user",
  "awaiting_staff",
  "resolved",
  "closed",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const MAX_TICKET_SUBJECT = 120;
export const MAX_TICKET_BODY = 4000;
export const MAX_OPEN_TICKETS_PER_USER = 5;

export function isTicketCategory(value: string): value is TicketCategory {
  return TICKET_CATEGORIES.includes(value as TicketCategory);
}

export function isTicketStatus(value: string): value is TicketStatus {
  return TICKET_STATUSES.includes(value as TicketStatus);
}

export function hasSupportStaffAccess(user: {
  isAdmin?: boolean | null;
  staffRole?: string | null;
}) {
  if (user.isAdmin) return true;
  return parseStaffRole(user.staffRole) !== null;
}

export function sanitizeTicketText(value: string, max: number) {
  return value.replace(/\0/g, "").trim().slice(0, max);
}

export function categoryLabel(category: string) {
  switch (category) {
    case "account":
      return "Account";
    case "billing":
      return "Billing";
    case "search":
      return "Search modules";
    case "cases":
      return "Cases & intel";
    default:
      return "General";
  }
}

export function statusLabel(status: string) {
  switch (status) {
    case "open":
      return "Open";
    case "awaiting_user":
      return "Awaiting you";
    case "awaiting_staff":
      return "Awaiting staff";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}
