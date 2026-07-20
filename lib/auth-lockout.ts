type LockoutEntry = {
  failures: number;
  lockedUntil: number;
};

const STORE = new Map<string, LockoutEntry>();

export const AUTH_MAX_FAILURES = 5;
export const AUTH_LOCKOUT_MS = 15 * 60 * 1000;

function keyFor(ip: string, username: string) {
  return `${ip.trim()}::${username.trim().toLowerCase()}`;
}

export function getClientIp(request: Request): string {
  const forwarded =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return forwarded || "unknown";
}

export function getAuthLockoutStatus(ip: string, username: string) {
  const now = Date.now();
  const key = keyFor(ip, username);
  const entry = STORE.get(key);

  if (!entry) {
    return { locked: false as const, retryAfterSeconds: 0, failures: 0 };
  }

  if (entry.lockedUntil > now) {
    return {
      locked: true as const,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
      failures: entry.failures,
    };
  }

  if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
    STORE.delete(key);

    return { locked: false as const, retryAfterSeconds: 0, failures: 0 };
  }

  return {
    locked: false as const,
    retryAfterSeconds: 0,
    failures: entry.failures,
  };
}

export function recordAuthFailure(ip: string, username: string) {
  const now = Date.now();
  const key = keyFor(ip, username);
  const current = STORE.get(key);
  const failures = (current?.failures ?? 0) + 1;

  if (failures >= AUTH_MAX_FAILURES) {
    STORE.set(key, {
      failures,
      lockedUntil: now + AUTH_LOCKOUT_MS,
    });

    return {
      locked: true as const,
      retryAfterSeconds: Math.ceil(AUTH_LOCKOUT_MS / 1000),
      failures,
    };
  }

  STORE.set(key, { failures, lockedUntil: 0 });

  return {
    locked: false as const,
    retryAfterSeconds: 0,
    failures,
  };
}

export function clearAuthFailures(ip: string, username: string) {
  STORE.delete(keyFor(ip, username));
}

export function lockoutResponse(retryAfterSeconds: number) {
  return {
    error: "Too many failed attempts. Try again in 15 minutes.",
    retryAfterSeconds,
  };
}
