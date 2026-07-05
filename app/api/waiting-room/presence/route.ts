import { NextResponse } from "next/server";

import { getOnlineCount, touchPresence } from "@/lib/waiting-room-store";

export async function GET() {
  return NextResponse.json({ online: getOnlineCount() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionKey = String(body.sessionKey || "").trim();

    if (!sessionKey) {
      return NextResponse.json({ error: "Session key is required" }, { status: 400 });
    }

    touchPresence(sessionKey);

    return NextResponse.json({ online: getOnlineCount() });
  } catch (error) {
    console.error("Waiting room presence error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
