"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getAppLandingPath } from "@/lib/plans";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data?.authenticated || !data.user) {
          router.replace("/");

          return;
        }

        router.replace(
          getAppLandingPath({
            ...data.user,
            canManageWorkspace: data.canManageWorkspace,
          }),
        );
      })
      .catch(() => router.replace("/"));
  }, [router]);

  return null;
}
