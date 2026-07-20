import { NextResponse } from "next/server";

import { requireAuthenticatedSession } from "@/lib/osint-api-auth";
import {
  PUBLIC_INTEL_SOURCE,
  publicServiceUnavailable,
} from "@/lib/public-branding";
import {
  fetchGodsEyeIngressCheck,
  fetchGodsEyeSearch,
  getGodsEyeApiKey,
  sanitizeGodsEyeSearch,
} from "@/lib/godseye";

export async function GET() {
  const session = await requireAuthenticatedSession();

  if (session instanceof NextResponse) return session;
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const publicKey = getGodsEyeApiKey();

  if (!publicKey) {
    return NextResponse.json(
      { ok: false, error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const [ingress, searchProbe, fivemProbe] = await Promise.all([
    fetchGodsEyeIngressCheck(),
    fetchGodsEyeSearch("roblox", "healthcheck", 12_000).catch(
      (error: unknown) => ({
        probeError:
          error instanceof Error ? error.message : "Search probe failed",
      }),
    ),
    fetchGodsEyeSearch("fivem", "1213987478122536992", 12_000).catch(
      (error: unknown) => ({
        probeError:
          error instanceof Error ? error.message : "FiveM probe failed",
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

  return NextResponse.json(
    {
      ok,
      ingress: ingress ?? { success: false, error: "No response" },
      probes: {
        search: searchOk
          ? { ok: true, count: sanitizeGodsEyeSearch(searchProbe).count }
          : {
              ok: false,
              error:
                searchProbe &&
                typeof searchProbe === "object" &&
                "probeError" in searchProbe
                  ? searchProbe.probeError
                  : undefined,
            },
        fivem: fivemOk
          ? { ok: true, count: sanitizeGodsEyeSearch(fivemProbe).count }
          : {
              ok: false,
              error:
                fivemProbe &&
                typeof fivemProbe === "object" &&
                "probeError" in fivemProbe
                  ? fivemProbe.probeError
                  : undefined,
            },
      },
      help: ok
        ? `${PUBLIC_INTEL_SOURCE} intelligence is online.`
        : "Intelligence service unavailable. Check server configuration and contact support.",
    },
    { status: ok ? 200 : 502 },
  );
}
