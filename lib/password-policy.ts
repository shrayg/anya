export const MIN_PASSWORD_LENGTH = 3;
export const MIN_USERNAME_LENGTH = 3;

export function validatePassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim();

  if (trimmed.length < MIN_USERNAME_LENGTH) {
    return `Username must be at least ${MIN_USERNAME_LENGTH} characters.`;
  }

  return null;
}
