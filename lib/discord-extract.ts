import { isDiscordSnowflake } from "@/lib/osintcat";

const DISCORD_FIELD_RE =
  /^(discord(_?id)?|user_?id|userid|linked_?discord|dc_?id|snowflake)$/i;
const SNOWFLAKE_RE = /\b\d{17,20}\b/g;

function addSnowflake(value: string, found: Set<string>) {
  const trimmed = value.trim();

  if (isDiscordSnowflake(trimmed)) {
    found.add(trimmed);

    return;
  }

  for (const match of trimmed.match(SNOWFLAKE_RE) ?? []) {
    if (isDiscordSnowflake(match)) {
      found.add(match);
    }
  }
}

export function extractDiscordIdsFromUnknown(
  value: unknown,
  found = new Set<string>(),
): string[] {
  if (value === null || value === undefined) {
    return Array.from(found);
  }

  if (typeof value === "string") {
    addSnowflake(value, found);

    return Array.from(found);
  }

  if (typeof value === "number") {
    addSnowflake(String(value), found);

    return Array.from(found);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      extractDiscordIdsFromUnknown(entry, found);
    }

    return Array.from(found);
  }

  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (DISCORD_FIELD_RE.test(key) && entry !== null && entry !== undefined) {
        addSnowflake(String(entry), found);
      }

      extractDiscordIdsFromUnknown(entry, found);
    }
  }

  return Array.from(found);
}

export function extractDiscordIdsFromResults(results: unknown[]): string[] {
  return extractDiscordIdsFromUnknown(results);
}
