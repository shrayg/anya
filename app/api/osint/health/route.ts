import { NextResponse } from "next/server";

import { PUBLIC_INTEL_SOURCE, publicServiceUnavailable } from "@/lib/public-branding";

import {
  fetchGodsEyeIngressCheck,
  fetchGodsEyeSearch,
  getGodsEyeApiKey,
  getGodsEyeExportApiKey,
  sanitizeGodsEyeSearch,
} from "@/lib/godseye";

function keyMeta(value: string | undefined) {
  if (!value) {
    return { configured: false as const };
  }

  return {
    configured: true as const,
    prefix: value.slice(0, Math.min(value.indexOf("_") + 1, 6)) || value.slice(0, 6),
    length: value.length,
  };
}

export async function GET() {
  const publicKey = getGodsEyeApiKey();
  const exportKey = getGodsEyeExportApiKey();

  if (!publicKey) {
    return NextResponse.json(
      {
        ok: false,
        error: publicServiceUnavailable(),
        keys: {
          public: keyMeta(publicKey),
          export: keyMeta(exportKey),
        },
      },
      { status: 503 },
    );
  }

  const [ingress, searchProbe, fivemProbe] = await Promise.all([
    fetchGodsEyeIngressCheck(),
    fetchGodsEyeSearch("roblox", "healthcheck", 12_000).catch(
      (error: unknown) => ({
        probeError: error instanceof Error ? error.message : "Search probe failed",
      }),
    ),
    fetchGodsEyeSearch("fivem", "1213987478122536992", 12_000).catch(
      (error: unknown) => ({
        probeError: error instanceof Error ? error.message : "FiveM probe failed",
      }),
    ),
  ]);

  const ingressOk = ingress?.success === true;
  const searchOk =
    searchProbe &&
    typeof searchProbe === "object" &&
    !("probeError" in searchProbe);
  const fivemOk =
    fivemProbe &&
    typeof fivemProbe === "object" &&
    !("probeError" in fivemProbe);
  const ok = ingressOk || searchOk || fivemOk;

  const searchError =
    searchProbe &&
    typeof searchProbe === "object" &&
    "probeError" in searchProbe
      ? searchProbe.probeError
      : undefined;

  const fivemError =
    fivemProbe &&
    typeof fivemProbe === "object" &&
    "probeError" in fivemProbe
      ? fivemProbe.probeError
      : undefined;

  return NextResponse.json(
    {
      ok,
      keys: {
        public: keyMeta(publicKey),
        export: keyMeta(exportKey),
      },
      ingress: ingress ?? { success: false, error: "No response" },
      probes: {
        search: searchOk
          ? {
              ok: true,
              count: sanitizeGodsEyeSearch(searchProbe).count,
            }
          : {
              ok: false,
              error: searchError,
            },
        fivem: fivemOk
          ? {
              ok: true,
              count: sanitizeGodsEyeSearch(fivemProbe).count,
            }
          : {
              ok: false,
              error: fivemError,
            },
      },
      help: ok
        ? `${PUBLIC_INTEL_SOURCE} intelligence is online.`
        : "Intelligence service unavailable. Check server configuration and contact support.",
    },
    { status: ok ? 200 : 502 },
  );
}
