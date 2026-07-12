import { createHash } from "crypto";

/**
 * Have I Been Pwned k-anonymity check.
 * Only the first 5 chars of the SHA-1 hash leave the server.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: {
      "Add-Padding": "true",
      "User-Agent": "AnyaInt-PasswordCheck",
    },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });

  if (!response.ok) {
    // Fail open on HIBP outage so registration is not blocked.
    console.warn("HIBP check failed:", response.status);
    return false;
  }

  const body = await response.text();
  return body.split("\n").some((line) => {
    const [hashSuffix] = line.trim().split(":");
    return hashSuffix?.toUpperCase() === suffix;
  });
}
