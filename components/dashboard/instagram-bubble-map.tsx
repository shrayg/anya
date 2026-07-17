"use client";

import { useMemo, useState } from "react";

import type {
  BubbleEntity,
  BubblePerson,
  InstagramBubbleMap,
} from "@/lib/instagram-bubble-map";
import { BlurredValue } from "@/components/dashboard/blurred-value";

const KIND_COLOR: Record<BubbleEntity["kind"], string> = {
  close_friends: "#f59e0b",
  tagged_together: "#fbbf24",
  consistent_commenter: "#38bdf8",
  school: "#38bdf8",
  classmate: "#22d3ee",
  family: "#fb7185",
  organization: "#a78bfa",
  place: "#34d399",
  travel: "#10b981",
  following_cluster: "#94a3b8",
  other: "#64748b",
};

const FILTER_LABELS: Record<"all" | BubbleEntity["kind"], string> = {
  all: "All clusters",
  close_friends: "Close friends",
  tagged_together: "Tagged together",
  consistent_commenter: "Commenters",
  family: "Family",
  classmate: "Classmates",
  school: "Schools",
  organization: "Organizations",
  place: "Places",
  travel: "Travel",
  following_cluster: "Following",
  other: "Other",
};

function PersonTooltip({
  person,
  blurResults,
}: {
  person: BubblePerson;
  blurResults?: boolean;
}) {
  return (
    <div className="max-w-xs space-y-1 rounded-xl border border-white/10 bg-zinc-950/95 p-3 text-xs text-zinc-200 shadow-xl">
      <p className="font-medium text-zinc-100">
        <BlurredValue forceBlur={blurResults} text={`@${person.username}`} />
      </p>
      {person.fullName ? (
        <p className="text-zinc-400">
          <BlurredValue forceBlur={blurResults} text={person.fullName} />
        </p>
      ) : null}
      <p className="uppercase tracking-wide text-[10px] text-zinc-500">
        {person.relation}
        {person.isMutual ? " · mutual" : ""}
      </p>
      <p className="text-[11px] text-zinc-400">
        {person.relationship.replaceAll("_", " ")} ·{" "}
        {Math.round(person.confidence * 100)}% confidence
      </p>
      {person.schoolSignals.length > 0 ? (
        <p className="text-[11px] text-sky-200">
          Schools: {person.schoolSignals.slice(0, 3).join(", ")}
          {person.graduationYears.length > 0
            ? ` · ${person.graduationYears.join(", ")}`
            : ""}
        </p>
      ) : null}
      {person.confidenceReasons.length > 0 ? (
        <ul className="space-y-0.5 text-[11px] text-zinc-500">
          {person.confidenceReasons.map((reason) => (
            <li key={reason}>- {reason}</li>
          ))}
        </ul>
      ) : null}
      {person.biography ? (
        <p className="whitespace-pre-wrap text-zinc-300">
          <BlurredValue
            forceBlur={blurResults}
            text={person.biography.slice(0, 220)}
          />
        </p>
      ) : (
        <p className="text-zinc-500">No bio loaded</p>
      )}
    </div>
  );
}

