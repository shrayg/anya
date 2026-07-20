import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { getClientIp } from "@/lib/auth-lockout";
import { notifySupportDiscord } from "@/lib/discord-support-webhook";
import { consumeRateLimit } from "@/lib/simple-rate-limit";
import {
  categoryLabel,
  hasSupportStaffAccess,
  isTicketCategory,
  MAX_OPEN_TICKETS_PER_USER,
  MAX_TICKET_BODY,
  MAX_TICKET_SUBJECT,
  sanitizeTicketText,
  statusLabel,
} from "@/lib/support-tickets";
import { prisma } from "@/prisma/client";

async function getAuthedUser() {
  const session = await getSessionCookie();

  if (!session?.userId) return null;

  return prisma.user.findUnique({
    where: { id: session.userId as number },
    select: {
      id: true,
      username: true,
      isAdmin: true,
      staffRole: true,
      accountStatus: true,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.accountStatus === "banned") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const staff = hasSupportStaffAccess(user);
    const scope = req.nextUrl.searchParams.get("scope");

    const tickets = await prisma.supportTicket.findMany({
      where: staff && scope === "all" ? undefined : { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        user: { select: { username: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true, isStaff: true },
        },
      },
    });

    return NextResponse.json({
      tickets: tickets.map((ticket) => ({
        id: ticket.publicId,
        subject: ticket.subject,
        category: ticket.category,
        status: ticket.status,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        username: ticket.user.username,
        lastMessage: ticket.messages[0]
          ? {
              body: ticket.messages[0].body.slice(0, 160),
              createdAt: ticket.messages[0].createdAt,
              isStaff: ticket.messages[0].isStaff,
            }
          : null,
      })),
      canManageSupport: staff,
    });
  } catch (error) {
    console.error("List tickets error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.accountStatus === "banned" || user.accountStatus === "frozen") {
      return NextResponse.json(
        { error: "Account restricted" },
        { status: 403 },
      );
    }

    const ip = getClientIp(req);
    const limit = consumeRateLimit(
      `ticket:create:${user.id}:${ip}`,
      5,
      60 * 60 * 1000,
    );

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many tickets created. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const body = await req.json().catch(() => null);
    const subject = sanitizeTicketText(
      String(body?.subject ?? ""),
      MAX_TICKET_SUBJECT,
    );
    const message = sanitizeTicketText(
      String(body?.message ?? ""),
      MAX_TICKET_BODY,
    );
    const categoryRaw = String(body?.category ?? "general");

    if (subject.length < 3) {
      return NextResponse.json(
        { error: "Subject is too short." },
        { status: 400 },
      );
    }

    if (message.length < 10) {
      return NextResponse.json(
        { error: "Message is too short." },
        { status: 400 },
      );
    }

    if (!isTicketCategory(categoryRaw)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }

    const openCount = await prisma.supportTicket.count({
      where: {
        userId: user.id,
        status: { in: ["open", "awaiting_user", "awaiting_staff"] },
      },
    });

    if (openCount >= MAX_OPEN_TICKETS_PER_USER) {
      return NextResponse.json(
        {
          error: `You can have at most ${MAX_OPEN_TICKETS_PER_USER} open tickets.`,
        },
        { status: 400 },
      );
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject,
        category: categoryRaw,
        status: "open",
        messages: {
          create: {
            authorId: user.id,
            body: message,
            isStaff: false,
          },
        },
      },
    });

    void notifySupportDiscord({
      event: "created",
      ticketPublicId: ticket.publicId,
      subject: ticket.subject,
      category: categoryLabel(ticket.category),
      status: statusLabel(ticket.status),
      username: user.username,
      messagePreview: message,
    });

    return NextResponse.json(
      {
        ticket: {
          id: ticket.publicId,
          subject: ticket.subject,
          category: ticket.category,
          status: ticket.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create ticket error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
