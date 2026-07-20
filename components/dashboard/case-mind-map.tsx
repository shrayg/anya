"use client";

import { memo, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  buildCaseMindMap,
  type CaseWithSearches,
  type MindMapNodeData,
} from "@/lib/case-mind-map";

function IntelNode({ data }: NodeProps<Node<MindMapNodeData>>) {
  const accent = data.accent || "#a78bfa";

  return (
    <div
      className="max-w-[220px] rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md transition hover:scale-[1.02]"
      style={{
        borderColor: `${accent}55`,
        background: `linear-gradient(145deg, ${accent}18, rgba(8,8,12,0.92))`,
        boxShadow: `0 8px 32px ${accent}22`,
      }}
    >
      <Handle
        className="!border-violet-400 !bg-violet-300"
        position={Position.Top}
        type="target"
      />
      <p
        className="text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: accent }}
      >
        {data.kind === "center"
          ? "Case"
          : data.kind === "search"
            ? "Search"
            : data.kind === "field"
              ? "Profile"
              : "Intel"}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-white">
        {data.label}
      </p>
      {data.sublabel && (
        <p className="mt-1 break-all text-xs leading-relaxed text-zinc-400">
          {data.sublabel}
        </p>
      )}
      <Handle
        className="!border-teal-400 !bg-teal-300"
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
}

const nodeTypes = { intelNode: memo(IntelNode) };

export function CaseMindMap({ caseRecord }: { caseRecord: CaseWithSearches }) {
  const graph = useMemo(() => buildCaseMindMap(caseRecord), [caseRecord]);

  if (
    graph.nodes.length <= 1 &&
    !caseRecord.email &&
    !caseRecord.phone &&
    !caseRecord.username
  ) {
    return (
      <div className="flex h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed border-violet-500/25 bg-black/20 text-center">
        <p className="text-lg font-medium text-white">Mind map is empty</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">
          Add past searches to this case to visualize connections and intel
          nodes.
        </p>
      </div>
    );
  }

  return (
    <div className="case-mind-map h-[560px] overflow-hidden">
      <ReactFlow
        fitView
        defaultEdgeOptions={{
          style: { stroke: "#ff4fa3", strokeWidth: 1.5 },
          animated: false,
        }}
        edges={graph.edges}
        fitViewOptions={{ padding: 0.2 }}
        nodeTypes={nodeTypes}
        nodes={graph.nodes}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ffffff08" gap={24} size={1} />
        <MiniMap
          bgColor="#0a0a0f"
          maskColor="rgba(0,0,0,0.65)"
          nodeColor={(node) => {
            const accent = (node.data as MindMapNodeData).accent;

            return accent || "#ff4fa3";
          }}
        />
        <Controls className="!border-white/10 !bg-zinc-900/90 !shadow-xl [&>button]:!border-white/10 [&>button]:!bg-zinc-800 [&>button]:!text-white" />
      </ReactFlow>
    </div>
  );
}
