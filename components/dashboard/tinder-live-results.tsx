"use client";

import { MapPin, UserRound } from "lucide-react";

import type { TinderLiveSearchResult } from "@/lib/tinder-live/types";

function genderLabel(value: number | null): string {
  if (value === 0) return "men";
  if (value === 1) return "women";
  if (value === -1) return "everyone";

  return "unchanged";
}

export function TinderLiveResults({ data }: { data: TinderLiveSearchResult }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
        <p className="font-medium text-white">
          {data.count} recommendation{data.count === 1 ? "" : "s"} from operator
          session
        </p>
        <p className="mt-1 text-xs text-indigo-200/80">
          Passport {data.applied.lat.toFixed(4)},{data.applied.lon.toFixed(4)} ·
          age {data.applied.ageMin ?? "—"}–{data.applied.ageMax ?? "—"} ·
          distance{" "}
          {data.applied.distanceKm != null
            ? `${data.applied.distanceKm} km`
            : "unchanged"}{" "}
          · gender {genderLabel(data.applied.genderFilter)} · location{" "}
          {data.applied.locationUpdated ? "updated" : "skipped"} · preferences{" "}
          {data.applied.preferencesUpdated ? "updated" : "skipped"}
        </p>
      </div>

      {data.profiles.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No profiles returned. Try a different Passport location or widen age /
          distance filters.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.profiles.map((profile) => {
            const hero = profile.photos[0]?.url;

            return (
              <li
                key={profile.userId}
                className="overflow-hidden rounded-xl border border-white/10 bg-black/35"
              >
                <div className="relative aspect-[4/5] bg-zinc-900">
                  {hero ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={profile.name ?? "Tinder profile"}
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
                      {profile.name ?? "Unknown"}
                      {profile.age != null ? `, ${profile.age}` : ""}
                    </h3>
                    {profile.distanceMi != null ? (
                      <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                        {profile.distanceMi} mi
                      </span>
                    ) : null}
                  </div>
                  {profile.city ? (
                    <p className="flex items-center gap-1 text-xs text-zinc-500">
                      <MapPin className="size-3" />
                      {profile.city}
                    </p>
                  ) : null}
                  {profile.bio ? (
                    <p className="line-clamp-3 text-xs leading-5 text-zinc-400">
                      {profile.bio}
                    </p>
                  ) : null}
                  <p className="font-mono text-[10px] text-zinc-600">
                    id {profile.userId.slice(0, 10)}…
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
