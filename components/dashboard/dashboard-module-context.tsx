"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { getSearchModuleBySlug } from "@/lib/search-modules";

type DashboardModuleContextValue = {
  activeModule: string | null;
  activeModuleItem: string | null;
  selectModule: (itemName: string, module: string, slug?: string) => void;
};

const DashboardModuleContext =
  createContext<DashboardModuleContextValue | null>(null);

export function DashboardModuleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeModuleItem, setActiveModuleItem] = useState<string | null>(null);

  useEffect(() => {
    const match = pathname.match(/^\/dashboard\/search\/([^/]+)$/);

    if (!match) return;

    const def = getSearchModuleBySlug(match[1]);

    if (def) {
      setActiveModuleItem(def.name);
      setActiveModule(def.module);
    }
  }, [pathname]);

  const selectModule = useCallback(
    (itemName: string, module: string, slug?: string) => {
      setActiveModuleItem(itemName);
      setActiveModule(module);

      const def = slug
        ? getSearchModuleBySlug(slug)
        : undefined;
      const targetSlug =
        slug ??
        def?.slug ??
        itemName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      router.push(`/dashboard/search/${targetSlug}`);
    },
    [router],
  );

  const value = useMemo(
    () => ({ activeModule, activeModuleItem, selectModule }),
    [activeModule, activeModuleItem, selectModule],
  );

  return (
    <DashboardModuleContext.Provider value={value}>
      {children}
    </DashboardModuleContext.Provider>
  );
}

export function useDashboardModule() {
  const context = useContext(DashboardModuleContext);
  if (!context) {
    throw new Error(
      "useDashboardModule must be used within DashboardModuleProvider",
    );
  }
  return context;
}
