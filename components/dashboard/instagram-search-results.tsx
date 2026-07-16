"use client";

import { useMemo, useState } from "react";
import { ExternalLink, ShieldCheck, Users } from "lucide-react";
import clsx from "clsx";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import type { InstagramSearchResult } from "@/lib/instagram-search";
import { formatSearchRecords } from "@/lib/search-utils";

type InstagramTab = "profile" | "followers" | "following" | "leaks";

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

export function InstagramSearchResults({
  result,
  blurResults = false,
  selectedExportIndex = null,
  onSelectExportIndex,
}: {
  result: InstagramSearchResult;
  blurResults?: boolean;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
}) {
  const [tab, setTab] = useState<InstagramTab>("profile");

  const leakRecords = useMemo(
    () => formatSearchRecords(result.leaks.results),
    [result.leaks.results],
  );

  const tabs: Array<{ id: InstagramTab; label: string; count?: number }> = [
    { id: "profile", label: "Profile" },
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
              {profile.category ? (
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {profile.category}
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
                  label="Posts"
                  value={profile.postsCount.toLocaleString()}
                />
                <StatPill label="Auth mode" value={result.authMode} />
              </div>
            </div>
          </div>

          {profile.biography ? (
            <p className="whitespace-pre-wrap text-sm text-zinc-300">
              <BlurredValue forceBlur={blurResults} text={profile.biography} />
            </p>
          ) : null}

          <div className="grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
            {profile.externalUrl ? (
              <p>
                <span className="text-zinc-500">Link · </span>
                <a
                  className="text-anya-accent hover:underline"
                  href={profile.externalUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {profile.externalUrl}
                </a>
              </p>
            ) : null}
            {profile.businessEmail ? (
              <p>
                <span className="text-zinc-500">Email · </span>
                <BlurredValue forceBlur={blurResults} text={profile.businessEmail} />
              </p>
            ) : null}
            {profile.businessPhone ? (
              <p>
                <span className="text-zinc-500">Phone · </span>
                <BlurredValue forceBlur={blurResults} text={profile.businessPhone} />
              </p>
            ) : null}
          </div>

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
