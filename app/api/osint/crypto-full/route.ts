import { NextRequest, NextResponse } from "next/server";

import { cryptoIntelDisabledResponse } from "@/lib/crypto-intel/api-guard";
import { runCryptoFullSuite } from "@/lib/crypto-intel/full-suite";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  isSoftProviderFailure,
  isTimeoutLike,
  OSINT_LONG_ROUTE_DEADLINE_MS,
  withDeadline,
} from "@/lib/osint-search-guard";
import { toUserFacingSearchMessage } from "@/lib/user-facing-errors";

export async function GET(req: NextRequest) {
  const disabled = cryptoIntelDisabledResponse();

  if (disabled) return disabled;

  const access = await requireOsintAccess(req, "crypto-full");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = await withDeadline(
      runCryptoFullSuite(query),
      OSINT_LONG_ROUTE_DEADLINE_MS,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Crypto intel suite failed";

    if (isTimeoutLike(err) || isSoftProviderFailure(err)) {
      return NextResponse.json(
        {
          error: toUserFacingSearchMessage(message, {
            fallback: "Search could not complete. Try again shortly.",
          }),
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error: toUserFacingSearchMessage(message, {
          fallback: "Enter a valid wallet address or transaction hash.",
        }),
      },
      { status: 400 },
    );
  }
}
