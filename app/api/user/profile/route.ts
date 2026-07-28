import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import {
  normalizeAvatarUrl,
  normalizeDashboardAccent,
  normalizeDisplayName,
} from "@/lib/dashboard-profile";
import { prisma } from "@/prisma/client";

export const runtime = "nodejs";

const profileSelect = {
  displayName: true,
  avatarUrl: true,
  dashboardAccent: true,
  onboardingCompletedAt: true,
} as const;

export async function GET() {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId as number },
    select: {
      username: true,
      ...profileSelect,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      ...user,
      onboardingCompleted: Boolean(user.onboardingCompletedAt),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId as number;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: {
    displayName?: string | null;
    avatarUrl?: string | null;
    dashboardAccent?: string | null;
    onboardingCompletedAt?: Date;
  } = {};

  if ("displayName" in body) {
    const displayName = normalizeDisplayName(body.displayName);

    if (displayName === undefined) {
      return NextResponse.json(
        { error: "Display name must be 1–40 characters" },
        { status: 400 },
      );
    }
    data.displayName = displayName;
  }

  if ("avatarUrl" in body) {
    const avatarUrl = normalizeAvatarUrl(body.avatarUrl);

    if (avatarUrl === undefined) {
      return NextResponse.json(
        {
          error:
            "Avatar must be a small image upload, https URL, or clear the field",
        },
        { status: 400 },
      );
    }
    data.avatarUrl = avatarUrl;
  }

  if ("dashboardAccent" in body) {
    const dashboardAccent = normalizeDashboardAccent(body.dashboardAccent);

    if (dashboardAccent === undefined) {
      return NextResponse.json(
        { error: "Accent must be a hex color like #c3d3e6" },
        { status: 400 },
      );
    }
    data.dashboardAccent = dashboardAccent;
  }

  const completeOnboarding =
    body.completeOnboarding === true || body.skipOnboarding === true;

  if (completeOnboarding) {
    data.onboardingCompletedAt = new Date();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      username: true,
      ...profileSelect,
    },
  });

  return NextResponse.json({
    ok: true,
    skipped: body.skipOnboarding === true,
    user: {
      ...user,
      onboardingCompleted: Boolean(user.onboardingCompletedAt),
    },
  });
}
