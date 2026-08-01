import { NextRequest, NextResponse } from "next/server";

import { invalidateDataBlacklistCache } from "@/lib/data-blacklist";
import { requireWorkspaceAdmin } from "@/lib/workspace-admin-server";
import { prisma } from "@/prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireWorkspaceAdmin();

    if (auth.error) return auth.error;

    const { id: idRaw } = await params;
    const id = Number(idRaw);

    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }

    const existing = await prisma.dataBlacklist.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    await prisma.dataBlacklist.delete({ where: { id } });
    invalidateDataBlacklistCache();

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("Blacklist delete failed:", error);

    return NextResponse.json(
      { error: "Could not remove blacklist entry." },
      { status: 500 },
    );
  }
}
