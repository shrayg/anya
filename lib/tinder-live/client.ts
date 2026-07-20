import { TinderAPI } from "tinder-api-ts";

import { hasTinderLiveCredentials } from "@/lib/tinder-live/enabled";

let cachedClient: TinderAPI | null = null;
let cachedKey = "";

export function getTinderLiveClient(): TinderAPI {
  const token = process.env.TINDER_X_AUTH_TOKEN?.trim() ?? "";
  const deviceId = process.env.TINDER_DEVICE_ID?.trim() ?? "";

  if (!token || !deviceId) {
    throw new Error(
      "Tinder Live credentials missing (TINDER_X_AUTH_TOKEN / TINDER_DEVICE_ID).",
    );
  }

  const key = `${token}:${deviceId}`;

  if (cachedClient && cachedKey === key) {
    return cachedClient;
  }

  const locale = (process.env.TINDER_LOCALE?.trim() || "en-US") as
    | "en-US"
    | "es-ES"
    | string;

  cachedClient = new TinderAPI({
    xAuthToken: token,
    baseOptions: {
      defaultLocale: locale as never,
      headers: {
        "persistent-device-id": deviceId,
      },
    },
  });
  cachedKey = key;

  return cachedClient;
}

export function assertTinderLiveReady() {
  if (!hasTinderLiveCredentials()) {
    throw new Error(
      "Tinder Live is not configured. Set TINDER_X_AUTH_TOKEN and TINDER_DEVICE_ID.",
    );
  }
}
