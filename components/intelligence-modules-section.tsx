"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, LayoutGrid, Search } from "lucide-react";

import {
  ModuleCatalog,
  type ModuleCatalogSection,
} from "@/components/module-catalog";
import {
  AI_MODULE_EXPLAINERS,
  CATALOG_LANES,
  CATALOG_MODULE_COUNT,
} from "@/lib/featured-modules";
import { hasWorkspaceDashboardAccess } from "@/lib/plans";
import {
  SEARCH_AUTOFILL_SHIELD,
  unlockAutofillShield,
} from "@/lib/search-autofill-shield";
import { siteConfig } from "@/config/site";

export function IntelligenceModulesSection() {
  const [hideCatalog, setHideCatalog] = useState(false);
  const [filter, setFilter] = useState("");

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
    return CATALOG_LANES.map((lane) => ({
      title: lane.label,
      description: lane.description,
      featured: Boolean(lane.isAi),
      items: lane.modules.map((module) => ({
        name: module.name,
        slug: module.slug,
        hint: module.hint,
        summary: lane.isAi
          ? AI_MODULE_EXPLAINERS[module.slug] ?? module.summary
          : undefined,
      })),
    }));
  }, []);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return sections;

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.hint.toLowerCase().includes(q) ||
            (item.summary?.toLowerCase().includes(q) ?? false),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [filter, sections]);

  if (hideCatalog) {
    return null;
  }

  return (
    <section className="mod-shell relative z-20 mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
      <div className="mod-hero">
        <div className="mod-hero-copy">
          <p className="mod-kicker">
            <LayoutGrid className="size-3.5" />
            Module directory
          </p>
          <h2 className="mod-hero-title">
            Every capability,
            <span> one workspace</span>
          </h2>
          <p className="mod-hero-text">
            {siteConfig.name} runs {CATALOG_MODULE_COUNT} live search modules —
            AI briefs, breach indexes, financial pivots, and platform lookups.
            Browse below, or jump straight into the workspace after login.
          </p>
        </div>

        <div className="mod-hero-side">
          <div className="mod-stat">
            <strong>{CATALOG_MODULE_COUNT}</strong>
            <span>Modules</span>
          </div>
          <div className="mod-stat">
            <strong>4</strong>
            <span>AI synthesizers</span>
          </div>
          <Link className="mod-cta" href={siteConfig.defaultWorkspacePath}>
            Open workspace
            <ArrowUpRight className="size-4" />
          </Link>
          <Link className="mod-cta mod-cta--ghost" href="/auth?action=register">
            Create account
          </Link>
        </div>
      </div>

      <div className="mod-toolbar">
        <label className="mod-search" htmlFor="module-directory-filter">
          <Search className="size-4 text-zinc-500" />
          <input
            {...SEARCH_AUTOFILL_SHIELD}
            id="module-directory-filter"
            name="module-directory-filter"
            onChange={(event) => setFilter(event.target.value)}
            onFocus={unlockAutofillShield}
            placeholder="Filter modules by name or input type…"
            readOnly
            type="text"
            value={filter}
          />
        </label>
        <p className="mod-toolbar-hint">
          Showing {filtered.reduce((sum, section) => sum + section.items.length, 0)} modules
        </p>
      </div>

      <ModuleCatalog sections={filtered} variant="mindmap" />
    </section>
  );
}
