import { NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { prisma } from "@/prisma/client";
import { addMessage, getMessages } from "@/lib/waiting-room-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = Number(searchParams.get("since") || "0");

  return NextResponse.json({
    messages: getMessages(since > 0 ? since : undefined),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = String(body.text || "").trim();
    const guestName = String(body.guestName || "").trim();

    if (!text) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    if (text.length > 500) {
      return NextResponse.json(
        { error: "Message must be 500 characters or less" },
        { status: 400 },
      );
    }

    let username = guestName;

    const session = await getSessionCookie();

    if (session?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { username: true },
      });

      if (user) {
        username = user.username;
      }
    }

    if (!username) {
      return NextResponse.json(
        { error: "Choose a display name or log in to chat" },
        { status: 400 },
      );
    }

    if (username.length > 24) {
      return NextResponse.json(
        { error: "Display name must be 24 characters or less" },
        { status: 400 },
      );
    }

    const message = addMessage(username, text);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Waiting room message error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
