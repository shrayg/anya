"use client";

import { Handle, Position, NodeProps } from "@xyflow/react";
import { useState } from "react";
import { Mail, User, Phone, Globe, MessageCircle, HelpCircle } from "lucide-react";

const nodeTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  person:   { icon: User,          color: "#60a5fa", label: "Person"   },
  email:    { icon: Mail,          color: "#f87171", label: "Email"    },
  phone:    { icon: Phone,         color: "#34d399", label: "Phone"    },
  domain:   { icon: Globe,         color: "#fbbf24", label: "Domain"   },
  discord:  { icon: MessageCircle, color: "#818cf8", label: "Discord"  },
  note:     { icon: HelpCircle,    color: "#94a3b8", label: "Note"     },
};

export type OsintNodeData = {
  nodeType: string;
  label: string;
};

export function OsintNode({ data, selected }: NodeProps) {
  const nodeData = data as OsintNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label || "");
  const config = nodeTypeConfig[nodeData.nodeType] || nodeTypeConfig.note;
  const Icon = config.icon;

  return (
    <div
      onDoubleClick={() => setIsEditing(true)}
      className="relative min-w-[140px] rounded-xl border transition-all"
      style={{
        background: "#141414",
        borderColor: selected ? config.color : "#2a2a2a",
        boxShadow: selected ? `0 0 0 2px ${config.color}44` : "none",
      }}
    >
      {/* Top color bar */}
      <div className="h-1 rounded-t-xl" style={{ background: config.color }} />

      <div className="px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
          <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: config.color }}>
            {config.label}
          </span>
        </div>

        {isEditing ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => {
              setIsEditing(false);
              nodeData.label = label;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setIsEditing(false);
                nodeData.label = label;
              }
            }}
            className="bg-transparent text-white text-sm outline-none border-b border-white/30 w-full"
          />
        ) : (
          <span className="text-white text-sm font-medium truncate max-w-[160px]">
            {label || <span className="text-gray-500 italic text-xs">double-click to edit</span>}
          </span>
        )}
      </div>

      {/* Connection handles */}
      <Handle type="target" position={Position.Left}  className="!w-3 !h-3 !bg-white/20 !border-white/40 hover:!bg-white" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-white/20 !border-white/40 hover:!bg-white" />
      <Handle type="target" position={Position.Top}   className="!w-3 !h-3 !bg-white/20 !border-white/40 hover:!bg-white" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-white/20 !border-white/40 hover:!bg-white" />
    </div>
  );
}
