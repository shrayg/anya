"use client";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import clsx from "clsx";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";

import type { ModuleCatalogSection } from "@/components/module-catalog";
import {
  SEARCH_AUTOFILL_SHIELD,
  unlockAutofillShield,
} from "@/lib/search-autofill-shield";

type HubData = { count: number; lanes: number };
type LaneData = { title: string; count: number; featured?: boolean };
type ModuleData = { name: string; slug: string; hint: string; lane: string };

type ExplorerNode =
  | Node<HubData, "hub">
  | Node<LaneData, "lane">
  | Node<ModuleData, "module">;

const LANE_ACCENTS = [
  "#c3d3e6",
  "#86efac",
  "#fbbf24",
  "#fda4af",
  "#93c5fd",
  "#a3e635",
  "#f0abfc",
  "#67e8f9",
  "#fdba74",
  "#e7e5e4",
];

function HubNode({ data }: NodeProps<Node<HubData, "hub">>) {
  return (
    <div className="mod-graph-hub">
      <Handle className="!opacity-0" position={Position.Top} type="source" />
      <Handle className="!opacity-0" position={Position.Right} type="source" />
      <Handle className="!opacity-0" position={Position.Bottom} type="source" />
      <Handle className="!opacity-0" position={Position.Left} type="source" />
      <strong>{data.count}</strong>
      <span>modules</span>
      <small>{data.lanes} lanes</small>
    </div>
  );
}

function LaneNode({ data }: NodeProps<Node<LaneData, "lane">>) {
  return (
    <div className={clsx("mod-graph-lane", data.featured && "is-featured")}>
      <Handle className="!opacity-0" position={Position.Left} type="target" />
      <Handle className="!opacity-0" position={Position.Right} type="source" />
      <p>{data.title}</p>
      <span>{data.count}</span>
    </div>
  );
}

function ModuleNode({ data }: NodeProps<Node<ModuleData, "module">>) {
  return (
    <div className="mod-graph-module" title={data.hint}>
      <Handle className="!opacity-0" position={Position.Left} type="target" />
      <span>{data.name}</span>
    </div>
  );
}

const nodeTypes = {
  hub: memo(HubNode),
  lane: memo(LaneNode),
  module: memo(ModuleNode),
};

function buildGraph(sections: ModuleCatalogSection[]): {
  nodes: ExplorerNode[];
  edges: Edge[];
} {
  const nodes: ExplorerNode[] = [];
  const edges: Edge[] = [];
  const capabilityTotal = sections.reduce(
    (sum, section) =>
      sum +
      section.items.reduce(
        (laneSum, item) => laneSum + 1 + (item.toolCount ?? 0),
        0,
      ),
    0,
  );

  const centerX = 0;
  const centerY = 0;
  const laneCount = Math.max(sections.length, 1);
  const radius = Math.max(200, 80 + laneCount * 16);

  nodes.push({
    id: "hub",
    type: "hub",
    position: { x: centerX - 44, y: centerY - 44 },
    data: { count: capabilityTotal, lanes: sections.length },
    draggable: false,
    selectable: false,
  });

  sections.forEach((section, index) => {
    const angle = (index / laneCount) * Math.PI * 2 - Math.PI / 2;
    const laneX = centerX + Math.cos(angle) * radius;
    const laneY = centerY + Math.sin(angle) * radius;
    const laneId = `lane-${index}`;
    const accent = LANE_ACCENTS[index % LANE_ACCENTS.length];

    nodes.push({
      id: laneId,
      type: "lane",
      position: { x: laneX - 70, y: laneY - 18 },
      data: {
        title: section.title,
        count: section.items.reduce(
          (sum, item) => sum + 1 + (item.toolCount ?? 0),
          0,
        ),
        featured: section.featured,
      },
      draggable: false,
      style: { ["--lane-accent" as string]: accent },
    });

    edges.push({
      id: `e-hub-${laneId}`,
      source: "hub",
      target: laneId,
      style: { stroke: `${accent}55`, strokeWidth: 1.25 },
    });

    const cols = section.items.length > 8 ? 3 : section.items.length > 4 ? 2 : 1;
    const outwardX = Math.cos(angle);
    const outwardY = Math.sin(angle);
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);
    const clusterDepth = 72;
    const cellW = 102;
    const cellH = 32;

    section.items.forEach((item, itemIndex) => {
      const col = itemIndex % cols;
      const row = Math.floor(itemIndex / cols);
      const localX = (col - (cols - 1) / 2) * cellW;
      const localY = row * cellH;
      const mx =
        laneX +
        outwardX * clusterDepth +
        tangentX * localX +
        outwardX * localY * 0.12;
      const my =
        laneY +
        outwardY * clusterDepth +
        tangentY * localX +
        outwardY * localY * 0.12;
      const moduleId = `mod-${index}-${item.slug}`;

      nodes.push({
        id: moduleId,
        type: "module",
        position: { x: mx - 48, y: my - 12 },
        data: {
          name: item.name,
          slug: item.slug,
          hint: item.hint,
          lane: section.title,
        },
        draggable: false,
      });

      edges.push({
        id: `e-${laneId}-${moduleId}`,
        source: laneId,
        target: moduleId,
        style: { stroke: `${accent}30`, strokeWidth: 1 },
      });
    });
  });

  return { nodes, edges };
}

