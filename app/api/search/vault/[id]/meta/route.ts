import { NextRequest, NextResponse } from "next/server";

import { getSearchVaultMeta } from "@/lib/search-result-vault";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const vaultId = id?.trim();

  if (!vaultId) {
    return NextResponse.json({ error: "Missing vault id." }, { status: 400 });
  }

  const meta = await getSearchVaultMeta(vaultId);

  if (!meta) {
    return NextResponse.json({ error: "Vault not found." }, { status: 404 });
  }

  return NextResponse.json(meta);
}
