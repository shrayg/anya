"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { hasWorkspaceDashboardAccess } from "@/lib/plans";

export function WorkspaceAccessGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useDashboardUser();

  useEffect(() => {
    const isSearchRoute =
      pathname === "/dashboard/search" || pathname.startsWith("/dashboard/search/");

    if (!isSearchRoute) return;

    if (
      !hasWorkspaceDashboardAccess({
        ...user,
        canManageWorkspace: user.canManageWorkspace,
      })
    ) {
      router.replace("/#search");
    }
  }, [pathname, router, user]);

  return null;
}
