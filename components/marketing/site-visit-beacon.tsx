"use client";

import { useEffect } from "react";

import { apiFetch } from "@/lib/csrf-client";

/**
 * Fires once per marketing-page mount. Server cookie-dedupes to ~1 count/day
 * per browser so refreshes do not inflate the admin Activity graph.
 */
export function SiteVisitBeacon() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (cancelled) return;
        await apiFetch("/api/analytics/visit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          keepalive: true,
        });
      } catch {
        // Best-effort analytics — never block marketing UX.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
