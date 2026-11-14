export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

/** Lowercases and strips anything that isn't a letter, digit or underscore. */
export function normalizeUsername(input: string): string {
  return input
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

export function isValidUsername(input: string): boolean {
  return USERNAME_PATTERN.test(input);
}

/** Only same-origin relative paths are allowed as post-sign-in destinations. */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  return value;
}

export function inviteLink(origin: string, username: string): string {
  return `${origin.replace(/\/+$/, "")}/add/${username}`;
}
