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
const { buildInstagramBubbleMap } = await import("../lib/instagram-bubble-map");

const username = process.argv[2] ?? "natgeo";
console.log("Bubble map test for", username);

const result = await searchInstagram(username, {
  maxUsers: 40,
  lists: "both",
  enrichBios: true,
  bioLimit: 12,
});

const map = buildInstagramBubbleMap({
  profile: result.profile!,
  followers: result.followers,
  following: result.following,
  mutuals: result.mutuals,
});

console.log(
  JSON.stringify(
    {
      authMode: result.authMode,
      mutuals: result.mutuals.length,
      biosSample: [...result.following, ...result.followers]
        .filter((u) => u.biography)
        .slice(0, 5)
        .map((u) => ({
          username: u.username,
          bio: u.biography?.slice(0, 80),
        })),
      stats: map.stats,
      entities: map.entities.slice(0, 10).map((e) => ({
        kind: e.kind,
        label: e.label,
        size: e.userIds.length,
      })),
      insights: map.insights,
    },
    null,
    2,
  ),
);
