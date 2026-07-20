/**
 * Sanitize usernames before interpolating into URL templates.
 * Reject path / host injection and keep handles platform-portable.
 */

const MAX_LEN = 64;

/** Strip a leading @ and surrounding whitespace. */
export function normalizeUsernameInput(raw: string): string {
  return raw.trim().replace(/^@+/, "").trim();
}

/**
 * Returns a safe handle or null when the input must not be placed in a URL.
 */
export function sanitizeUsernameForAccounts(raw: string): string | null {
  const username = normalizeUsernameInput(raw);

  if (!username || username.length > MAX_LEN) return null;

  // Block URL / path / query tricks.
  if (/[\/\\?#%\s]|:\/\//.test(username)) return null;
  if (username.includes("@") || username.includes("..")) return null;
  if (username.startsWith(".") || username.endsWith(".")) return null;

  // Allow common handle chars across social / gaming / coding sites.
  if (!/^[a-zA-Z0-9]$/.test(username)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$/.test(username)) {
      return null;
    }
  }

  return username;
}

export const USERNAME_ACCOUNTS_INVALID_MESSAGE =
  "Enter a plain username (letters, numbers, ., _, -). No URLs, spaces, or @handles with special characters.";
