"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "anya-sidebar-collapsed";

type DashboardSidebarContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const DashboardSidebarContext =
  createContext<DashboardSidebarContextValue | null>(null);

export function DashboardSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      setCollapsed(false);
    } finally {
      setReady(true);
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;

      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage failures
      }

      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      collapsed: ready ? collapsed : false,
      toggleCollapsed,
    }),
    [collapsed, ready, toggleCollapsed],
  );

  return (
    <DashboardSidebarContext.Provider value={value}>
      {children}
    </DashboardSidebarContext.Provider>
  );
}

export function useDashboardSidebar() {
  const context = useContext(DashboardSidebarContext);

  if (!context) {
    throw new Error(
      "useDashboardSidebar must be used within DashboardSidebarProvider",
    );
  }

  return context;
}
