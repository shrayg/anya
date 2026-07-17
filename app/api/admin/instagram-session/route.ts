import { execFile } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { promisify } from "node:util";

import { requireAuthenticatedSession } from "@/lib/osint-api-auth";
import {
  INSTAGRAM_ENV_KEYS,
  readInstagramSessionStatus,
  writeInstagramSessionFiles,
  type InstagramEnvKey,
  type InstagramSessionInput,
} from "@/lib/instagram-session-store";
import { probeInstagramAvailability } from "@/lib/instagram-search";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

function pickBody(body: Record<string, unknown>): InstagramSessionInput {
  const input: InstagramSessionInput = {};
  for (const key of INSTAGRAM_ENV_KEYS) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) {
      input[key] = value;
    }
  }

  // Convenience aliases from browser cookie dumps
  if (!input.INSTAGRAM_SESSION_ID && typeof body.sessionid === "string") {
    input.INSTAGRAM_SESSION_ID = body.sessionid;
  }
  if (!input.INSTAGRAM_CSRF_TOKEN && typeof body.csrftoken === "string") {
    input.INSTAGRAM_CSRF_TOKEN = body.csrftoken;
  }
  if (!input.INSTAGRAM_DS_USER_ID && typeof body.ds_user_id === "string") {
    input.INSTAGRAM_DS_USER_ID = body.ds_user_id;
  }
  if (!input.INSTAGRAM_MID && typeof body.mid === "string") {
    input.INSTAGRAM_MID = body.mid;
  }
  if (!input.INSTAGRAM_IG_DID && typeof body.ig_did === "string") {
    input.INSTAGRAM_IG_DID = body.ig_did;
  }
  if (!input.INSTAGRAM_DATR && typeof body.datr === "string") {
    input.INSTAGRAM_DATR = body.datr;
  }

  return input;
}

export async function GET() {
  const session = await requireAuthenticatedSession();
  if (session instanceof NextResponse) return session;
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = readInstagramSessionStatus();
  let probeOk: boolean | null = null;
  try {
    probeOk = await probeInstagramAvailability();
  } catch {
    probeOk = false;
  }

  return NextResponse.json({
    ...status,
    probeOk,
    // Never return cookie values.
    help: "POST fresh sessionid/csrftoken (+ optional mid/ig_did/datr/ds_user_id). Stored outside the git checkout and merged into .env.local.",
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAuthenticatedSession();
  if (session instanceof NextResponse) return session;
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = pickBody(body);
  if (!input.INSTAGRAM_SESSION_ID) {
    return NextResponse.json(
      { error: "sessionid / INSTAGRAM_SESSION_ID is required" },
      { status: 400 },
    );
  }

  try {
    const written = writeInstagramSessionFiles(input);
    const restart = body.restart !== false;

    let restarted = false;
    let restartError: string | undefined;
    if (restart) {
      try {
        await execFileAsync("pm2", ["restart", "anya-int", "--update-env"], {
          timeout: 20_000,
        });
        restarted = true;
      } catch (error) {
        restartError =
          error instanceof Error
            ? error.message
            : "pm2 restart failed — restart the app manually";
      }
    }

    return NextResponse.json({
      ok: true,
      keysWritten: written.keysWritten as InstagramEnvKey[],
      secretsPath: written.secretsPath,
      restarted,
      restartError,
      message: restarted
        ? "Instagram session saved and app restarted."
        : "Instagram session saved. Restart the app to load env into all workers.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to write Instagram session",
      },
      { status: 500 },
    );
  }
}
