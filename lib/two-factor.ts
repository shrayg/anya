import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "crypto";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import * as OTPAuth from "otpauth";

import { siteConfig } from "@/config/site";

const PENDING_TTL = "10m";
const LOGIN_PENDING_TTL = "5m";
const BACKUP_CODE_COUNT = 8;
const ENC_PREFIX = "v1:";

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret && secret !== "change-me" && secret !== "super-secret-jwt-key") {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a strong value in production");
  }

  return secret || "dev-only-jwt-secret";
}

/**
 * AES-256 key for TOTP secrets at rest.
 * Prefer TWO_FACTOR_ENCRYPTION_KEY when set; otherwise HKDF-derive from JWT_SECRET
 * so no extra env var is required.
 */
function getTotpEncryptionKey(): Uint8Array {
  const explicit = process.env.TWO_FACTOR_ENCRYPTION_KEY?.trim();

  if (explicit) {
    return new Uint8Array(createHash("sha256").update(explicit).digest());
  }

  return new Uint8Array(
    hkdfSync("sha256", resolveJwtSecret(), "anya-2fa", "totp-secret-v1", 32),
  );
}

function getPendingKey() {
  return new TextEncoder().encode(resolveJwtSecret());
}

export function encryptTotpSecret(plainBase32: string): string {
  const key = getTotpEncryptionKey();
  const iv = new Uint8Array(randomBytes(12));
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const part1 = new Uint8Array(cipher.update(plainBase32, "utf8"));
  const part2 = new Uint8Array(cipher.final());
  const encrypted = new Uint8Array(part1.length + part2.length);

  encrypted.set(part1, 0);
  encrypted.set(part2, part1.length);

  const tag = new Uint8Array(cipher.getAuthTag());
  const packed = new Uint8Array(iv.length + tag.length + encrypted.length);

  packed.set(iv, 0);
  packed.set(tag, iv.length);
  packed.set(encrypted, iv.length + tag.length);

  return ENC_PREFIX + Buffer.from(packed).toString("base64url");
}

export function decryptTotpSecret(payload: string): string {
  if (!payload.startsWith(ENC_PREFIX)) {
    throw new Error("Unsupported 2FA secret encoding");
  }

  const raw = new Uint8Array(
    Buffer.from(payload.slice(ENC_PREFIX.length), "base64url"),
  );

  if (raw.length < 12 + 16 + 1) {
    throw new Error("Corrupt 2FA secret");
  }

  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const key = getTotpEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(tag);

  const part1 = new Uint8Array(decipher.update(ciphertext));
  const part2 = new Uint8Array(decipher.final());
  const plain = new Uint8Array(part1.length + part2.length);

  plain.set(part1, 0);
  plain.set(part2, part1.length);

  return Buffer.from(plain).toString("utf8");
}

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildTotp(secretBase32: string, username: string) {
  return new OTPAuth.TOTP({
    issuer: siteConfig.name,
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32.replace(/\s+/g, "")),
  });
}

export function getOtpauthUrl(secretBase32: string, username: string): string {
  return buildTotp(secretBase32, username).toString();
}

/** Accept current ±1 window to absorb slight clock skew. */
export function verifyTotpCode(
  secretBase32: string,
  username: string,
  code: string,
): boolean {
  const normalized = code.replace(/\s+/g, "");

  if (!/^\d{6}$/.test(normalized)) return false;

  const delta = buildTotp(secretBase32, username).validate({
    token: normalized,
    window: 1,
  });

  return delta !== null;
}

function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function generateBackupCodes(): string[] {
  const codes: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const hex = randomBytes(4).toString("hex").toUpperCase();

    codes.push(`${hex.slice(0, 4)}-${hex.slice(4)}`);
  }

  return codes;
}

export async function hashBackupCodes(codes: string[]): Promise<string> {
  const hashed = await Promise.all(
    codes.map((code) => bcrypt.hash(normalizeBackupCode(code), 10)),
  );

  return JSON.stringify(hashed);
}

export async function consumeBackupCode(
  storedJson: string | null | undefined,
  code: string,
): Promise<{ ok: boolean; remainingJson: string | null }> {
  if (!storedJson) return { ok: false, remainingJson: null };

  let hashes: string[];

  try {
    const parsed = JSON.parse(storedJson) as unknown;

    hashes = Array.isArray(parsed)
      ? parsed.filter((h): h is string => typeof h === "string")
      : [];
  } catch {
    return { ok: false, remainingJson: null };
  }

  const normalized = normalizeBackupCode(code);

  if (normalized.length < 8) {
    return { ok: false, remainingJson: storedJson };
  }

  for (let i = 0; i < hashes.length; i++) {
    const match = await bcrypt.compare(normalized, hashes[i]);

    if (match) {
      const remaining = [...hashes.slice(0, i), ...hashes.slice(i + 1)];

      return {
        ok: true,
        remainingJson: remaining.length ? JSON.stringify(remaining) : null,
      };
    }
  }

  return { ok: false, remainingJson: storedJson };
}

export type SetupPendingPayload = {
  purpose: "2fa-setup";
  userId: number;
  secret: string;
};

export type LoginPendingPayload = {
  purpose: "2fa-login";
  userId: number;
  isAdmin: boolean;
};

export async function createSetupPendingToken(
  userId: number,
  secret: string,
): Promise<string> {
  return new SignJWT({
    purpose: "2fa-setup",
    userId,
    secret,
  } satisfies SetupPendingPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(PENDING_TTL)
    .sign(getPendingKey());
}

export async function verifySetupPendingToken(
  token: string,
): Promise<SetupPendingPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getPendingKey(), {
      algorithms: ["HS256"],
    });

    if (payload.purpose !== "2fa-setup") return null;

    const userId = Number(payload.userId);
    const secret = typeof payload.secret === "string" ? payload.secret : "";

    if (!Number.isFinite(userId) || userId <= 0 || !secret) return null;

    return { purpose: "2fa-setup", userId, secret };
  } catch {
    return null;
  }
}

export async function createLoginPendingToken(
  userId: number,
  isAdmin: boolean,
): Promise<string> {
  return new SignJWT({
    purpose: "2fa-login",
    userId,
    isAdmin,
  } satisfies LoginPendingPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(LOGIN_PENDING_TTL)
    .sign(getPendingKey());
}

export async function verifyLoginPendingToken(
  token: string,
): Promise<LoginPendingPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getPendingKey(), {
      algorithms: ["HS256"],
    });

    if (payload.purpose !== "2fa-login") return null;

    const userId = Number(payload.userId);

    if (!Number.isFinite(userId) || userId <= 0) return null;

    return {
      purpose: "2fa-login",
      userId,
      isAdmin: Boolean(payload.isAdmin),
    };
  } catch {
    return null;
  }
}

export function safeEqualString(a: string, b: string): boolean {
  const bufA = new Uint8Array(Buffer.from(a));
  const bufB = new Uint8Array(Buffer.from(b));

  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
}
