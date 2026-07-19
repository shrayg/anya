"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function scrollPageToTop() {
  if (typeof window === "undefined") return;

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const main = document.querySelector<HTMLElement>(
    ".dash-main, [data-tour='main-content']",
  );
  if (main) {
    main.scrollTo({ top: 0, left: 0, behavior: "auto" });
    main.scrollTop = 0;
  }
}

/**
 * Client navigations can keep window or dashboard main-pane scroll position.
 * Force the new route to start at the top unless a hash targets an in-page anchor.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  useEffect(() => {
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) return;

    // Wait a frame so the new route layout (e.g. .dash-main) is mounted.
    const frame = window.requestAnimationFrame(() => {
      scrollPageToTop();
    });
    const timeout = window.setTimeout(scrollPageToTop, 0);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [pathname, search]);

  return null;
}
