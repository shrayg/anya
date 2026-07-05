import { NextRequest, NextResponse } from "next/server";

import { PUBLIC_INTEL_SOURCE } from "@/lib/public-branding";
import { lookupCryptoWallet } from "@/lib/crypto-wallet";
import { fetchGodsEyeSearchSafe } from "@/lib/godseye";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const [wallet, godseye] = await Promise.all([
      lookupCryptoWallet(query),
      fetchGodsEyeSearchSafe("crypto", query),
    ]);

    return NextResponse.json({
      ...wallet,
      godseye,
      sources: ["On-chain", ...(godseye ? [PUBLIC_INTEL_SOURCE] : [])],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Wallet lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
