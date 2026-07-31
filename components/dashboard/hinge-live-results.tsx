"use client";

import { MapPin, UserRound } from "lucide-react";

import type { HingeLiveSearchResult } from "@/lib/hinge-live/types";

function genderLabel(value: number | null): string {
  if (value === 0) return "men";
  if (value === 1) return "women";

  return "default";
}

export function HingeLiveResults({ data }: { data: HingeLiveSearchResult }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
        <p className="font-medium text-white">
          {data.count} profile{data.count === 1 ? "" : "s"} hydrated from{" "}
          {data.subjectCount} recommendation id
          {data.subjectCount === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-xs text-rose-200/80">
          Location {data.applied.lat.toFixed(4)},{data.applied.lon.toFixed(4)}
          {data.applied.locationName ? ` (${data.applied.locationName})` : ""} ·
          age {data.applied.ageMin ?? "—"}–{data.applied.ageMax ?? "—"} ·
          distance{" "}
          {data.applied.distanceMi != null
            ? `${data.applied.distanceMi} mi`
            : "unchanged"}{" "}
          · gender {genderLabel(data.applied.genderPreference)} · pages{" "}
          {data.applied.pages} · location{" "}
          {data.applied.locationUpdated ? "updated" : "skipped"} · preferences{" "}
          {data.applied.preferencesUpdated ? "updated" : "skipped"}
          {data.applied.keyword ? ` · filter “${data.applied.keyword}”` : ""}
        </p>
        <p className="mt-2 text-[11px] text-rose-200/70">
          Session recommendation feed — not a full area database dump.
        </p>
      </div>

      {data.profiles.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No profiles returned. Try a different location, widen age/distance, or
          clear the keyword filter.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.profiles.map((profile) => {
            const hero = profile.photos[0]?.url;
            const prompt = profile.answers.find((a) => a.response)?.response;

            return (
              <li
                key={profile.userId}
                className="overflow-hidden rounded-xl border border-white/10 bg-black/35"
              >
                <div className="relative aspect-[4/5] bg-zinc-900">
                  {hero ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={profile.firstName ?? "Hinge profile"}
                      className="size-full object-cover"
                      src={hero}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-600">
                      <UserRound className="size-10" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {profile.firstName ?? "Unknown"}
                      {profile.age != null ? `, ${profile.age}` : ""}
                    </h3>
                    {profile.selfieVerified ? (
                      <span className="shrink-0 font-mono text-[10px] text-emerald-400/80">
                        verified
                      </span>
                    ) : null}
                  </div>
                  {profile.location ? (
                    <p className="flex items-center gap-1 text-xs text-zinc-500">
                      <MapPin className="size-3" />
                      {profile.location}
                    </p>
                  ) : null}
                  {profile.jobTitle || profile.educations[0] ? (
                    <p className="truncate text-xs text-zinc-500">
                      {[profile.jobTitle, profile.educations[0]]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {prompt ? (
                    <p className="line-clamp-3 text-xs leading-5 text-zinc-400">
                      {prompt}
                    </p>
                  ) : null}
                  <p className="font-mono text-[10px] text-zinc-600">
                    id {profile.userId.slice(0, 12)}…
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
