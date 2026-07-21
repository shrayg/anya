import { NextResponse } from "next/server";

import { logUsRecordsOutcome } from "@/lib/osint-event-log";
import { toPublicRecordsPayload } from "@/lib/us-records/public-payload";
import type { PublicPortalHit, SourceError } from "@/lib/us-records/types";
import { toUserFacingSearchMessage } from "@/lib/user-facing-errors";

type UsRecordsLike = {
  count: number;
  errors: SourceError[];
  message?: string;
  portals?: PublicPortalHit[];
};

export function usRecordsSuccessResponse(input: {
  userId: number;
  action: string;
  moduleSlug: string;
  query: string;
  result: UsRecordsLike;
}): NextResponse {
  logUsRecordsOutcome({
    userId: input.userId,
    action: input.action,
    moduleSlug: input.moduleSlug,
    query: input.query,
    errors: input.result.errors,
    count: input.result.count,
  });

  return NextResponse.json(toPublicRecordsPayload(input.result));
}

export function usRecordsFailureResponse(input: {
  userId: number;
  action: string;
  moduleSlug: string;
  query?: string;
  err: unknown;
}): NextResponse {
  const raw =
    input.err instanceof Error ? input.err.message : "Search failed";

  logUsRecordsOutcome({
    userId: input.userId,
    action: input.action,
    moduleSlug: input.moduleSlug,
    query: input.query || "",
    errors: [{ id: "state-portal", label: input.action, message: raw }],
    count: 0,
  });

  return NextResponse.json(
    {
      error: toUserFacingSearchMessage(raw, {
        fallback: "Search could not complete. Try again shortly.",
      }),
    },
    { status: 400 },
  );
}
