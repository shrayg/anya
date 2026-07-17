"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  forceCenter,
  forceCollide,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";

import type {
  BubbleEntity,
  BubblePerson,
  InstagramBubbleMap,
} from "@/lib/instagram-bubble-map";
import { BlurredValue } from "@/components/dashboard/blurred-value";

type ClusterKey =
  | "subject"
  | "close_friends"
  | "tagged_together"
  | "consistent_commenter"
  | "family"
  | "classmate"
  | "school"
  | "organization"
  | "place"
  | "following_cluster"
  | "other";

const CLUSTER_COLOR: Record<ClusterKey, string> = {
  subject: "#f8fafc",
  close_friends: "#f59e0b",
  tagged_together: "#fbbf24",
  consistent_commenter: "#38bdf8",
  family: "#fb7185",
  classmate: "#22d3ee",
  school: "#60a5fa",
  organization: "#a78bfa",
  place: "#34d399",
  following_cluster: "#94a3b8",
  other: "#64748b",
};

const CLUSTER_LABEL: Record<ClusterKey, string> = {
  subject: "You",
  close_friends: "Close friends / mutuals",
  tagged_together: "Tagged together",
  consistent_commenter: "Consistent commenters",
  family: "Family",
  classmate: "Classmates",
  school: "Schools",
  organization: "Organizations",
  place: "Places",
  following_cluster: "Following (one-way)",
  other: "Other",
};

// Order used to place cluster anchors evenly around the subject.
const CLUSTER_ORDER: ClusterKey[] = [
  "close_friends",
  "tagged_together",
  "consistent_commenter",
  "family",
  "classmate",
  "school",
  "organization",
  "place",
  "following_cluster",
  "other",
];

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

const WIDTH = 1000;
const HEIGHT = 680;

type SimNode = {
  id: string;
  person: BubblePerson;
  cluster: ClusterKey;
  radius: number;
  color: string;
  // populated by d3-force
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};

function clusterForPerson(person: BubblePerson): ClusterKey {
  if (person.relation === "subject") return "subject";
  const has = (kind: string) =>
    person.entities.some((entityId) => entityId.startsWith(`${kind}:`));

  if (person.isMutual || person.relationship === "close_friend") {
    return "close_friends";
  }
  if (has("tagged_together")) return "tagged_together";
  if (has("consistent_commenter")) return "consistent_commenter";
  if (person.relationship === "likely_family" || has("family")) return "family";
  if (person.relationship === "likely_classmate" || has("classmate")) {
    return "classmate";
  }
  if (has("school")) return "school";
  if (has("organization")) return "organization";
  if (has("place")) return "place";
  if (person.relation === "following") return "following_cluster";
  return "other";
}

function radiusForPerson(person: BubblePerson): number {
  if (person.relation === "subject") return 40;
  const base = person.isMutual ? 20 : person.relation === "following" ? 15 : 12;
  return base + Math.round(person.confidence * 12);
}