export function InstagramBubbleMapView({
  map,
  blurResults = false,
}: {
  map: InstagramBubbleMap;
  blurResults?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(map.subjectId);
  const [filter, setFilter] = useState<"all" | BubbleEntity["kind"]>("all");

  const selected = useMemo(
    () => map.people.find((person) => person.id === selectedId) ?? null,
    [map.people, selectedId],
  );

  const visibleEntities = useMemo(
    () =>
      filter === "all"
        ? map.entities
        : map.entities.filter((entity) => entity.kind === filter),
    [filter, map.entities],
  );

  const visiblePeople = useMemo(() => {
    if (filter === "all") return map.people;
    const allowed = new Set(
      visibleEntities.flatMap((entity) => entity.userIds),
    );
    allowed.add(map.subjectId);
    return map.people.filter((person) => allowed.has(person.id));
  }, [filter, map.people, map.subjectId, visibleEntities]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          People · {map.stats.peopleAnalyzed}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Bios · {map.stats.biosLoaded}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Mutuals · {map.stats.mutualCount}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Schools · {map.stats.schoolCount}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Family / classmates · {map.stats.likelyFamilyCount}/{map.stats.likelyClassmateCount}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Orgs / places · {map.stats.organizationCount}/{map.stats.placeCount}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Geotags · {map.stats.locationCount ?? 0}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Commenters · {map.stats.consistentCommenterCount ?? 0}
        </div>
      </div>

      {map.insights.length > 0 ? (
        <div className="space-y-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
          {map.insights.map((insight) => (
            <p key={insight}>{insight}</p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            "all",
            "close_friends",
            "tagged_together",
            "consistent_commenter",
            "family",
            "classmate",
            "school",
            "organization",
            "place",
            "travel",
          ] as const
        ).map((kind) => (
          <button
            key={kind}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === kind
                ? "border-anya-accent/50 bg-anya-accent/15 text-zinc-100"
                : "border-white/10 bg-white/5 text-zinc-400"
            }`}
            onClick={() => setFilter(kind)}
            type="button"
          >
            {FILTER_LABELS[kind]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020]">
          <svg className="h-[420px] w-full" viewBox="0 0 960 640">
            {visibleEntities.map((entity) => {
              const members = visiblePeople.filter((person) =>
                entity.userIds.includes(person.id),
              );
              if (members.length === 0) return null;
              const x =
                members.reduce((sum, person) => sum + person.x, 0) /
                members.length;
              const y =
                members.reduce((sum, person) => sum + person.y, 0) /
                members.length;
              const radius = 36 + Math.min(members.length, 10) * 6;
              return (
                <g key={entity.id}>
                  <circle
                    cx={x}
                    cy={y}
                    fill={KIND_COLOR[entity.kind]}
                    fillOpacity={0.08}
                    r={radius}
                    stroke={KIND_COLOR[entity.kind]}
                    strokeOpacity={0.45}
                    strokeWidth={1.5}
                  />
                  <text
                    fill={KIND_COLOR[entity.kind]}
                    fontSize="11"
                    textAnchor="middle"
                    x={x}
                    y={y - radius - 8}
                  >
                    {entity.label.slice(0, 28)}
                  </text>
                </g>
              );
            })}

            {visiblePeople.map((person) => {
              const color =
                person.relation === "subject"
                  ? "#f8fafc"
                  : person.isMutual
                    ? KIND_COLOR.close_friends
                    : person.relation === "following"
                      ? "#60a5fa"
                      : "#94a3b8";
              return (
                <g
                  key={person.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(person.id)}
                >
                  <circle
                    cx={person.x}
                    cy={person.y}
                    fill={color}
                    fillOpacity={selectedId === person.id ? 0.95 : 0.7}
                    r={person.r}
                    stroke="#0b1020"
                    strokeWidth={2}
                  />
                  {person.profilePicUrl ? (
                    <>
                      <defs>
                        <clipPath id={`clip-${person.id}`}>
                          <circle cx={person.x} cy={person.y} r={person.r - 1} />
                        </clipPath>
                      </defs>
                      <image
                        clipPath={`url(#clip-${person.id})`}
                        height={person.r * 2}
                        href={person.profilePicUrl}
                        width={person.r * 2}
                        x={person.x - person.r}
                        y={person.y - person.r}
                      />
                    </>
                  ) : null}
                  <title>@{person.username}</title>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-3">
          {selected ? (
            <PersonTooltip blurResults={blurResults} person={selected} />
          ) : (
            <p className="text-sm text-zinc-500">Select a bubble for details.</p>
          )}

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Clusters
            </p>
            {visibleEntities.slice(0, 12).map((entity) => (
              <button
                key={entity.id}
                className="block w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left"
                onClick={() => setSelectedId(entity.userIds[0] ?? null)}
                type="button"
              >
                <p className="text-sm text-zinc-100">{entity.label}</p>
                <p className="text-[11px] text-zinc-500">
                  {entity.kind.replace("_", " ")} · {entity.userIds.length} people
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
