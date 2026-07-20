import "server-only";

import { prisma } from "@/prisma/client";
import { hasWorkspaceAdminAccess } from "@/lib/workspace-admin";
import {
  assessSearchQueryForSafety,
  buildQueryPreview,
  parseHelperMessageHistory,
  type HelperMessageHistoryEntry,
  type SafetyFlagSource,
} from "@/lib/safety-search-flags";

const DEDUPE_WINDOW_MS = 15 * 60 * 1000;

export const SAFETY_FLAG_SELECT = {
  id: true,
  publicId: true,
  userId: true,
  searchHistoryId: true,
  source: true,
  reasonCode: true,
  category: true,
  status: true,
  queryPreview: true,
  moduleSlug: true,
  searchType: true,
  matchedRules: true,
  reason: true,
  flaggedById: true,
  flaggedByUsername: true,
  assignedHelperId: true,
  assignedHelperUsername: true,
  helperMessage: true,
  helperMessageHistory: true,
  notifiedAt: true,
  acknowledgedAt: true,
  reviewedById: true,
  reviewedByUsername: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  user: {
    select: {
      id: true,
      username: true,
      accountStatus: true,
      investigationStatus: true,
      staffRole: true,
    },
  },
} as const;

/** Fields safe to show the flagged member (no full staff notes beyond helper message). */
export const USER_NOTIFICATION_SELECT = {
  id: true,
  publicId: true,
  helperMessage: true,
  notifiedAt: true,
  flaggedByUsername: true,
  assignedHelperUsername: true,
  reasonCode: true,
  createdAt: true,
} as const;

async function markAccountForInvestigation(params: {
  userId: number;
  note: string;
  flaggedById: number | null;
  flaggedByUsername: string;
}) {
  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      isAdmin: true,
      staffRole: true,
      accountStatus: true,
      investigationFlaggedAt: true,
      investigationFlaggedById: true,
      investigationFlaggedByUsername: true,
    },
  });

  if (!target || hasWorkspaceAdminAccess(target)) {
    return;
  }

  const already = target.accountStatus === "investigate";

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      accountStatus: "investigate",
      investigationStatus: already ? undefined : "flagged",
      investigationFlaggedAt: already
        ? (target.investigationFlaggedAt ?? new Date())
        : new Date(),
      investigationFlaggedById: already
        ? (target.investigationFlaggedById ?? params.flaggedById)
        : params.flaggedById,
      investigationFlaggedByUsername: already
        ? (target.investigationFlaggedByUsername ?? params.flaggedByUsername)
        : params.flaggedByUsername,
      investigationNote: params.note.slice(0, 500),
    },
  });
}

async function findRecentDuplicate(params: {
  userId: number;
  queryPreview: string;
  moduleSlug?: string | null;
}) {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);

  return prisma.safetyFlag.findFirst({
    where: {
      userId: params.userId,
      queryPreview: params.queryPreview,
      moduleSlug: params.moduleSlug ?? undefined,
      createdAt: { gte: since },
      status: { in: ["open", "reviewing"] },
    },
    select: SAFETY_FLAG_SELECT,
  });
}

/**
 * Evaluate a search and silently create a SafetyFlag + account investigate mark when risky.
 * Never blocks the search response.
 */
export async function maybeAutoFlagRiskySearch(params: {
  userId: number;
  query: string;
  moduleSlug?: string | null;
  searchType?: string | null;
  searchHistoryId?: number | null;
}) {
  const assessment = assessSearchQueryForSafety(params.query);

  if (!assessment.flagged) {
    return { flagged: false as const, flag: null };
  }

  const queryPreview = buildQueryPreview(params.query);
  const existing = await findRecentDuplicate({
    userId: params.userId,
    queryPreview,
    moduleSlug: params.moduleSlug,
  });

  if (existing) {
    if (params.searchHistoryId && !existing.searchHistoryId) {
      const updated = await prisma.safetyFlag.update({
        where: { id: existing.id },
        data: { searchHistoryId: params.searchHistoryId },
        select: SAFETY_FLAG_SELECT,
      });

      return {
        flagged: true as const,
        flag: updated,
        duplicate: true as const,
      };
    }

    return { flagged: true as const, flag: existing, duplicate: true as const };
  }

  const flag = await prisma.safetyFlag.create({
    data: {
      userId: params.userId,
      searchHistoryId: params.searchHistoryId ?? null,
      source: "auto",
      reasonCode: assessment.reasonCode,
      category: assessment.category,
      status: "open",
      queryPreview,
      moduleSlug: params.moduleSlug ?? null,
      searchType: params.searchType ?? null,
      matchedRules: JSON.stringify(assessment.rules.map((rule) => rule.id)),
      reason: assessment.reason,
      flaggedById: null,
      flaggedByUsername: "system",
    },
    select: SAFETY_FLAG_SELECT,
  });

  await markAccountForInvestigation({
    userId: params.userId,
    note: `Auto-flagged: ${assessment.reason}`,
    flaggedById: null,
    flaggedByUsername: "system",
  });

  return { flagged: true as const, flag, duplicate: false as const };
}

