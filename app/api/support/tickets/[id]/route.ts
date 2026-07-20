import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { getClientIp } from "@/lib/auth-lockout";
import { notifySupportDiscord } from "@/lib/discord-support-webhook";
import { consumeRateLimit } from "@/lib/simple-rate-limit";
import {
  categoryLabel,
  hasSupportStaffAccess,
  isTicketStatus,
  MAX_TICKET_BODY,
  sanitizeTicketText,
  statusLabel,
} from "@/lib/support-tickets";
import { prisma } from "@/prisma/client";

type Params = { params: Promise<{ id: string }> };

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

async function loadTicketForUser(
  publicId: string,
  userId: number,
  staff: boolean,
) {
  return prisma.supportTicket.findFirst({
    where: staff ? { publicId } : { publicId, userId },
    include: {
      user: { select: { username: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { username: true } },
        },
      },
    },
  });
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getAuthedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staff = hasSupportStaffAccess(user);
    const ticket = await loadTicketForUser(id, user.id, staff);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({
      ticket: {
        id: ticket.publicId,
        subject: ticket.subject,
        category: ticket.category,
        status: ticket.status,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        username: ticket.user.username,
        messages: ticket.messages.map((message) => ({
          id: message.id,
          body: message.body,
          isStaff: message.isStaff,
          createdAt: message.createdAt,
          author: message.author.username,
        })),
      },
      canManageSupport: staff,
    });
  } catch (error) {
    console.error("Get ticket error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getAuthedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.accountStatus === "banned") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const staff = hasSupportStaffAccess(user);
    const ticket = await loadTicketForUser(id, user.id, staff);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "closed") {
      return NextResponse.json(
        { error: "This ticket is closed." },
        { status: 400 },
      );
    }

    const ip = getClientIp(req);
    const limit = consumeRateLimit(
      `ticket:reply:${user.id}:${ip}`,
      20,
      60 * 60 * 1000,
    );

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many replies. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const body = await req.json().catch(() => null);
    const message = sanitizeTicketText(
      String(body?.message ?? ""),
      MAX_TICKET_BODY,
    );

    if (message.length < 2) {
      return NextResponse.json(
        { error: "Message is too short." },
        { status: 400 },
      );
    }

    const nextStatus = staff ? "awaiting_user" : "awaiting_staff";

    const [, created] = await prisma.$transaction([
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: nextStatus },
      }),
      prisma.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: user.id,
          body: message,
          isStaff: staff,
        },
      }),
    ]);

    void notifySupportDiscord({
      event: "reply",
      ticketPublicId: ticket.publicId,
      subject: ticket.subject,
      category: categoryLabel(ticket.category),
      status: statusLabel(nextStatus),
      username: user.username,
      isStaffReply: staff,
      messagePreview: message,
    });

    return NextResponse.json({
      message: {
        id: created.id,
        body: created.body,
        isStaff: created.isStaff,
        createdAt: created.createdAt,
        author: user.username,
      },
      status: nextStatus,
    });
  } catch (error) {
    console.error("Reply ticket error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getAuthedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staff = hasSupportStaffAccess(user);
    const ticket = await loadTicketForUser(id, user.id, staff);

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const status = String(body?.status ?? "");

    if (!isTicketStatus(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    // Users may only close/resolve their own tickets; staff can set any status.
    if (!staff) {
      if (status !== "closed" && status !== "resolved") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status },
    });

    void notifySupportDiscord({
      event: "status",
      ticketPublicId: ticket.publicId,
      subject: ticket.subject,
      category: categoryLabel(ticket.category),
      status: statusLabel(ticket.status),
      newStatus: statusLabel(updated.status),
      username: user.username,
    });

    return NextResponse.json({
      ticket: {
        id: updated.publicId,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("Patch ticket error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
