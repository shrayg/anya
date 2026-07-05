"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ModuleHealthContextValue = {
  modules: Record<string, boolean> | null;
  loading: boolean;
  isOperational: (slug: string) => boolean;
};

const ModuleHealthContext = createContext<ModuleHealthContextValue | null>(null);

export function ModuleHealthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [modules, setModules] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/osint/modules/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.modules && typeof data.modules === "object") {
          setModules(data.modules as Record<string, boolean>);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ModuleHealthContextValue>(
    () => ({
      modules,
      loading,
      isOperational: (slug: string) => modules?.[slug] ?? false,
    }),
    [modules, loading],
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
