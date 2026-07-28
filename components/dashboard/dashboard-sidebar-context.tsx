"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const RAIL_STORAGE_KEY = "anya-sidebar-collapsed";

const SIDEBAR_RESIZE_MS = 450;

type DashboardSidebarContextValue = {
  collapsed: boolean;
  isResizing: boolean;
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
  const [isResizing, setIsResizing] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(RAIL_STORAGE_KEY) === "true");
    } catch {
      setCollapsed(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const timer = window.setTimeout(() => {
      setIsResizing(false);
    }, SIDEBAR_RESIZE_MS);

    return () => window.clearTimeout(timer);
  }, [isResizing, collapsed]);

  const toggleCollapsed = useCallback(() => {
    setIsResizing(true);
    setCollapsed((current) => {
      const next = !current;

      try {
        localStorage.setItem(RAIL_STORAGE_KEY, String(next));
      } catch {
        // ignore storage failures
      }

      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      collapsed: ready ? collapsed : false,
      isResizing: ready ? isResizing : false,
      toggleCollapsed,
    }),
    [collapsed, isResizing, ready, toggleCollapsed],
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
