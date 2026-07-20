import { NextResponse } from "next/server";

import { isCryptoIntelEnabled } from "@/lib/crypto-intel/enabled";

/** Return 404 when the Crypto Intel suite kill-switch is off. */
export function cryptoIntelDisabledResponse(): NextResponse | null {
  if (isCryptoIntelEnabled()) return null;

  return NextResponse.json(
    { error: "Crypto Intel is disabled on this deployment." },
    { status: 404 },
  );
}
