"use client";

import type { InstagramActivityGraph } from "@/lib/instagram-activity";

import { ExternalLink, MapPin, MessageCircle, Users } from "lucide-react";

import { BlurredValue } from "@/components/dashboard/blurred-value";

export function InstagramActivityPanel({
  activity,
  blurResults = false,
}: {
  activity: InstagramActivityGraph;
  blurResults?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Own posts · {activity.postsAnalyzed}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Tagged posts · {activity.taggedPostsAnalyzed}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Comments scanned · {activity.commentsScanned}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Locations · {activity.locations.length}
        </div>
      </div>

      {activity.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {activity.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <MapPin className="size-4 text-emerald-300" />
          Places visited
        </div>
        {activity.locations.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No geotags found on the scanned posts/tagged posts.
          </p>
        ) : (
          <div className="space-y-2">
            {activity.locations.slice(0, 25).map((visit) => (
              <div
                key={`${visit.location.name}-${visit.lastSeenAt}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <p className="text-sm text-zinc-100">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={visit.location.name}
                  />
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  First {visit.firstSeenIso.slice(0, 10) || "?"} · Last{" "}
                  {visit.lastSeenIso.slice(0, 10) || "?"} · {visit.visitCount}{" "}
                  post
                  {visit.visitCount === 1 ? "" : "s"} ·{" "}
                  {visit.sources.join("/")}
                </p>
                {typeof visit.location.lat === "number" &&
                typeof visit.location.lng === "number" ? (
                  <p className="text-[11px] text-zinc-600">
                    {visit.location.lat.toFixed(4)},{" "}
                    {visit.location.lng.toFixed(4)}
                  </p>
                ) : null}
                {visit.postUrls[0] ? (
                  <a
                    className="mt-1 inline-flex items-center gap-1 text-xs text-anya-accent hover:underline"
                    href={visit.postUrls[0]}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open post <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <MessageCircle className="size-4 text-sky-300" />
          Consistent commenters
        </div>
        {activity.consistentCommenters.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No repeat commenters found in the scanned posts.
          </p>
        ) : (
          <div className="space-y-2">
            {activity.consistentCommenters.slice(0, 20).map((entry) => (
              <div
                key={entry.account.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-100">
                      <BlurredValue
                        forceBlur={blurResults}
                        text={`@${entry.account.username}`}
                      />
                    </p>
                    <p className="text-xs text-zinc-500">
                      {entry.postCount} posts · {entry.commentCount} comments ·
                      score {entry.consistencyScore}
                    </p>
                  </div>
                  <a
                    className="text-xs text-anya-accent hover:underline"
                    href={`https://www.instagram.com/${entry.account.username}/`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open
                  </a>
                </div>
                {entry.sampleComments[0] ? (
                  <p className="mt-1 text-xs text-zinc-400">
                    <BlurredValue
                      forceBlur={blurResults}
                      text={`"${entry.sampleComments[0]}"`}
                    />
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-zinc-200">
          <Users className="size-4 text-amber-300" />
          Close-friend candidates from activity
        </div>
        {activity.closeFriendCandidates.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No strong tag/comment close-friend candidates yet.
          </p>
        ) : (
          <div className="space-y-2">
            {activity.closeFriendCandidates.slice(0, 20).map((entry) => (
              <div
                key={entry.account.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <p className="text-sm text-zinc-100">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`@${entry.account.username}`}
                  />{" "}
                  <span className="text-xs text-zinc-500">
                    score {entry.score}
                  </span>
                </p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-500">
                  {entry.reasons.map((reason) => (
                    <li key={reason}>- {reason}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
