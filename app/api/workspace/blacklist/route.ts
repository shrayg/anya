import { NextRequest, NextResponse } from "next/server";

import {
  invalidateDataBlacklistCache,
  normalizeBlacklistValue,
} from "@/lib/data-blacklist";
import { requireWorkspaceAdmin } from "@/lib/workspace-admin-server";
import { prisma } from "@/prisma/client";

const MAX_VALUE_LENGTH = 512;
const MAX_NOTE_LENGTH = 500;
const MAX_LIST = 500;

function serializeEntry(row: {
  id: number;
  value: string;
  displayValue: string;
  note: string | null;
  createdById: number | null;
  createdByUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    value: row.value,
    displayValue: row.displayValue,
    note: row.note,
    createdById: row.createdById,
    createdByUsername: row.createdByUsername,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const auth = await requireWorkspaceAdmin();

    if (auth.error) return auth.error;

    const rows = await prisma.dataBlacklist.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_LIST,
    });

    return NextResponse.json({
      entries: rows.map(serializeEntry),
      total: rows.length,
    });
  } catch (error) {
    console.error("Blacklist list failed:", error);

    return NextResponse.json(
      { error: "Could not load blacklist." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceAdmin();

    if (auth.error) return auth.error;

    const body = (await req.json().catch(() => null)) as {
      value?: unknown;
      note?: unknown;
    } | null;

    const raw =
      typeof body?.value === "string" ? body.value.trim() : "";
    const noteRaw =
      typeof body?.note === "string" ? body.note.trim() : "";

    if (!raw) {
      return NextResponse.json(
        { error: "Enter a value to blacklist." },
        { status: 400 },
      );
    }

    if (raw.length > MAX_VALUE_LENGTH) {
      return NextResponse.json(
        { error: `Value must be at most ${MAX_VALUE_LENGTH} characters.` },
        { status: 400 },
      );
    }

    const value = normalizeBlacklistValue(raw);

    if (!value) {
      return NextResponse.json(
        { error: "Enter a value to blacklist." },
        { status: 400 },
      );
    }

    const note =
      noteRaw.length > 0
        ? noteRaw.slice(0, MAX_NOTE_LENGTH)
        : null;

    const existing = await prisma.dataBlacklist.findUnique({
      where: { value },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "That value is already blacklisted.",
          entry: serializeEntry(existing),
        },
        { status: 409 },
      );
    }

    const entry = await prisma.dataBlacklist.create({
      data: {
        value,
        displayValue: raw,
        note,
        createdById: auth.adminId,
        createdByUsername: auth.username,
      },
    });

    invalidateDataBlacklistCache();

    return NextResponse.json({ entry: serializeEntry(entry) }, { status: 201 });
  } catch (error) {
    console.error("Blacklist create failed:", error);

    return NextResponse.json(
      { error: "Could not add blacklist entry." },
      { status: 500 },
    );
  }
}