function PersonDetails({
  person,
  cluster,
  blurResults,
}: {
  person: BubblePerson;
  cluster: ClusterKey;
  blurResults?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-zinc-950/80 p-3 text-xs text-zinc-200">
      <div className="flex items-center gap-3">
        {person.profilePicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-11 rounded-full border border-white/10 object-cover"
            src={person.profilePicUrl}
          />
        ) : (
          <div
            className="flex size-11 items-center justify-center rounded-full border border-white/10 text-[10px]"
            style={{ background: `${CLUSTER_COLOR[cluster]}22` }}
          >
            IG
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-zinc-100">
            <BlurredValue forceBlur={blurResults} text={`@${person.username}`} />
          </p>
          {person.fullName ? (
            <p className="truncate text-zinc-400">
              <BlurredValue forceBlur={blurResults} text={person.fullName} />
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
          style={{
            background: `${CLUSTER_COLOR[cluster]}22`,
            color: CLUSTER_COLOR[cluster],
          }}
        >
          {CLUSTER_LABEL[cluster]}
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
          {person.relation}
          {person.isMutual ? " · mutual" : ""}
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
          {Math.round(person.confidence * 100)}% confidence
        </span>
      </div>

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
            text={person.biography.slice(0, 240)}
          />
        </p>
      ) : (
        <p className="text-zinc-500">No bio loaded</p>
      )}

      <a
        className="inline-block text-anya-accent hover:underline"
        href={`https://www.instagram.com/${person.username}/`}
        rel="noreferrer"
        target="_blank"
      >
        Open profile →
      </a>
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
  const [filter, setFilter] = useState<"all" | BubbleEntity["kind"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(map.subjectId);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // View transform (pan + zoom).
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  // Which clusters are present, for filter buttons + anchor layout.
  const presentClusters = useMemo(() => {
    const set = new Set<ClusterKey>();
    for (const person of map.people) set.add(clusterForPerson(person));
    set.delete("subject");
    return CLUSTER_ORDER.filter((cluster) => set.has(cluster));
  }, [map.people]);

  const clusterAnchors = useMemo(() => {
    const anchors = new Map<ClusterKey, { x: number; y: number }>();
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const ringRadius = Math.min(WIDTH, HEIGHT) * 0.34;
    presentClusters.forEach((cluster, index) => {
      const angle =
        (index / Math.max(presentClusters.length, 1)) * Math.PI * 2 -
        Math.PI / 2;
      anchors.set(cluster, {
        x: cx + Math.cos(angle) * ringRadius,
        y: cy + Math.sin(angle) * ringRadius,
      });
    });
    anchors.set("subject", { x: cx, y: cy });
    return anchors;
  }, [presentClusters]);

  const filteredPeople = useMemo(() => {
    if (filter === "all") return map.people;
    return map.people.filter((person) => {
      if (person.relation === "subject") return true;
      const cluster = clusterForPerson(person);
      // Map the filter (which uses BubbleEntity kinds) onto cluster keys.
      return cluster === filter;
    });
  }, [filter, map.people]);

  // Build simulation nodes whenever the visible people change.
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    const simNodes: SimNode[] = filteredPeople.map((person) => {
      const cluster = clusterForPerson(person);
      const anchor = clusterAnchors.get(cluster) ?? { x: cx, y: cy };
      const isSubject = person.relation === "subject";
      return {
        id: person.id,
        person,
        cluster,
        radius: radiusForPerson(person),
        color: isSubject ? CLUSTER_COLOR.subject : CLUSTER_COLOR[cluster],
        // Seed near the cluster anchor so the sim settles fast + fluid.
        x: isSubject ? cx : anchor.x + (Math.random() - 0.5) * 120,
        y: isSubject ? cy : anchor.y + (Math.random() - 0.5) * 120,
        fx: isSubject ? cx : null,
        fy: isSubject ? cy : null,
      };
    });

    const simulation = forceSimulation<SimNode>(simNodes)
      .force("charge", forceManyBody<SimNode>().strength(-38))
      .force(
        "x",
        forceX<SimNode>(
          (node) => (clusterAnchors.get(node.cluster) ?? { x: cx }).x,
        ).strength(0.12),
      )
      .force(
        "y",
        forceY<SimNode>(
          (node) => (clusterAnchors.get(node.cluster) ?? { y: cy }).y,
        ).strength(0.12),
      )
      .force("center", forceCenter(cx, cy).strength(0.02))
      .force(
        "collide",
        forceCollide<SimNode>((node) => node.radius + 3)
          .strength(0.9)
          .iterations(2),
      )
      .alpha(1)
      .alphaDecay(0.028);

    simRef.current = simulation;

    // Drive React updates from the simulation for a fluid settle animation.
    const render = () => {
      setNodes([...simulation.nodes()]);
      if (simulation.alpha() > 0.02) {
        frameRef.current = requestAnimationFrame(render);
      }
    };
    frameRef.current = requestAnimationFrame(render);

    return () => {
      simulation.stop();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [filteredPeople, clusterAnchors]);

  const clusterCentroids = useMemo(() => {
    const groups = new Map<
      ClusterKey,
      { x: number; y: number; count: number; maxR: number }
    >();
    for (const node of nodes) {
      if (node.cluster === "subject") continue;
      const group = groups.get(node.cluster) ?? {
        x: 0,
        y: 0,
        count: 0,
        maxR: 0,
      };
      group.x += node.x;
      group.y += node.y;
      group.count += 1;
      group.maxR = Math.max(group.maxR, node.radius);
      groups.set(node.cluster, group);
    }
    return [...groups.entries()].map(([cluster, group]) => ({
      cluster,
      x: group.x / group.count,
      y: group.y / group.count,
      count: group.count,
    }));
  }, [nodes]);

  const subjectNode = useMemo(
    () => nodes.find((node) => node.cluster === "subject") ?? null,
    [nodes],
  );

  const selected = useMemo(
    () => map.people.find((person) => person.id === selectedId) ?? null,
    [map.people, selectedId],
  );

  // ---- Zoom + pan handlers ----
  const clampScale = (k: number) => Math.min(4, Math.max(0.35, k));

  const handleWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Pointer position in SVG viewBox coordinates.
    const px = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const py = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    setTransform((prev) => {
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const k = clampScale(prev.k * factor);
      // Keep the point under the cursor stationary while zooming.
      const x = px - ((px - prev.x) / prev.k) * k;
      const y = py - ((py - prev.y) / prev.k) * k;
      return { k, x, y };
    });
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      dragState.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: transform.x,
        originY: transform.y,
        moved: false,
      };
      svgRef.current?.setPointerCapture(event.pointerId);
    },
    [transform.x, transform.y],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragState.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = WIDTH / rect.width;
      const scaleY = HEIGHT / rect.height;
      const dx = (event.clientX - drag.startX) * scaleX;
      const dy = (event.clientY - drag.startY) * scaleY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      setTransform((prev) => ({
        ...prev,
        x: drag.originX + dx,
        y: drag.originY + dy,
      }));
    },
    [],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragState.current;
      dragState.current = null;
      if (drag) svgRef.current?.releasePointerCapture(event.pointerId);
    },
    [],
  );

  const zoomBy = (factor: number) => {
    setTransform((prev) => {
      const k = clampScale(prev.k * factor);
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      const x = cx - ((cx - prev.x) / prev.k) * k;
      const y = cy - ((cy - prev.y) / prev.k) * k;
      return { k, x, y };
    });
  };

  const resetView = () => setTransform({ k: 1, x: 0, y: 0 });

  const focusPerson = (id: string) => {
    setSelectedId(id);
    const node = nodes.find((entry) => entry.id === id);
    if (!node) return;
    setTransform(() => {
      const k = 1.8;
      return {
        k,
        x: WIDTH / 2 - node.x * k,
        y: HEIGHT / 2 - node.y * k,
      };
    });
  };

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
          Close friends · {map.stats.closeFriendCount}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          Geotags · {map.stats.locationCount ?? 0}
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
        {(["all", ...presentClusters] as Array<"all" | ClusterKey>).map(
          (kind) => (
            <button
              key={kind}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                filter === kind
                  ? "border-anya-accent/50 bg-anya-accent/15 text-zinc-100"
                  : "border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
              }`}
              onClick={() => setFilter(kind as "all" | BubbleEntity["kind"])}
              type="button"
            >
              {kind === "all"
                ? FILTER_LABELS.all
                : CLUSTER_LABEL[kind as ClusterKey]}
            </button>
          ),
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_40%,#131a2e_0%,#0a0e1a_70%)]">
          {/* Zoom controls */}
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
            <button
              className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/80 text-lg text-zinc-200 hover:bg-zinc-800"
              onClick={() => zoomBy(1.25)}
              type="button"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/80 text-lg text-zinc-200 hover:bg-zinc-800"
              onClick={() => zoomBy(1 / 1.25)}
              type="button"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/80 text-[10px] text-zinc-300 hover:bg-zinc-800"
              onClick={resetView}
              type="button"
              aria-label="Reset view"
            >
              fit
            </button>
          </div>

          <p className="pointer-events-none absolute left-3 top-3 z-10 text-[11px] text-zinc-500">
            Scroll to zoom · drag to pan · click a bubble to focus
          </p>

          <svg
            ref={svgRef}
            className="h-[560px] w-full touch-none select-none"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ cursor: dragState.current ? "grabbing" : "grab" }}
          >
            <g
              transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
            >
              {/* Cluster halos */}
              {clusterCentroids.map((centroid) => (
                <g key={`halo-${centroid.cluster}`}>
                  <circle
                    cx={centroid.x}
                    cy={centroid.y}
                    r={46 + Math.min(centroid.count, 40) * 6}
                    fill={CLUSTER_COLOR[centroid.cluster]}
                    fillOpacity={0.05}
                    stroke={CLUSTER_COLOR[centroid.cluster]}
                    strokeOpacity={0.18}
                    strokeWidth={1}
                  />
                  <text
                    x={centroid.x}
                    y={centroid.y - (46 + Math.min(centroid.count, 40) * 6) - 6}
                    textAnchor="middle"
                    fill={CLUSTER_COLOR[centroid.cluster]}
                    fillOpacity={0.8}
                    fontSize={13}
                  >
                    {CLUSTER_LABEL[centroid.cluster]} · {centroid.count}
                  </text>
                </g>
              ))}

              {/* Spokes from subject to mutuals/close friends */}
              {subjectNode
                ? nodes
                    .filter(
                      (node) =>
                        node.cluster === "close_friends" ||
                        node.cluster === "tagged_together",
                    )
                    .map((node) => (
                      <line
                        key={`link-${node.id}`}
                        x1={subjectNode.x}
                        y1={subjectNode.y}
                        x2={node.x}
                        y2={node.y}
                        stroke={node.color}
                        strokeOpacity={
                          hoverId === node.id || selectedId === node.id
                            ? 0.55
                            : 0.12
                        }
                        strokeWidth={0.8}
                      />
                    ))
                : null}

              {/* Person bubbles */}
              {nodes.map((node) => {
                const isActive =
                  selectedId === node.id || hoverId === node.id;
                const clipId = `bubble-clip-${node.id}`;
                return (
                  <g
                    key={node.id}
                    className="cursor-pointer"
                    onClick={() => {
                      if (dragState.current?.moved) return;
                      focusPerson(node.id);
                    }}
                    onPointerEnter={() => setHoverId(node.id)}
                    onPointerLeave={() =>
                      setHoverId((prev) => (prev === node.id ? null : prev))
                    }
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.radius}
                      fill={node.color}
                      fillOpacity={
                        node.cluster === "subject"
                          ? 1
                          : isActive
                            ? 0.95
                            : 0.55
                      }
                      stroke={isActive ? "#ffffff" : "#0a0e1a"}
                      strokeWidth={isActive ? 2.5 : 1.5}
                    />
                    {node.person.profilePicUrl ? (
                      <>
                        <defs>
                          <clipPath id={clipId}>
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={node.radius - 1.5}
                            />
                          </clipPath>
                        </defs>
                        <image
                          clipPath={`url(#${clipId})`}
                          href={node.person.profilePicUrl}
                          x={node.x - node.radius}
                          y={node.y - node.radius}
                          width={node.radius * 2}
                          height={node.radius * 2}
                          preserveAspectRatio="xMidYMid slice"
                          opacity={isActive ? 1 : 0.85}
                        />
                      </>
                    ) : null}
                    {node.radius >= 18 || isActive ? (
                      <text
                        x={node.x}
                        y={node.y + node.radius + 11}
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize={Math.max(9, 11 / transform.k)}
                        opacity={isActive ? 1 : 0.7}
                      >
                        @{node.person.username.slice(0, 16)}
                      </text>
                    ) : null}
                    <title>@{node.person.username}</title>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="space-y-3">
          {selected ? (
            <PersonDetails
              blurResults={blurResults}
              cluster={clusterForPerson(selected)}
              person={selected}
            />
          ) : (
            <p className="text-sm text-zinc-500">Select a bubble for details.</p>
          )}

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Clusters
            </p>
            {clusterCentroids
              .sort((a, b) => b.count - a.count)
              .map((centroid) => (
                <button
                  key={centroid.cluster}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06]"
                  onClick={() => setFilter(centroid.cluster as never)}
                  type="button"
                >
                  <span className="flex items-center gap-2 text-sm text-zinc-100">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ background: CLUSTER_COLOR[centroid.cluster] }}
                    />
                    {CLUSTER_LABEL[centroid.cluster]}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {centroid.count}
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
