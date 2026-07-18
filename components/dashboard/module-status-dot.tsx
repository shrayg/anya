"use client";

import clsx from "clsx";

import { useModuleHealth } from "@/components/dashboard/module-status-provider";

export function ModuleStatusDot({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const { isOperational, loading, modules } = useModuleHealth();
  const checking = loading && modules === null;
  const operational = checking ? null : isOperational(slug);

  return (
    <span
      aria-label={
        checking
          ? "Checking module health"
          : operational
            ? "Module online"
            : "Module offline"
      }
      className={clsx(
        "size-2 shrink-0 rounded-full transition-colors duration-300",
        checking
          ? "bg-zinc-500"
          : operational
            ? "bg-emerald-400"
            : "bg-red-500",
        className,
      )}
      title={
        checking ? "Checking connection…" : operational ? "Online" : "Offline"
      }
    />
  );
}
