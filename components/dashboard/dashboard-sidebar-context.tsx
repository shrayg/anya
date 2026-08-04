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
const FOOTER_STORAGE_KEY = "anya-sidebar-footer-collapsed";

const SIDEBAR_RESIZE_MS = 450;
/** Match Tailwind `md` — drawer only below this. */
const MOBILE_DRAWER_MQ = "(max-width: 767px)";

type DashboardSidebarContextValue = {
  collapsed: boolean;
  isResizing: boolean;
  toggleCollapsed: () => void;
  footerCollapsed: boolean;
  toggleFooterCollapsed: () => void;
  /** Phone drawer open (ignored on desktop). */
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
  isMobileViewport: boolean;
};

const DashboardSidebarContext =
  createContext<DashboardSidebarContextValue | null>(null);

export function DashboardSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [footerCollapsed, setFooterCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(RAIL_STORAGE_KEY) === "true");
      setFooterCollapsed(localStorage.getItem(FOOTER_STORAGE_KEY) === "true");
    } catch {
      setCollapsed(false);
      setFooterCollapsed(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mq = window.matchMedia(MOBILE_DRAWER_MQ);
    const sync = () => {
      const mobile = mq.matches;
      setIsMobileViewport(mobile);
      if (!mobile) setMobileOpen(false);
    };

    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const timer = window.setTimeout(() => {
      setIsResizing(false);
    }, SIDEBAR_RESIZE_MS);

    return () => window.clearTimeout(timer);
  }, [isResizing, collapsed]);

  useEffect(() => {
    if (!mobileOpen || !isMobileViewport) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen, isMobileViewport]);

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

  const toggleFooterCollapsed = useCallback(() => {
    setFooterCollapsed((current) => {
      const next = !current;

      try {
        localStorage.setItem(FOOTER_STORAGE_KEY, String(next));
      } catch {
        // ignore storage failures
      }

      return next;
    });
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(
    () => setMobileOpen((current) => !current),
    [],
  );

  const value = useMemo(
    () => ({
      collapsed: ready ? collapsed : false,
      isResizing: ready ? isResizing : false,
      toggleCollapsed,
      footerCollapsed: ready ? footerCollapsed : false,
      toggleFooterCollapsed,
      mobileOpen,
      openMobile,
      closeMobile,
      toggleMobile,
      isMobileViewport,
    }),
    [
      closeMobile,
      collapsed,
      footerCollapsed,
      isMobileViewport,
      isResizing,
      mobileOpen,
      openMobile,
      ready,
      toggleCollapsed,
      toggleFooterCollapsed,
      toggleMobile,
    ],
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
