import { NextResponse } from "next/server";
import { deleteSessionCookie } from "@/app/lib/session";

export async function POST() {
  await deleteSessionCookie();
  return NextResponse.json({ success: true });
}
