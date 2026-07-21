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
  const { levelFor, loading, levels } = useModuleHealth();
  const checking = loading && levels === null;
  const level = checking ? null : levelFor(slug);

  const label = checking
    ? "Checking module health"
    : level === "ok"
      ? "Module online"
      : level === "degraded"
        ? "Module degraded"
        : "Module offline";

  const title = checking
    ? "Checking connection…"
    : level === "ok"
      ? "Online"
      : level === "degraded"
        ? "Degraded"
        : "Offline";

  return (
    <span
      aria-label={label}
      className={clsx(
        "size-2 shrink-0 rounded-full transition-colors duration-300",
        checking
          ? "bg-zinc-500"
          : level === "ok"
            ? "bg-emerald-400"
            : level === "degraded"
              ? "bg-amber-400"
              : "bg-red-500",
        className,
      )}
      title={title}
    />
  );
}
