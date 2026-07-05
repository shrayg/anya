"use client";

import { ReactNode } from "react";

export function OsintLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-black overflow-x-hidden pt-6 pb-20 px-4 flex flex-col items-center">
      {/* Background Glow */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none -z-10 opacity-30" />
      <div className="absolute bottom-[10%] left-1/3 w-[600px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -z-10 opacity-20" />

      {/* Content Container */}
      <div className="w-full max-w-6xl flex flex-col items-center relative z-10">
        {children}
      </div>
    </div>
  );
}
