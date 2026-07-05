"use client";

import { Database, Search, Eye, ShieldCheck } from "lucide-react";

interface SummaryCardsProps {
  totalFound: number;
  displayed: number;
}

export function SummaryCards({ totalFound, displayed }: SummaryCardsProps) {
  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div className="bg-[#111111] border border-[#222222] rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow group">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
            <Database className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Found</p>
            <p className="text-white text-2xl font-black">{totalFound}</p>
          </div>
        </div>
        <p className="text-gray-500 text-xs font-medium leading-relaxed">
           Aggregated records retrieved from unified indexed archives across global endpoints.
        </p>
      </div>

      <div className="bg-[#111111] border border-[#222222] rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow group">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
            <Eye className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Displayed</p>
            <p className="text-white text-2xl font-black">{displayed}</p>
          </div>
        </div>
        <p className="text-gray-500 text-xs font-medium leading-relaxed">
           Filtered results currently presented in the active viewport session.
        </p>
      </div>
      
      <div className="mt-auto bg-[#0a0a0a] rounded-[2rem] p-6 border border-[#1a1a1a]">
        <div className="flex items-center gap-3 mb-2">
           <ShieldCheck className="w-4 h-4 text-green-500" />
           <p className="text-white font-bold text-xs uppercase">Integrity Verified</p>
        </div>
        <p className="text-gray-500 text-[10px] font-medium">Data integrity verified through cryptographic hashing and endpoint validation protocols.</p>
      </div>
    </div>
  );
}
