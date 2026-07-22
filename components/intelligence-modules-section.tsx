"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { type ModuleCatalogSection } from "@/components/module-catalog";
import { ModuleGraphExplorer } from "@/components/module-graph-explorer";
import { AI_MODULE_EXPLAINERS, type CatalogLane } from "@/lib/featured-modules";
import { hasWorkspaceDashboardAccess } from "@/lib/plans";
import { siteConfig } from "@/config/site";

export function IntelligenceModulesSection({
  catalogLanes,
  moduleCount,
}: {
  catalogLanes: CatalogLane[];
  moduleCount: number;
}) {
  const [hideCatalog, setHideCatalog] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data?.authenticated || !data.user) return;

        const homepageOnly = !hasWorkspaceDashboardAccess({
          ...data.user,
          canManageWorkspace: data.canManageWorkspace,
        });

        setHideCatalog(homepageOnly);
      })
      .catch(() => undefined);
  }, []);

  const sections = useMemo<ModuleCatalogSection[]>(() => {
    return catalogLanes.map((lane) => ({
      title: lane.label,
      description: lane.description,
      featured: Boolean(lane.isAi),
      items: lane.modules.map((module) => ({
        name: module.name,
        slug: module.slug,
        hint: module.hint,
        toolCount: module.toolCount ?? 0,
        summary: lane.isAi
          ? (AI_MODULE_EXPLAINERS[module.slug] ?? module.summary)
          : undefined,
      })),
    }));
  }, [catalogLanes]);

  if (hideCatalog) {
    return null;
  }

  return (
    <section className="mod-shell relative z-20 mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-12">
      <header className="mod-explorer-head">
        <div>
          <p className="mod-kicker mod-kicker--tight">Module directory</p>
          <h2 className="mod-explorer-title">{moduleCount} live modules</h2>
          <p className="mod-explorer-text">
            Pick a lane on the left. Open any module from the list.
          </p>
        </div>
        <Link className="mod-cta" href={siteConfig.defaultWorkspacePath}>
          Panel
          <ArrowUpRight className="size-4" />
        </Link>
      </header>

      <ModuleGraphExplorer sections={sections} />
    </section>
  );
}
