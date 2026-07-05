"use client";

import clsx from "clsx";

import { useModuleHealth } from "@/components/dashboard/module-status-provider";
import { isModuleOperational } from "@/lib/search-modules";

export function ModuleStatusDot({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const { isOperational, loading, modules } = useModuleHealth();
  const operational = modules ? isOperational(slug) : isModuleOperational(slug);

  return (
    <span
      aria-label={operational ? "Module connected" : "Module not connected"}
      className={clsx(
        "size-2 shrink-0 rounded-full transition-colors duration-300",
        loading && modules === null
          ? "bg-zinc-500"
          : operational
            ? "bg-emerald-400"
            : "bg-red-500",
        className,
      )}
      title={
        loading && modules === null
          ? "Checking connection…"
          : operational
            ? "Connected"
            : "Not connected"
      }
    />
  );
}
