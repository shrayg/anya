import type {
  PublicPortalHit,
  PublicRecordsSearchResult,
  SourceError,
} from "@/lib/us-records/types";
import { toUserFacingSearchMessage } from "@/lib/user-facing-errors";

type Publicizable = {
  count: number;
  errors: SourceError[];
  message?: string;
  portals?: PublicPortalHit[];
};

/**
 * Strip source failures / rate-limit copy before JSON reaches the user panel.
 * Callers should log `result.errors` via logUsRecordsOutcome first.
 */
export function toPublicRecordsPayload<T extends Publicizable>(
  result: T,
): T & { errors: []; portals: PublicPortalHit[] } {
  const emptyFallback =
    result.message && result.errors.length === 0
      ? toUserFacingSearchMessage(result.message, {
          fallback: "No matches found for that query.",
        })
      : "No matches found for that query.";

  return {
    ...result,
    portals: [],
    errors: [],
    message:
      result.count === 0
        ? toUserFacingSearchMessage(result.message, {
            fallback: emptyFallback,
          }) || emptyFallback
        : undefined,
  };
}

/** @deprecated Prefer toPublicRecordsPayload — kept for callers expecting full type. */
export type PublicRecordsClientPayload = PublicRecordsSearchResult;

