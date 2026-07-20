import { NextResponse } from "next/server";

import {
  hasTinderLiveCredentials,
  isTinderLiveEnabled,
} from "@/lib/tinder-live/enabled";

export function tinderLiveDisabledResponse(): NextResponse | null {
  if (!isTinderLiveEnabled()) {
    return NextResponse.json(
      {
        error: hasTinderLiveCredentials()
          ? "Tinder Live is disabled."
          : "Tinder Live is not configured. Set TINDER_X_AUTH_TOKEN and TINDER_DEVICE_ID on the server.",
      },
      { status: 503 },
    );
  }

  return null;
}
