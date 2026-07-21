import {
  getHingeAuthorization,
  hasHingeLiveCredentials,
} from "@/lib/hinge-live/enabled";
import { fetchWithResidentialProxy } from "@/lib/residential-proxy";

const HINGE_API_BASE = "https://prod-api.hingeaws.net";
const DEFAULT_TIMEOUT_MS = 20_000;

/** Hinge blocks / challenges many datacenter IPs — require residential by default. */
function hingeRequiresResidentialProxy(): boolean {
  const raw = process.env.HINGE_LIVE_REQUIRE_PROXY?.trim().toLowerCase();

  if (raw == null || raw === "") return true;

  return !(
    raw === "0" ||
    raw === "false" ||
    raw === "off" ||
    raw === "no"
  );
}

export type HingeLiveRequestInit = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  query?: Record<string, string | undefined>;
  timeoutMs?: number;
};

function randomUuid(): string {
  return crypto.randomUUID();
}

export function getHingeLiveHeaders(): Record<string, string> {
  const authorization = getHingeAuthorization();
  const deviceId = process.env.HINGE_DEVICE_ID?.trim() ?? "";
  const installId = process.env.HINGE_INSTALL_ID?.trim() ?? "";
  const sessionId =
    process.env.HINGE_SESSION_ID?.trim() || randomUuid();
  const appVersion = process.env.HINGE_APP_VERSION?.trim() || "9.130.0";
  const buildNumber = process.env.HINGE_BUILD_NUMBER?.trim() || "11692";
  const osVersion = process.env.HINGE_OS_VERSION?.trim() || "26.5.2";
  const deviceModelCode =
    process.env.HINGE_DEVICE_MODEL_CODE?.trim() || "iPhone18,3";
  const region = process.env.HINGE_DEVICE_REGION?.trim() || "US";

  return {
    authorization,
    "x-device-id": deviceId,
    "x-install-id": installId,
    "x-session-id": sessionId,
    "x-app-identifier": "co.hinge.mobile.ios",
    "x-app-version": appVersion,
    "x-build-number": buildNumber,
    "x-device-platform": "iOS",
    "x-os-version": osVersion,
    "x-device-region": region,
    "x-device-model": "unknown",
    "x-device-model-code": deviceModelCode,
    accept: "*/*",
    "accept-language": "en",
    "content-type": "application/json",
    "user-agent": `Hinge/${buildNumber} CFNetwork/3860.600.12 Darwin/25.5.0`,
  };
}

export function assertHingeLiveReady() {
  if (!hasHingeLiveCredentials()) {
    throw new Error(
      "Hinge Live is not configured. Set HINGE_AUTHORIZATION, HINGE_DEVICE_ID, and HINGE_INSTALL_ID.",
    );
  }
}

export async function hingeLiveFetch<T = unknown>(
  path: string,
  init: HingeLiveRequestInit = {},
): Promise<{ status: number; data: T }> {
  assertHingeLiveReady();

  const url = new URL(path.startsWith("http") ? path : `${HINGE_API_BASE}${path}`);

  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value != null && value !== "") url.searchParams.set(key, value);
    }
  }

  const response = await fetchWithResidentialProxy(url, {
    method: init.method ?? (init.body != null ? "POST" : "GET"),
    headers: getHingeLiveHeaders(),
    body: init.body != null ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    timeoutMs: init.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    forceProxy: hingeRequiresResidentialProxy(),
  });

  const text = await response.text();
  let data: T = null as T;

  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = text as T;
    }
  }

  if (!response.ok && response.status !== 304) {
    const snippet =
      typeof text === "string" && text.length > 180
        ? `${text.slice(0, 180)}…`
        : text;
    throw new Error(
      `Hinge API ${response.status} ${path}${snippet ? `: ${snippet}` : ""}`,
    );
  }

  return { status: response.status, data };
}
