"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ModuleHealthLevel } from "@/lib/module-health";

const POLL_INTERVAL_MS = 2 * 60_000;

type ModuleHealthContextValue = {
  modules: Record<string, boolean> | null;
  levels: Record<string, ModuleHealthLevel> | null;
  checkedAt: string | null;
  loading: boolean;
  isOperational: (slug: string) => boolean;
  levelFor: (slug: string) => ModuleHealthLevel | null;
  refresh: () => void;
};

const ModuleHealthContext = createContext<ModuleHealthContextValue | null>(
  null,
);

export function ModuleHealthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [modules, setModules] = useState<Record<string, boolean> | null>(null);
  const [levels, setLevels] = useState<Record<
    string,
    ModuleHealthLevel
  > | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch("/api/osint/modules/health", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          if (cancelled) return;
          if (data?.modules && typeof data.modules === "object") {
            setModules(data.modules as Record<string, boolean>);
          }
          if (data?.levels && typeof data.levels === "object") {
            setLevels(data.levels as Record<string, ModuleHealthLevel>);
          } else if (data?.modules && typeof data.modules === "object") {
            // Back-compat: derive levels from boolean map.
            const next: Record<string, ModuleHealthLevel> = {};

            for (const [slug, ok] of Object.entries(
              data.modules as Record<string, boolean>,
            )) {
              next[slug] = ok ? "ok" : "down";
            }
            setLevels(next);
          }
          if (typeof data?.checkedAt === "string") {
            setCheckedAt(data.checkedAt);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    };

    load();

    const interval = window.setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [tick]);

  const value = useMemo<ModuleHealthContextValue>(
    () => ({
      modules,
      levels,
      checkedAt,
      loading,
      isOperational: (slug: string) => {
        const level = levels?.[slug];

        if (level) return level === "ok" || level === "degraded";

        return modules?.[slug] ?? false;
      },
      levelFor: (slug: string) => levels?.[slug] ?? null,
      refresh,
    }),
    [modules, levels, checkedAt, loading, refresh],
  );

  return (
    <ModuleHealthContext.Provider value={value}>
      {children}
    </ModuleHealthContext.Provider>
  );
}

export function useModuleHealth() {
  const context = useContext(ModuleHealthContext);

  if (!context) {
    throw new Error("useModuleHealth must be used within ModuleHealthProvider");
  }

  return context;
}
