import { NextRequest, NextResponse } from "next/server";

import { cryptoIntelDisabledResponse } from "@/lib/crypto-intel/api-guard";
import { runAddressIntel } from "@/lib/crypto-intel/address-intel";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  isSoftProviderFailure,
  isTimeoutLike,
  OSINT_ROUTE_DEADLINE_MS,
  withDeadline,
} from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const disabled = cryptoIntelDisabledResponse();

  if (disabled) return disabled;

  const access = await requireOsintAccess(req, "crypto-address");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = await withDeadline(
      runAddressIntel(query),
      OSINT_ROUTE_DEADLINE_MS,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Address intel lookup failed";

    if (isTimeoutLike(err) || isSoftProviderFailure(err)) {
      return NextResponse.json(
        {
          error:
            "Explorer providers are slow or unavailable. Try again shortly.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
