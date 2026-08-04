"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      closeButton
      richColors
      expand={false}
      offset={{ top: "1rem" }}
      position="top-center"
      theme="dark"
      visibleToasts={4}
      className="anya-sonner-toaster"
      toastOptions={{
        classNames: {
          toast:
            "anya-sonner-toast border border-white/10 bg-zinc-950/95 text-zinc-100 shadow-xl backdrop-blur-xl",
          title: "text-sm font-medium text-white",
          description: "text-xs text-zinc-400",
          actionButton:
            "bg-[var(--anya-blush)] text-[#0c1019] font-semibold",
          cancelButton: "bg-white/10 text-zinc-200",
          closeButton:
            "border border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800",
        },
      }}
    />
  );
}