/** Manual helper/admin investigation flag as a reviewable case. */
export async function createManualSafetyFlag(params: {
  userId: number;
  source: Extract<SafetyFlagSource, "helper" | "admin">;
  actorId: number;
  actorUsername: string;
  note?: string | null;
}) {
  const note = (params.note ?? "").trim().slice(0, 500);
  const reasonCode =
    params.source === "helper" ? "helper_investigate" : "admin_investigate";

  const flag = await prisma.safetyFlag.create({
    data: {
      userId: params.userId,
      source: params.source,
      reasonCode,
      category: "manual_review",
      status: "open",
      queryPreview: note || "(manual account flag — no search query)",
      moduleSlug: null,
      searchType: null,
      matchedRules: JSON.stringify(["manual"]),
      reason: note || `Manual ${params.source} flag by ${params.actorUsername}`,
      flaggedById: params.actorId,
      flaggedByUsername: params.actorUsername,
      assignedHelperId: params.source === "helper" ? params.actorId : null,
      assignedHelperUsername:
        params.source === "helper" ? params.actorUsername : null,
    },
    select: SAFETY_FLAG_SELECT,
  });

  await markAccountForInvestigation({
    userId: params.userId,
    note: note || `Flagged by ${params.actorUsername}`,
    flaggedById: params.actorId,
    flaggedByUsername: params.actorUsername,
  });

  return flag;
}

/**
 * Deliver a staff message to the flagged member (SafetyFlag.userId).
 * Staff only view the text in the review UI — they are never the recipient.
 * Resets acknowledgment so the member sees the dashboard overlay again.
 */
export async function sendFlagHelperMessage(params: {
  flagId: number;
  actorId: number;
  actorUsername: string;
  message: string;
  assignHelper?: boolean;
}) {
  const message = params.message.trim().slice(0, 1000);

  if (!message) {
    throw new Error("Message is required.");
  }

  const existing = await prisma.safetyFlag.findUnique({
    where: { id: params.flagId },
    select: {
      id: true,
      userId: true,
      helperMessageHistory: true,
      user: { select: { id: true, username: true } },
    },
  });

  if (!existing) {
    throw new Error("Flag not found.");
  }

  // Recipient is always the flagged member — never the acting admin/helper.
  const recipientUserId = existing.userId;
  const entry: HelperMessageHistoryEntry = {
    at: new Date().toISOString(),
    byId: params.actorId,
    byUsername: params.actorUsername,
    message,
  };
  const history = [
    ...parseHelperMessageHistory(existing.helperMessageHistory),
    entry,
  ].slice(-50);

  const flag = await prisma.safetyFlag.update({
    where: { id: params.flagId },
    data: {
      // userId intentionally untouched — delivery stays on the flagged member
      helperMessage: message,
      helperMessageHistory: JSON.stringify(history),
      notifiedAt: new Date(),
      acknowledgedAt: null,
      reviewedById: params.actorId,
      reviewedByUsername: params.actorUsername,
      assignedHelperId: params.assignHelper ? params.actorId : undefined,
      assignedHelperUsername: params.assignHelper
        ? params.actorUsername
        : undefined,
      status: "reviewing",
    },
    select: SAFETY_FLAG_SELECT,
  });

  return {
    flag,
    deliveredTo: {
      userId: recipientUserId,
      username: existing.user.username,
    },
  };
}
