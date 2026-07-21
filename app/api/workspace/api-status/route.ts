import { NextResponse } from "next/server";

import { buildApiStatusPayload } from "@/lib/api-status";
import { requireWorkspaceAdmin } from "@/lib/workspace-admin-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const auth = await requireWorkspaceAdmin();

  if (auth.error) return auth.error;

  try {
    const payload = await buildApiStatusPayload();

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not build API status payload.",
      },
      { status: 500 },
    );
  }
}
