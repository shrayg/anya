"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SKIP_PREFIXES = ["/admin", "/helper", "/dashboard"];

function isInspectShortcut(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;

  if (e.key === "F12") return true;
  if (mod && e.shiftKey && (key === "i" || key === "j" || key === "c"))
    return true;
  if (mod && key === "u") return true;

  return false;
}

/**
 * Production-only deterrents against casual inspect-element use.
 * Not security — DevTools can still be opened other ways.
 */
export function InspectGuard() {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
      return;

    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isInspectShortcut(e)) e.preventDefault();
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pathname]);

  return null;
}
