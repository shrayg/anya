"use client";

import { Chip } from "@heroui/chip";

interface StatusBarProps {
  status: string;
  query?: string;
  totalLookups?: number;
  maxLookups?: number;
}

export function StatusBar({ status, query, totalLookups = 0, maxLookups = 250 }: StatusBarProps) {
  return (
    <div className="w-full bg-[#111111]/70 backdrop-blur-xl border border-[#222222] rounded-full py-2.5 px-6 flex items-center justify-between mb-12 shadow-sm">
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-sm font-semibold tracking-tight">{status}</span>
        {query && (
          <>
            <div className="h-4 w-[1px] bg-[#333333]" />
            <span className="text-white text-sm font-mono font-bold tracking-tight">{query}</span>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[#1a1a1a] px-3 py-1 rounded-full border border-[#2a2a2a]">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
          <span className="text-white text-xs font-black">{totalLookups}</span>
          <span className="text-gray-500 text-[10px] uppercase font-black">/ {maxLookups} lookups</span>
        </div>
      </div>
    </div>
  );
}
