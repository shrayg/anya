"use client";

import { Search, Info } from "lucide-react";

export function NoInfoFound() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center py-20 px-6 animate-in fade-in zoom-in-95 duration-700">
      <div className="relative mb-8 text-center flex flex-col items-center">
        <div className="w-24 h-24 rounded-full bg-[#111111] flex items-center justify-center border border-[#222222]">
          <Search className="w-10 h-10 text-gray-600" />
        </div>
        <div className="absolute top-0 right-0 w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shadow-sm">
          <Info className="w-4 h-4 text-purple-400" />
        </div>
      </div>

      <h3 className="text-white text-2xl font-black mb-3 text-center">
        No Records Detected
      </h3>
      <p className="text-gray-500 text-center max-w-sm mb-10 leading-relaxed font-medium">
        We couldn't find any information about your search in our databases.
        This doesn't mean anything is wrong - many searches don't return
        results.
      </p>

      <div className="flex flex-col gap-2 w-full max-w-[300px]">
        <div className="flex items-center gap-3 px-5 py-4 bg-[#111111] border border-[#222222] rounded-2xl text-[10px] font-bold uppercase tracking-widest text-gray-400 shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]" />
          Verify input formatting
        </div>
        <div className="flex items-center gap-3 px-5 py-4 bg-[#111111] border border-[#222222] rounded-2xl text-[10px] font-bold uppercase tracking-widest text-gray-400 shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
          Check tool-specific syntax
        </div>
      </div>
    </div>
  );
}
