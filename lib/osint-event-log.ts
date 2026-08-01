import { prisma } from "@/prisma/client";
import { isInternalOpsMessage } from "@/lib/user-facing-errors";

export type OsintEventStatus =
  | "ok"
  | "error"
  | "partial"
  | "rate_limited"
  | "info";

export type LogOsintEventInput = {
  userId: number | null;
  /** Stable action key, e.g. search.us-identity or module:index-sweep */
  action: string;
  status: OsintEventStatus;
  message?: string | null;
  /** Truncated query for staff review — never secrets. */
  queryPreview?: string | null;
  moduleSlug?: string | null;
  /** Optional structured details (errors[], source ids, etc.). */
  meta?: Record<string, unknown> | null;
};

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();

  if (!trimmed) return null;

  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function inferStatus(
  status: OsintEventStatus,
  message?: string | null,
): OsintEventStatus {
  if (status !== "error" && status !== "partial") return status;
  if (message && isInternalOpsMessage(message)) return "rate_limited";

  return status;
}

/**
 * Fire-and-forget admin audit log. Never throws to callers.
 */
export function logOsintEvent(input: LogOsintEventInput): void {
  void writeOsintEvent(input).catch((err) => {
    console.error("osint event log failed:", err);
  });
}

export async function writeOsintEvent(input: LogOsintEventInput): Promise<void> {
  if (input.userId == null) return;

  const message = truncate(input.message, 2000);
  const status = inferStatus(input.status, message);

  await prisma.osintEventLog.create({
    data: {
      userId: input.userId,
      action: truncate(input.action, 120) || "unknown",
      status,
      message,
      queryPreview: truncate(input.queryPreview, 240),
      moduleSlug: truncate(input.moduleSlug, 80),
      metaJson: input.meta ? JSON.stringify(input.meta).slice(0, 8000) : null,
    },
  });
}

export function logUsRecordsOutcome(input: {
  userId: number;
  action: string;
  moduleSlug?: string;
  query: string;
  errors: Array<{ id: string; label: string; message: string }>;
  count: number;
}): void {
  if (input.errors.length === 0) {
    logOsintEvent({
      userId: input.userId,
      action: input.action,
      status: "ok",
      moduleSlug: input.moduleSlug,
      queryPreview: input.query,
      message: `${input.count} result(s)`,
    });

    return;
  }

  for (const err of input.errors) {
    logOsintEvent({
      userId: input.userId,
      action: input.action,
      status: input.count > 0 ? "partial" : "error",
      moduleSlug: input.moduleSlug,
      queryPreview: input.query,
      message: `${err.label}: ${err.message}`,
      meta: { sourceId: err.id, label: err.label },
    });
  }
}