function FitViewOnChange({ revision }: { revision: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const id = window.setTimeout(() => {
      fitView({ padding: 0.16, duration: 220 });
    }, 40);
    return () => window.clearTimeout(id);
  }, [fitView, revision]);

  return null;
}

function ModuleGraphCanvas({
  sections,
  activeLane,
  setActiveLane,
}: {
  sections: ModuleCatalogSection[];
  activeLane: string | null;
  setActiveLane: (lane: string | null) => void;
}) {
  const router = useRouter();
  const [hoverHint, setHoverHint] = useState<string | null>(null);

  const focused = useMemo(() => {
    if (!activeLane) return sections;
    return sections.filter((section) => section.title === activeLane);
  }, [activeLane, sections]);

  const graph = useMemo(() => buildGraph(focused), [focused]);
  const revision = useMemo(
    () =>
      `${activeLane ?? "all"}:${focused.map((s) => `${s.title}:${s.items.length}`).join("|")}`,
    [activeLane, focused],
  );

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: Node) => {
      if (node.type === "module") {
        const slug = (node.data as ModuleData).slug;
        if (slug) router.push(`/dashboard/search/${slug}`);
        return;
      }
      if (node.type === "lane") {
        const title = (node.data as LaneData).title;
        setActiveLane(activeLane === title ? null : title);
      }
      if (node.type === "hub") {
        setActiveLane(null);
      }
    },
    [activeLane, router, setActiveLane],
  );

  const onNodeMouseEnter = useCallback((_event: MouseEvent, node: Node) => {
    if (node.type === "module") {
      const data = node.data as ModuleData;
      setHoverHint(`${data.name} — ${data.hint}`);
      return;
    }
    if (node.type === "lane") {
      const data = node.data as LaneData;
      setHoverHint(`${data.title} · ${data.count} modules — click to focus`);
    }
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoverHint(null);
  }, []);

  return (
    <>
      <div className="mod-graph-canvas">
        <ReactFlow
          fitView
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          zoomOnScroll
          minZoom={0.35}
          maxZoom={1.6}
          fitViewOptions={{ padding: 0.16 }}
          proOptions={{ hideAttribution: true }}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          defaultEdgeOptions={{ animated: false }}
        >
          <FitViewOnChange revision={revision} />
          <Background color="#ffffff08" gap={22} size={1} />
          <Controls
            showInteractive={false}
            className="!border-white/10 !bg-zinc-950/90 !shadow-xl [&>button]:!border-white/10 [&>button]:!bg-zinc-900 [&>button]:!text-white"
          />
        </ReactFlow>
      </div>
      <div className="mod-graph-footer">
        <p>
          {hoverHint ??
            "Click a module to open it · click a lane to focus · scroll to zoom"}
        </p>
      </div>
    </>
  );
}

export function ModuleGraphExplorer({
  sections,
}: {
  sections: ModuleCatalogSection[];
}) {
  const [filter, setFilter] = useState("");
  const [activeLane, setActiveLane] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return sections;

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.hint.toLowerCase().includes(q) ||
            section.title.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [filter, sections]);

  const capabilityCount = (items: ModuleCatalogSection["items"]) =>
    items.reduce((sum, item) => sum + 1 + (item.toolCount ?? 0), 0);

  const visibleCount = filtered.reduce(
    (sum, section) => sum + capabilityCount(section.items),
    0,
  );

  return (
    <div className="mod-graph">
      <div className="mod-graph-toolbar">
        <label className="mod-graph-search" htmlFor="module-graph-filter">
          <Search className="size-3.5 text-zinc-500" />
          <input
            {...SEARCH_AUTOFILL_SHIELD}
            id="module-graph-filter"
            name="module-graph-filter"
            onChange={(event) => setFilter(event.target.value)}
            onFocus={unlockAutofillShield}
            placeholder="Filter modules…"
            readOnly
            type="text"
            value={filter}
          />
        </label>

        <div
          className="mod-graph-lanes"
          role="tablist"
          aria-label="Module lanes"
        >
          <button
            className={clsx("mod-graph-chip", !activeLane && "is-active")}
            type="button"
            onClick={() => setActiveLane(null)}
          >
            All
          </button>
          {sections.map((section) => (
            <button
              key={section.title}
              className={clsx(
                "mod-graph-chip",
                activeLane === section.title && "is-active",
              )}
              type="button"
              onClick={() =>
                setActiveLane((current) =>
                  current === section.title ? null : section.title,
                )
              }
            >
              {section.title}
              <em>{capabilityCount(section.items)}</em>
            </button>
          ))}
        </div>

        <p className="mod-graph-count">{visibleCount} shown</p>
      </div>

      <ReactFlowProvider>
        <ModuleGraphCanvas
          activeLane={activeLane}
          sections={filtered}
          setActiveLane={setActiveLane}
        />
      </ReactFlowProvider>
    </div>
  );
}
