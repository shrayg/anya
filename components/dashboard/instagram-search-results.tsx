"use client";

import type {
  InstagramBubbleMap,
  RankedCloseFriend,
} from "@/lib/instagram-bubble-map";
import type { InstagramPersona } from "@/lib/instagram-persona";
import type { InstagramSearchResult } from "@/lib/instagram-search";

import { useMemo, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { SiInstagram as InstagramBrand } from "react-icons/si";
import clsx from "clsx";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { InstagramActivityPanel } from "@/components/dashboard/instagram-activity-panel";
import { InstagramBubbleMapView } from "@/components/dashboard/instagram-bubble-map";
import { InstagramPersonaPanel } from "@/components/dashboard/instagram-persona-panel";
import { IntelSignalLoader } from "@/components/dashboard/intel-signal-loader";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
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

type IgUser = InstagramSearchResult["followers"][number];

const LIST_PAGE_SIZE = 20;

function sortUsersByUsername(users: IgUser[]): IgUser[] {
  return [...users].sort((a, b) =>
    a.username.localeCompare(b.username, undefined, { sensitivity: "base" }),
  );
}

function Field({
  label,
  value,
  blurResults,
  wide = false,
}: {
  label: string;
  value: string;
  blurResults?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={clsx(
        "anya-result-field",
        wide && "anya-result-field--block sm:col-span-2 lg:col-span-3",
      )}
    >
      <p className="anya-result-label">{label}</p>
      <p
        className={clsx(
          "anya-result-value",
          wide && "anya-result-value--block",
        )}
      >
        <BlurredValue forceBlur={blurResults} text={value} />
      </p>
    </div>
  );
}

function UserRow({
  user,
  blurResults,
  meta,
}: {
  user: {
    id: string;
    username: string;
    fullName?: string | null;
    biography?: string | null;
    profilePicUrl?: string | null;
    isVerified?: boolean;
    isPrivate?: boolean;
  };
  blurResults?: boolean;
  meta?: string;
}) {
  return (
    <article className="anya-ig-row">
      {user.profilePicUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="anya-ig-row-avatar" src={user.profilePicUrl} />
      ) : (
        <div className="anya-ig-row-avatar anya-ig-row-avatar--empty">IG</div>
      )}
      <div className="anya-ig-row-body">
        <div className="anya-ig-row-top">
          <p className="anya-ig-row-user">
            <BlurredValue forceBlur={blurResults} text={`@${user.username}`} />
          </p>
          {user.isVerified ? (
            <ShieldCheck className="size-3.5 shrink-0 text-[var(--anya-blush)]" />
          ) : null}
          {user.isPrivate ? (
            <span className="anya-result-badge">Private</span>
          ) : null}
          {meta ? <span className="anya-ig-row-meta">{meta}</span> : null}
        </div>
        {user.fullName ? (
          <p className="anya-ig-row-name">
            <BlurredValue forceBlur={blurResults} text={user.fullName} />
          </p>
        ) : null}
        {user.biography ? (
          <p className="anya-ig-row-bio">
            <BlurredValue forceBlur={blurResults} text={user.biography} />
          </p>
        ) : null}
      </div>
      <a
        className="anya-ig-row-open"
        href={`https://www.instagram.com/${user.username}/`}
        rel="noreferrer"
        target="_blank"
      >
        Open <ExternalLink className="size-3" />
      </a>
    </article>
  );
}

