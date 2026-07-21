import { NextResponse } from "next/server";

import {
  hasHingeLiveCredentials,
  isHingeLiveEnabled,
} from "@/lib/hinge-live/enabled";

export function hingeLiveDisabledResponse(): NextResponse | null {
  if (!isHingeLiveEnabled()) {
    const hasCreds = hasHingeLiveCredentials();
    const needsProxy =
      process.env.HINGE_LIVE_REQUIRE_PROXY?.trim().toLowerCase() !== "0";

    let error =
      "Hinge Live is not configured. Set HINGE_AUTHORIZATION, HINGE_DEVICE_ID, and HINGE_INSTALL_ID on the server.";

    if (hasCreds && needsProxy) {
      error =
        "Hinge Live requires a residential proxy. Set OSINT_RESIDENTIAL_PROXY_URL or INSTAGRAM_PROXY_URL.";
    } else if (hasCreds) {
      error = "Hinge Live is disabled.";
    }

    return NextResponse.json({ error }, { status: 503 });
  }

  return null;
}
