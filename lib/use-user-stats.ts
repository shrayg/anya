"use client";

import { useCallback, useEffect, useState } from "react";

import type { UserStats } from "@/lib/account-plan";
import { normalizeUserStats } from "@/lib/account-plan";

export function useUserStats(enabled = true) {
  const [stats, setStats] = useState<UserStats | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setStats(null);
      return;
    }

    try {
      const response = await fetch("/api/user/stats", { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as UserStats;
      setStats(normalizeUserStats(data));
    } catch {
      // Ignore transient network errors; keep last known stats.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStats(null);
      return;
    }

    void refresh();

    const interval = window.setInterval(() => {
      void refresh();
    }, 30_000);

    const onFocus = () => {
      void refresh();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh]);

  return { stats, refresh };
}