function UserList({
  users,
  blurResults,
  totalCount,
  truncated,
  sortLabel = "A–Z by username",
}: {
  users: IgUser[];
  blurResults?: boolean;
  totalCount: number;
  truncated: boolean;
  sortLabel?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
  const sorted = useMemo(() => sortUsersByUsername(users), [users]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No accounts were returned for this list.
      </p>
    );
  }

  const visible = sorted.slice(0, visibleCount);
  const hidden = sorted.length - visible.length;

  return (
    <div className="anya-result-stack">
      <div className="anya-result-stack-toolbar">
        <p className="text-xs text-zinc-500">
          Showing {sorted.length.toLocaleString()} fetched
          {totalCount > sorted.length
            ? ` of ${totalCount.toLocaleString()} total`
            : ""}
          <span className="text-zinc-600"> · Sorted {sortLabel}</span>
          {truncated ? " · Truncated by request cap" : ""}
        </p>
      </div>
      <div className="anya-ig-list">
        {visible.map((user) => (
          <UserRow key={user.id} blurResults={blurResults} user={user} />
        ))}
      </div>
      {hidden > 0 ? (
        <button
          className="anya-result-load-more"
          type="button"
          onClick={() => setVisibleCount((count) => count + LIST_PAGE_SIZE)}
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

  // Already ranked by confidence — keep that order.
  const visible = friends.slice(0, visibleCount);
  const hidden = friends.length - visible.length;

  return (
    <div className="anya-result-stack">
      <div className="anya-result-stack-toolbar">
        <p className="text-xs text-zinc-500">
          Sorted by confidence · tags, comments, coauthors, mutual follow
        </p>
      </div>
      <div className="anya-ig-list">
        {visible.map((friend) => (
          <UserRow
            key={friend.id}
            blurResults={blurResults}
            meta={`${Math.round(friend.confidence * 100)}% conf${friend.isMutual ? " · mutual" : ""}`}
            user={friend}
          />
        ))}
      </div>
      {friends
        .slice(0, visibleCount)
        .some((f) => f.confidenceReasons.length > 0) ? (
        <div className="space-y-2">
          {visible
            .filter((f) => f.confidenceReasons.length > 0)
            .slice(0, 8)
            .map((friend) => (
              <div
                key={`sig-${friend.id}`}
                className="anya-ai-signal anya-ai-signal--info"
              >
                <p className="anya-ai-signal-title">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`@${friend.username}`}
                  />
                </p>
                <p className="anya-ai-signal-detail">
                  {friend.confidenceReasons.join(" · ")}
                </p>
              </div>
            ))}
        </div>
      ) : null}
      {hidden > 0 ? (
        <button
          className="anya-result-load-more"
          type="button"
          onClick={() => setVisibleCount((count) => count + LIST_PAGE_SIZE)}
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
    ...(result.persona ? [{ id: "persona" as const, label: "Persona" }] : []),
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
  const closeFriendCount =
    result.bubbleMap?.rankedCloseFriends?.length ??
    result.bubbleMap?.stats.closeFriendCount ??
    0;

  return (
    <div className="anya-ig-results space-y-4">
      {loadingMore ? (
        <IntelSignalLoader
          active
          stage={progressLabel || "Assembling live graph"}
          title="Instagram"
          variant="compact"
        />
      ) : null}

      <div className="anya-ai-brief">
        <div className="anya-ai-brief-header">
          <span className="anya-ai-mode-tag inline-flex items-center gap-1.5">
            <InstagramBrand className="size-3.5" />
            Instagram
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="anya-ai-confidence">
              {(
                profile?.followersCount ?? result.totals.followers
              ).toLocaleString()}{" "}
              followers
            </span>
            <span className="anya-result-badge">
              {(result.mutuals?.length ?? 0).toLocaleString()} mutuals
            </span>
            {closeFriendCount > 0 ? (
              <span className="anya-ai-risk-pill border-amber-400/40 text-amber-200">
                {closeFriendCount} close-friend signals
              </span>
            ) : null}
          </div>
        </div>
        <p className="anya-ai-brief-text">
          Profile intel for{" "}
          <span className="text-zinc-100">
            <BlurredValue
              forceBlur={blurResults}
              text={`@${result.query || profile?.username || "target"}`}
            />
          </span>
          {profile?.fullName ? (
            <>
              {" "}
              · <BlurredValue forceBlur={blurResults} text={profile.fullName} />
            </>
          ) : null}
          . Lists sorted for large scans; close friends stay confidence-ranked.
        </p>
        <div className="anya-ai-meter">
          <div
            className="anya-ai-meter-fill"
            style={{
              width: `${Math.min(
                100,
                Math.round(
                  ((result.followers.length + result.following.length) /
                    Math.max(
                      1,
                      (profile?.followersCount ?? 0) +
                        (profile?.followingCount ?? 0),
                      result.followers.length + result.following.length,
                    )) *
                    100,
                ),
              )}%`,
            }}
          />
        </div>
      </div>

      <div className="anya-ig-tabs" role="tablist">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            className={clsx("ui-tab", tab === entry.id && "ui-tab--active")}
            role="tab"
            type="button"
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
            {typeof entry.count === "number" && entry.count > 0
              ? ` · ${entry.count.toLocaleString()}`
              : ""}
          </button>
        ))}
      </div>

      {tab === "profile" && profile ? (
        <article className="anya-result-card anya-result-card--expanded">
          <header className="anya-result-card-header">
            <div className="flex min-w-0 items-center gap-3">
              {profile.profilePicUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="size-10 rounded-full border border-white/10 object-cover"
                  src={profile.profilePicUrl}
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <InstagramBrand className="size-4 text-zinc-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="anya-result-card-title">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`@${profile.username}`}
                  />
                </p>
                <p className="anya-result-card-subtitle">instagram.com</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {profile.isVerified ? (
                <span className="anya-result-badge">Verified</span>
              ) : null}
              {profile.isPrivate ? (
                <span className="anya-result-badge">Private</span>
              ) : null}
              <span className="anya-result-index">profile</span>
            </div>
          </header>
          <div className="anya-result-card-body">
            {profile.fullName ? (
              <Field
                blurResults={blurResults}
                label="Full name"
                value={profile.fullName}
              />
            ) : null}
            <Field
              blurResults={blurResults}
              label="Followers"
              value={profile.followersCount.toLocaleString()}
            />
            <Field
              blurResults={blurResults}
              label="Following"
              value={profile.followingCount.toLocaleString()}
            />
            <Field
              blurResults={blurResults}
              label="Mutuals fetched"
              value={String(result.mutuals?.length ?? 0)}
            />
            <Field
              blurResults={blurResults}
              label="Auth mode"
              value={result.authMode}
            />
            <Field
              blurResults={blurResults}
              label="Pages scanned"
              value={`${result.discovery?.followersPagesScanned ?? 0} / ${result.discovery?.followingPagesScanned ?? 0}`}
            />
            {result.activity ? (
              <>
                <Field
                  blurResults={blurResults}
                  label="Posts scanned"
                  value={String(result.activity.postsAnalyzed)}
                />
                <Field
                  blurResults={blurResults}
                  label="Locations"
                  value={String(result.activity.locations.length)}
                />
              </>
            ) : null}
            {profile.biography ? (
              <div className="anya-result-field anya-result-field--block sm:col-span-2 lg:col-span-3">
                <p className="anya-result-label">Biography</p>
                <p className="anya-result-value anya-result-value--block">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={profile.biography}
                  />
                </p>
              </div>
            ) : null}
          </div>
          <div className="border-t border-white/6 px-3 py-2">
            <a
              className="inline-flex items-center gap-1 text-xs text-[var(--anya-blush)] hover:underline"
              href={`https://www.instagram.com/${profile.username}/`}
              rel="noreferrer"
              target="_blank"
            >
              Open profile <ExternalLink className="size-3" />
            </a>
          </div>
        </article>
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
                className="ui-btn ui-btn-ghost"
                disabled={enriching}
                type="button"
                onClick={onEnrichBios}
              >
                {enriching ? "Loading bios…" : "Load bios & rebuild map"}
              </button>
              <p className="text-xs text-zinc-500">
                Pulls bios for mutuals/following to detect schools, orgs, and
                places.
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
            records={leakRecords}
            selectedExportIndex={selectedExportIndex}
            totalCount={result.leaks.count}
            onSelectExportIndex={onSelectExportIndex}
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
