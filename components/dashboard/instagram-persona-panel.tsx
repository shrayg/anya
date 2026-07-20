"use client";

import type { InstagramPersona } from "@/lib/instagram-persona";

import {
  ExternalLink,
  Heart,
  MapPin,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";

import { BlurredValue } from "@/components/dashboard/blurred-value";

function Avatar({ url, fallback }: { url?: string; fallback: string }) {
  if (url) {
    return (
      <img
        alt=""
        className="size-9 shrink-0 rounded-full border border-white/10 object-cover"
        src={url}
      />
    );
  }

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] text-zinc-500">
      {fallback}
    </div>
  );
}

function formatCount(value?: number): string {
  if (!value || value <= 0) return "";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;

  return String(value);
}

export function InstagramPersonaPanel({
  persona,
  blurResults = false,
}: {
  persona: InstagramPersona;
  blurResults?: boolean;
}) {
  const maxInterestWeight = Math.max(
    1,
    ...persona.interests.map((topic) => topic.weight),
  );

  return (
    <div className="space-y-5">
      {/* Headline + narrative */}
      <div className="rounded-2xl border border-anya-accent/20 bg-gradient-to-br from-anya-accent/10 to-transparent px-5 py-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-100">
          <Sparkles className="size-4 text-anya-accent" />
          {persona.headline ? (
            <BlurredValue forceBlur={blurResults} text={persona.headline} />
          ) : (
            "Persona summary"
          )}
        </div>
        <div className="space-y-1.5 text-sm text-zinc-300">
          {persona.summary.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>

      <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Following · {persona.stats.following.toLocaleString()}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Followers · {persona.stats.followers.toLocaleString()}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Mutuals · {persona.stats.mutuals.toLocaleString()}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Interested-in · {persona.stats.interestedInCount.toLocaleString()}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Creators followed · {persona.stats.creatorsFollowed.toLocaleString()}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Bios analyzed · {persona.stats.biosAnalyzed.toLocaleString()}
        </div>
      </div>

      {/* Interests */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <Heart className="size-4 text-rose-300" />
          Interests (from accounts they follow)
        </div>
        {persona.interests.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No interest signals yet. Load bios to pull categories from the
            accounts they follow.
          </p>
        ) : (
          <div className="space-y-2">
            {persona.interests.map((topic) => (
              <div key={topic.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-200">{topic.label}</span>
                  <span className="text-zinc-500">
                    {topic.examples
                      .slice(0, 3)
                      .map((example) =>
                        example === "profile bio" ? example : `@${example}`,
                      )
                      .join(", ")}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-anya-accent/70"
                    style={{
                      width: `${Math.round((topic.weight / maxInterestWeight) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Interested-in accounts */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <Users className="size-4 text-sky-300" />
          Following without follow-back (interest accounts)
        </div>
        {persona.interestedIn.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Every followed account follows back, or lists weren&apos;t loaded.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {persona.interestedIn.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
              >
                <Avatar fallback="IG" url={account.profilePicUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-100">
                    <BlurredValue
                      forceBlur={blurResults}
                      text={`@${account.username}`}
                    />
                    {account.isVerified ? (
                      <span className="ml-1 text-sky-400">✓</span>
                    ) : null}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {account.reason}
                    {formatCount(account.followerCount)
                      ? ` · ${formatCount(account.followerCount)} followers`
                      : ""}
                  </p>
                </div>
                <a
                  className="text-xs text-anya-accent hover:underline"
                  href={`https://www.instagram.com/${account.username}/`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tag relationships */}
      {persona.tagRelationships.youTag.length > 0 ||
      persona.tagRelationships.tagYou.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-zinc-200">
            <Tag className="size-4 text-amber-300" />
            Tag relationships
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                People they tag most
              </p>
              {persona.tagRelationships.youTag.length === 0 ? (
                <p className="text-xs text-zinc-500">None found.</p>
              ) : (
                <ul className="space-y-1 text-sm text-zinc-200">
                  {persona.tagRelationships.youTag
                    .slice(0, 8)
                    .map((relation) => (
                      <li
                        key={relation.username}
                        className="flex items-center justify-between"
                      >
                        <BlurredValue
                          forceBlur={blurResults}
                          text={`@${relation.username}`}
                        />
                        <span className="text-xs text-zinc-500">
                          {relation.count}×
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                People who tag them most
              </p>
              {persona.tagRelationships.tagYou.length === 0 ? (
                <p className="text-xs text-zinc-500">None found.</p>
              ) : (
                <ul className="space-y-1 text-sm text-zinc-200">
                  {persona.tagRelationships.tagYou
                    .slice(0, 8)
                    .map((relation) => (
                      <li
                        key={relation.username}
                        className="flex items-center justify-between"
                      >
                        <BlurredValue
                          forceBlur={blurResults}
                          text={`@${relation.username}`}
                        />
                        <span className="text-xs text-zinc-500">
                          {relation.count}×
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Core friend group (second-degree) */}
      {persona.coreFriendGroup.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-zinc-200">
            <Users className="size-4 text-rose-300" />
            Core friend group (shared mutual connections)
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {persona.coreFriendGroup.map((friend) => (
              <div
                key={friend.username}
                className="flex items-center gap-3 rounded-xl border border-rose-400/15 bg-rose-500/5 px-3 py-2"
              >
                <Avatar fallback="IG" url={friend.profilePicUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-100">
                    <BlurredValue
                      forceBlur={blurResults}
                      text={`@${friend.username}`}
                    />
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    connected to {friend.internalDegree} of their other mutuals
                  </p>
                </div>
                <a
                  className="text-xs text-anya-accent hover:underline"
                  href={`https://www.instagram.com/${friend.username}/`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Mutual highlights */}
      {persona.mutualHighlights.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-zinc-200">
            <Users className="size-4 text-amber-300" />
            Mutuals (relationship circle)
          </div>
          <div className="flex flex-wrap gap-2">
            {persona.mutualHighlights.map((person) => (
              <a
                key={person.id}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 hover:bg-white/[0.06]"
                href={`https://www.instagram.com/${person.username}/`}
                rel="noreferrer"
                target="_blank"
              >
                <Avatar fallback="IG" url={person.profilePicUrl} />
                <span className="text-xs text-zinc-200">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`@${person.username}`}
                  />
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {/* Places */}
      {persona.places.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-zinc-200">
            <MapPin className="size-4 text-emerald-300" />
            Geotagged places
          </div>
          <div className="flex flex-wrap gap-2">
            {persona.places.map((place) => (
              <span
                key={`${place.name}-${place.lastSeenIso}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-300"
              >
                {place.name}
                {place.lastSeenIso
                  ? ` · ${place.lastSeenIso.slice(0, 10)}`
                  : ""}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
