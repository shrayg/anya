"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const PATH_KEY = "anya:marketing-path";
const LEFT_HOME_KEY = "anya:left-home";

/**
 * Tracks client-side marketing navigations so Home can play enter animations
 * only when returning from another page (not on cold open / first landing).
 *
 * Flag is set while on any non-home route, so it is already present before
 * Home mounts on the next navigation (child layout effects run before parent).
 */
export function MarketingNavBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (pathname !== "/") {
        sessionStorage.setItem(LEFT_HOME_KEY, "1");
      }

      sessionStorage.setItem(PATH_KEY, pathname);
    } catch {
      // sessionStorage may be blocked
    }
  }, [pathname]);

  return null;
}

export function hasLeftHomeThisSession(): boolean {
  try {
    return sessionStorage.getItem(LEFT_HOME_KEY) === "1";
  } catch {
    return false;
  }
}
