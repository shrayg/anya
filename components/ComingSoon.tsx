import type { LucideIcon } from "lucide-react";

import { Construction } from "lucide-react";

export function ComingSoon({
  title,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="flex flex-col px-6 py-10 min-h-full">
      <div className="flex items-center gap-3 mb-12">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}40` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
          <p className="text-gray-500 text-sm">{description}</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center flex-1 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-[#2a2a2a] flex items-center justify-center mb-5">
          <Construction className="w-8 h-8 text-gray-600" />
        </div>
        <h2 className="text-white font-bold text-2xl mb-2">Coming Soon</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          This module is under construction and will be available in a future
          update.
        </p>
      </div>
    </div>
  );
}
