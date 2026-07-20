"use client";

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/csrf-constants";

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;

  const parts = document.cookie.split("; ");

  for (const part of parts) {
    const eq = part.indexOf("=");

    if (eq === -1) continue;
    const name = part.slice(0, eq);

    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }

  return null;
}

async function ensureCsrfToken(): Promise<string | null> {
  let token = readCsrfCookie();

  if (token) return token;

  try {
    await fetch("/api/auth/csrf", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return null;
  }

  return readCsrfCookie();
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Browser fetch wrapper that attaches the double-submit CSRF header on
 * state-changing requests. Prefer this over raw fetch for /api/* mutations.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (MUTATING.has(method)) {
    const token = await ensureCsrfToken();

    if (token) {
      headers.set(CSRF_HEADER_NAME, token);
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
}
