"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "anya-sidebar-footer-collapsed";

type DashboardSidebarContextValue = {
  footerCollapsed: boolean;
  toggleFooterCollapsed: () => void;
};

const DashboardSidebarContext =
  createContext<DashboardSidebarContextValue | null>(null);

export function DashboardSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [footerCollapsed, setFooterCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setFooterCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      setFooterCollapsed(false);
    } finally {
      setReady(true);
    }
  }, []);

  const toggleFooterCollapsed = useCallback(() => {
    setFooterCollapsed((current) => {
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
      footerCollapsed: ready ? footerCollapsed : false,
      toggleFooterCollapsed,
    }),
    [footerCollapsed, ready, toggleFooterCollapsed],
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
