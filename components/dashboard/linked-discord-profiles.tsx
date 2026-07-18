"use client";

import { ExternalLink } from "lucide-react";

import {
  formatDiscordCreatedAtExact,
  formatDiscordMemberSince,
  profileAccent,
  type DiscordProfile,
} from "@/lib/discord-profile";
import { resolveDiscordBadges } from "@/lib/discord-badges";

function DiscordProfileCard({ id, profile }: { id: string; profile: DiscordProfile }) {
  const accent = profileAccent(profile);
  const badges = resolveDiscordBadges(profile.badges);
  const handleTag =
    profile.discriminator !== "0"
      ? `${profile.username}#${profile.discriminator}`
      : profile.username;

  return (
    <div className="discord-profile-shell">
      {profile.bannerUrl ? (
        <img
          alt=""
          className="discord-profile-banner"
          src={profile.bannerUrl}
        />
      ) : (
        <div
          className="discord-profile-banner discord-profile-banner--solid"
          style={{ backgroundColor: accent }}
        />
      )}

      <div className="discord-profile-layout">
        <aside className="discord-profile-sidebar">
          <div className="discord-profile-avatar-wrap">
            <div
              className="discord-profile-avatar-ring"
              style={
                {
                  "--discord-accent": accent,
                  "--discord-glow": `${accent}66`,
                } as React.CSSProperties
              }
            >
              <img
                alt={`${profile.displayName} avatar`}
                className="discord-profile-avatar"
                src={profile.avatarUrl}
              />
              {profile.avatarDecorationUrl ? (
                <img
                  alt=""
                  aria-hidden
                  className="discord-profile-avatar-decoration"
                  src={profile.avatarDecorationUrl}
                />
              ) : null}
            </div>
          </div>

          <div className="discord-profile-identity">
            <h3 className="discord-profile-name">
              {profile.displayName}
              {profile.clanTag ? (
                <span className="discord-profile-clan">[{profile.clanTag}]</span>
              ) : null}
            </h3>
            <p className="discord-profile-handle">
              {profile.globalName && profile.globalName !== profile.username
                ? `${profile.globalName} · @${profile.username}`
                : `@${handleTag}`}
            </p>
          </div>

          {badges.length > 0 ? (
            <div className="discord-profile-badges" aria-label="Badges">
              {badges.map((badge) => (
                <span
                  key={badge.key}
                  className="discord-profile-badge"
                  style={
                    {
                      "--badge-color": badge.color,
                      "--badge-glow": badge.glow,
                    } as React.CSSProperties
                  }
                  title={badge.label}
                >
                  {badge.short}
                </span>
              ))}
            </div>
          ) : null}

          <div className="discord-profile-meta">
            <div>
              <p className="discord-profile-meta-label">User ID</p>
              <p className="discord-profile-meta-value discord-profile-meta-value--mono">
                {profile.id}
              </p>
            </div>
            <div>
              <p className="discord-profile-meta-label">Created (exact)</p>
              <p className="discord-profile-meta-value">
                {formatDiscordCreatedAtExact(profile.createdAt)}
              </p>
            </div>
            <div>
              <p className="discord-profile-meta-label">Member since</p>
              <p className="discord-profile-meta-value">
                {formatDiscordMemberSince(profile.createdAt)}
              </p>
            </div>
            <div>
              <p className="discord-profile-meta-label">Nitro</p>
              <p className="discord-profile-meta-value">
                {profile.nitro ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <p className="discord-profile-meta-label">Clan tag</p>
              <p className="discord-profile-meta-value">
                {profile.clanTag ? `[${profile.clanTag}]` : "—"}
              </p>
            </div>
          </div>

          <div className="discord-profile-actions">
            <a
              className="discord-profile-link"
              href={`https://discord.com/users/${profile.id}`}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="size-3.5" />
              Open on Discord
            </a>
          </div>
        </aside>

        <div className="discord-profile-main">
          {profile.bio ? (
            <div className="discord-profile-note">
              <p className="discord-profile-meta-label">About me</p>
              <p className="discord-profile-note-text">{profile.bio}</p>
            </div>
          ) : (
            <p className="discord-profile-empty">
              Linked from Roblox result · Discord ID {id}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function LinkedDiscordProfileSkeleton() {
  return (
    <div className="discord-profile-shell animate-pulse">
      <div className="discord-profile-banner discord-profile-banner--solid bg-white/5" />
      <div className="discord-profile-layout">
        <aside className="discord-profile-sidebar">
          <div className="discord-profile-avatar-wrap">
            <div className="size-[6.5rem] rounded-full bg-white/8" />
          </div>
          <div className="mx-auto mt-4 h-5 w-32 rounded bg-white/8" />
          <div className="mx-auto mt-2 h-3 w-24 rounded bg-white/6" />
        </aside>
        <div className="discord-profile-main">
          <div className="h-16 rounded-lg bg-white/5" />
        </div>
      </div>
    </div>
  );
}

export function LinkedDiscordProfiles({
  profiles,
}: {
  profiles: { id: string; profile: DiscordProfile }[];
}) {
  if (profiles.length === 0) return null;

  return (
    <div className="mb-6 space-y-4">
      <div>
        <p className="font-[family-name:var(--font-bruno-ace-sc)] text-sm tracking-wide text-white">
          Linked Discord {profiles.length === 1 ? "profile" : "profiles"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Resolved from Discord IDs found in the Roblox results
        </p>
      </div>

      <div className="space-y-4">
        {profiles.map(({ id, profile }) => (
          <DiscordProfileCard key={id} id={id} profile={profile} />
        ))}
      </div>
    </div>
  );
}
