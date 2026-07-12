export const MIN_PASSWORD_LENGTH = 12;
export const MIN_USERNAME_LENGTH = 5;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function hasUpper(value: string) {
  return /[A-Z]/.test(value);
}

function hasLower(value: string) {
  return /[a-z]/.test(value);
}

function hasDigit(value: string) {
  return /\d/.test(value);
}

function hasSymbol(value: string) {
  return /[^A-Za-z0-9]/.test(value);
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!hasUpper(password) || !hasLower(password) || !hasDigit(password) || !hasSymbol(password)) {
    return "Password must include uppercase, lowercase, a number, and a symbol.";
  }

  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();

  if (trimmed.length < MIN_USERNAME_LENGTH) {
    return `Username must be at least ${MIN_USERNAME_LENGTH} characters.`;
  }

  if (trimmed.length > 32) {
    return "Username must be at most 32 characters.";
  }

  if (!USERNAME_PATTERN.test(trimmed)) {
    return "Username may only contain letters, numbers, and underscores.";
  }

  return null;
}

function randomChar(alphabet: string) {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return alphabet[bytes[0] % alphabet.length];
}

/** Cryptographically random password that always satisfies policy. */
export function generateStrongPassword(length = 16): string {
  const size = Math.max(length, MIN_PASSWORD_LENGTH);
  const chars = [
    randomChar(UPPER),
    randomChar(LOWER),
    randomChar(DIGITS),
    randomChar(SYMBOLS),
  ];

  for (let i = chars.length; i < size; i += 1) {
    chars.push(randomChar(ALL));
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const j = bytes[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export function passwordRequirementsHint() {
  return `At least ${MIN_PASSWORD_LENGTH} characters with upper, lower, number, and symbol.`;
}
