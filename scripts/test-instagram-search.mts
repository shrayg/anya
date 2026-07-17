import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!(key in process.env)) process.env[key] = value;
}

const { searchInstagram } = await import("../lib/instagram-search");

const username = process.argv[2] ?? "natgeo";
const maxUsers = Number(process.argv[3] ?? "500");

console.log(`Pulling up to ${maxUsers} for @${username}...`);
const started = Date.now();

const result = await searchInstagram(username, {
  maxUsers,
  lists: "both",
});

console.log(
  JSON.stringify(
    {
      ms: Date.now() - started,
      authMode: result.authMode,
      profileFollowers: result.profile?.followersCount,
      profileFollowing: result.profile?.followingCount,
      followersFetched: result.followers.length,
      followingFetched: result.following.length,
      mutuals: result.mutuals.length,
      discovery: result.discovery,
      truncated: result.truncated,
      warnings: result.warnings,
      sampleFollowers: result.followers.slice(0, 3).map((u) => u.username),
      sampleFollowing: result.following.slice(0, 3).map((u) => u.username),
    },
    null,
    2,
  ),
);
