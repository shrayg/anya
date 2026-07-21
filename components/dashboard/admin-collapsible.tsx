"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

type AdminCollapsibleProps = {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function AdminCollapsible({
  id,
  title,
  subtitle,
  badge,
  defaultOpen = true,
  children,
}: AdminCollapsibleProps) {
  const storageKey = `anya-admin-section:${id}`;
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);

      if (stored === "0") setOpen(false);
      if (stored === "1") setOpen(true);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [storageKey]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }

      return next;
    });
  };

  return (
    <section
      className="overflow-hidden rounded-[0.85rem] border border-white/[0.07] bg-[#0c0c0e]"
      id={id}
    >
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.02]"
        type="button"
        onClick={toggle}
      >
        <ChevronDown
          className={clsx(
            "size-4 shrink-0 text-zinc-500 transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
            {badge != null && badge !== "" ? (
              <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400">
                {badge}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="truncate text-[11px] text-zinc-600">{subtitle}</p>
          ) : null}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-zinc-600">
          {hydrated ? (open ? "Minimize" : "Expand") : "…"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-white/[0.05] px-3 py-3">{children}</div>
      ) : null}
    </section>
  );
}
