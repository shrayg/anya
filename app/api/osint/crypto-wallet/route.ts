import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import {
  detectCsintCryptoSymbol,
  fetchCsintCrypto,
} from "@/lib/csint";
import { PUBLIC_INTEL_SOURCE } from "@/lib/public-branding";
import {
  CRYPTO_WALLET_INVALID_MESSAGE,
  detectCryptoChain,
  lookupCryptoWallet,
} from "@/lib/crypto-wallet";
import { fetchGodsEyeSearchSafe } from "@/lib/godseye";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "crypto-wallet");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const chain = detectCryptoChain(query);
  if (!chain) {
    return NextResponse.json(
      { error: CRYPTO_WALLET_INVALID_MESSAGE },
      { status: 400 },
    );
  }

  try {
    const symbol = detectCsintCryptoSymbol(query);
    const [wallet, godseye, csint] = await Promise.all([
      lookupCryptoWallet(query),
      fetchGodsEyeSearchSafe("crypto", query),
      symbol ? fetchCsintCrypto(query, symbol) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ...wallet,
      godseye,
      enrichment: csint,
      sources: [
        "On-chain",
        ...(godseye ? [PUBLIC_INTEL_SOURCE] : []),
        ...(csint ? [PUBLIC_INTEL_SOURCE] : []),
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Wallet lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
