"use client";

import { useMemo, useState } from "react";
import { ExternalLink, ShieldCheck, Users } from "lucide-react";
import clsx from "clsx";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { InstagramActivityPanel } from "@/components/dashboard/instagram-activity-panel";
import { InstagramBubbleMapView } from "@/components/dashboard/instagram-bubble-map";
import { InstagramPersonaPanel } from "@/components/dashboard/instagram-persona-panel";
import { IntelSignalLoader } from "@/components/dashboard/intel-signal-loader";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import type { InstagramBubbleMap, RankedCloseFriend } from "@/lib/instagram-bubble-map";
import type { InstagramPersona } from "@/lib/instagram-persona";
import type { InstagramSearchResult } from "@/lib/instagram-search";
import { formatSearchRecords } from "@/lib/search-utils";

type InstagramTab =
  | "profile"
  | "persona"
  | "bubble"
  | "activity"
  | "mutuals"
  | "followers"
  | "following"
  | "leaks";

export type InstagramSearchPayload = InstagramSearchResult & {
  bubbleMap?: InstagramBubbleMap | null;
  persona?: InstagramPersona | null;
};

const LIST_PAGE_SIZE = 25;

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
      <span className="text-zinc-500">{label} · </span>
      {value}
    </span>
  );
}

function UserRow({
  user,
  blurResults,
}: {
  user: InstagramSearchResult["followers"][number];
  blurResults?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      {user.profilePicUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-10 rounded-full border border-white/10 object-cover"
          src={user.profilePicUrl}
        />
      ) : (
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-zinc-500">
          IG
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-zinc-100">
            <BlurredValue forceBlur={blurResults} text={`@${user.username}`} />
          </p>
          {user.isVerified ? (
            <ShieldCheck className="size-3.5 text-sky-400" />
          ) : null}
          {user.isPrivate ? (
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
              Private
            </span>
          ) : null}
        </div>
        {user.fullName ? (
          <p className="truncate text-xs text-zinc-400">
            <BlurredValue forceBlur={blurResults} text={user.fullName} />
          </p>
        ) : null}
        {user.biography ? (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
            <BlurredValue forceBlur={blurResults} text={user.biography} />
          </p>
        ) : null}
      </div>
      <a
        className="inline-flex items-center gap-1 text-xs text-anya-accent hover:underline"
        href={`https://www.instagram.com/${user.username}/`}
        rel="noreferrer"
        target="_blank"
      >
        Open <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

function UserList({
  users,
  blurResults,
  totalCount,
  truncated,
}: {
  users: InstagramSearchResult["followers"];
  blurResults?: boolean;
  totalCount: number;
  truncated: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  if (users.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No accounts were returned for this list.
      </p>
    );
  }

  const visible = users.slice(0, visibleCount);
  const hidden = users.length - visible.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <span>
          Showing {users.length.toLocaleString()} fetched
          {totalCount > users.length
            ? ` of ${totalCount.toLocaleString()} total`
            : ""}
        </span>
        {truncated ? (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
            Truncated by request cap
          </span>
        ) : null}
      </div>
      <div className="space-y-2">
        {visible.map((user) => (
          <UserRow key={user.id} blurResults={blurResults} user={user} />
        ))}
      </div>
      {hidden > 0 ? (
        <button
          className="text-sm text-anya-accent hover:underline"
          onClick={() => setVisibleCount((count) => count + LIST_PAGE_SIZE)}
          type="button"
        >
          Show {Math.min(hidden, LIST_PAGE_SIZE)} more
        </button>
      ) : null}
    </div>
  );
}

function RankedCloseFriendList({
  friends,
  blurResults,
}: {
  friends: RankedCloseFriend[];
  blurResults?: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);

  if (friends.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No high-confidence close friends yet. Tag activity and consistent
        commenters drive this ranking — mutual follow alone is not enough.
      </p>
    );
  }

  const visible = friends.slice(0, visibleCount);
  const hidden = friends.length - visible.length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-400">
        Ranked by confidence from tags, comments, coauthors, and mutual follow.
        One-off tags score low; reciprocal activity ranks higher.
      </p>
      <div className="space-y-2">
        {visible.map((friend) => (
          <div
            className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
            key={friend.id}
          >
            {friend.profilePicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="size-10 rounded-full border border-white/10 object-cover"
                src={friend.profilePicUrl}
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-zinc-500">
                IG
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-zinc-100">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`@${friend.username}`}
                  />
                </p>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                  {Math.round(friend.confidence * 100)}% conf
                </span>
                {friend.isMutual ? (
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                    Mutual
                  </span>
                ) : null}
              </div>
              {friend.fullName ? (
                <p className="truncate text-xs text-zinc-400">
                  <BlurredValue forceBlur={blurResults} text={friend.fullName} />
                </p>
              ) : null}
              {friend.confidenceReasons.length > 0 ? (
                <p className="mt-1 text-xs text-zinc-500">
                  {friend.confidenceReasons.join(" · ")}
                </p>
              ) : null}
            </div>
            <a
              className="inline-flex items-center gap-1 text-xs text-anya-accent hover:underline"
              href={`https://www.instagram.com/${friend.username}/`}
              rel="noreferrer"
              target="_blank"
            >
              Open <ExternalLink className="size-3" />
            </a>
          </div>
        ))}
      </div>
      {hidden > 0 ? (
        <button
          className="text-sm text-anya-accent hover:underline"
          onClick={() => setVisibleCount((count) => count + LIST_PAGE_SIZE)}
          type="button"
        >
          Show {Math.min(hidden, LIST_PAGE_SIZE)} more
        </button>
      ) : null}
    </div>
  );
}

export function InstagramSearchResults({
  result,
  blurResults = false,
  selectedExportIndex = null,
  onSelectExportIndex,
  onEnrichBios,
  enriching = false,
  loadingMore = false,
  progressLabel,
}: {
  result: InstagramSearchPayload;
  blurResults?: boolean;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
  onEnrichBios?: () => void;
  enriching?: boolean;
  loadingMore?: boolean;
  progressLabel?: string;
}) {
  const [tab, setTab] = useState<InstagramTab>(
    result.persona ? "persona" : result.bubbleMap ? "bubble" : "profile",
  );

  const leakRecords = useMemo(
    () => formatSearchRecords(result.leaks.results),
    [result.leaks.results],
  );

  const tabs: Array<{ id: InstagramTab; label: string; count?: number }> = [
    { id: "profile", label: "Profile" },
    ...(result.persona
      ? [{ id: "persona" as const, label: "Persona" }]
      : []),
    {
      id: "bubble",
      label: "Bubble map",
      count: result.bubbleMap?.stats.peopleAnalyzed,
    },
    {
      id: "activity",
      label: "Posts & places",
      count:
        (result.activity?.locations.length ?? 0) +
        (result.activity?.closeFriendCandidates.length ?? 0) +
        (result.activity?.consistentCommenters.length ?? 0),
    },
    {
      id: "mutuals",
      label: "Close friends",
      count:
        result.bubbleMap?.rankedCloseFriends?.length ??
        result.bubbleMap?.stats.closeFriendCount ??
        0,
    },
    {
      id: "followers",
      label: "Followers",
      count: result.followers.length || result.totals.followers,
    },
    {
      id: "following",
      label: "Following",
      count: result.following.length || result.totals.following,
    },
    { id: "leaks", label: "Breach intel", count: result.leaks.count },
  ];

  const profile = result.profile;

  return (
    <div className="space-y-4">
      {loadingMore ? (
        <IntelSignalLoader
          active
          stage={
            progressLabel || "Assembling live graph"
          }
          title="Instagram"
          variant="compact"
        />
      ) : null}

      {result.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-sm transition",
              tab === entry.id
                ? "border-anya-accent/50 bg-anya-accent/15 text-zinc-100"
                : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200",
            )}
            onClick={() => setTab(entry.id)}
            type="button"
          >
            {entry.label}
            {typeof entry.count === "number" && entry.count > 0
              ? ` (${entry.count.toLocaleString()})`
              : ""}
          </button>
        ))}
      </div>

      {tab === "profile" && profile ? (
        <div className="anya-result-strip space-y-4">
          <div className="flex flex-wrap items-start gap-4">
            {profile.profilePicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="size-20 rounded-full border border-white/10 object-cover"
                src={profile.profilePicUrl}
              />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Users className="size-8 text-zinc-500" />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-medium text-zinc-100">
                  <BlurredValue forceBlur={blurResults} text={`@${profile.username}`} />
                </p>
                {profile.isVerified ? (
                  <ShieldCheck className="size-4 text-sky-400" />
                ) : null}
                {profile.isPrivate ? (
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                    Private
                  </span>
                ) : null}
              </div>
              {profile.fullName ? (
                <p className="text-sm text-zinc-300">
                  <BlurredValue forceBlur={blurResults} text={profile.fullName} />
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <StatPill
                  label="Followers"
                  value={profile.followersCount.toLocaleString()}
                />
                <StatPill
                  label="Following"
                  value={profile.followingCount.toLocaleString()}
                />
                <StatPill
                  label="Mutuals"
                  value={String(result.mutuals?.length ?? 0)}
                />
                <StatPill label="Auth mode" value={result.authMode} />
                <StatPill
                  label="Mutual scan"
                  value={`${result.discovery?.followersPagesScanned ?? 0}/${result.discovery?.followingPagesScanned ?? 0} pages`}
                />
                {result.activity ? (
                  <>
                    <StatPill
                      label="Posts scanned"
                      value={String(result.activity.postsAnalyzed)}
                    />
                    <StatPill
                      label="Locations"
                      value={String(result.activity.locations.length)}
                    />
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {profile.biography ? (
            <p className="whitespace-pre-wrap text-sm text-zinc-300">
              <BlurredValue forceBlur={blurResults} text={profile.biography} />
            </p>
          ) : null}

          <a
            className="inline-flex items-center gap-1 text-sm text-anya-accent hover:underline"
            href={`https://www.instagram.com/${profile.username}/`}
            rel="noreferrer"
            target="_blank"
          >
            Open profile <ExternalLink className="size-3.5" />
          </a>
        </div>
      ) : null}

      {tab === "persona" && result.persona ? (
        <InstagramPersonaPanel
          blurResults={blurResults}
          persona={result.persona}
        />
      ) : null}

      {tab === "bubble" ? (
        <div className="space-y-3">
          {onEnrichBios ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full border border-anya-accent/40 bg-anya-accent/10 px-4 py-1.5 text-sm text-zinc-100 disabled:opacity-50"
                disabled={enriching}
                onClick={onEnrichBios}
                type="button"
              >
                {enriching ? "Loading bios…" : "Load bios & rebuild map"}
              </button>
              <p className="text-xs text-zinc-500">
                Pulls bios for mutuals/following to detect schools, orgs, and places.
              </p>
            </div>
          ) : null}
          {result.bubbleMap ? (
            <InstagramBubbleMapView
              blurResults={blurResults}
              map={result.bubbleMap}
            />
          ) : (
            <p className="text-sm text-zinc-400">
              Bubble map unavailable for this result.
            </p>
          )}
        </div>
      ) : null}

      {tab === "activity" ? (
        result.activity ? (
          <InstagramActivityPanel
            activity={result.activity}
            blurResults={blurResults}
          />
        ) : (
          <p className="text-sm text-zinc-400">
            Post activity was not loaded for this search. Re-run with an active
            Instagram session to scan posts, tags, comments, and locations.
          </p>
        )
      ) : null}

      {tab === "mutuals" ? (
        <RankedCloseFriendList
          blurResults={blurResults}
          friends={result.bubbleMap?.rankedCloseFriends ?? []}
        />
      ) : null}

      {tab === "followers" ? (
        <UserList
          blurResults={blurResults}
          totalCount={result.totals.followers}
          truncated={result.truncated.followers}
          users={result.followers}
        />
      ) : null}

      {tab === "following" ? (
        <UserList
          blurResults={blurResults}
          totalCount={result.totals.following}
          truncated={result.truncated.following}
          users={result.following}
        />
      ) : null}

      {tab === "leaks" ? (
        leakRecords.length > 0 ? (
          <SearchResultCards
            blurResults={blurResults}
            onSelectExportIndex={onSelectExportIndex}
            records={leakRecords}
            selectedExportIndex={selectedExportIndex}
            totalCount={result.leaks.count}
          />
        ) : (
          <p className="text-sm text-zinc-400">
            No breach or stealer records matched this Instagram username.
          </p>
        )
      ) : null}
    </div>
  );
}
