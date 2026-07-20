"use client";

import Link from "next/link";
import { Home, Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ModuleCatalog,
  type ModuleCatalogSection,
} from "@/components/module-catalog";
import { getHubSections } from "@/lib/search-modules";

export default function SearchHubPage() {
  const [filter, setFilter] = useState("");
  const sections = useMemo<ModuleCatalogSection[]>(
    () =>
      getHubSections().map((section) => ({
        title: section.title,
        description:
          section.title === "AI Intelligence"
            ? "Cross-source synthesis for investigator briefs."
            : section.title === "Crypto Intel"
              ? "Wallet / tx intelligence — removable via CRYPTO_INTEL_ENABLED=0."
              : undefined,
        featured:
          section.title === "AI Intelligence" ||
          section.title === "Crypto Intel",
        items: section.items.map((item) => ({
          name: item.name,
          slug: item.slug,
          hint: item.hint,
          summary:
            section.title === "AI Intelligence" ||
            section.title === "Crypto Intel"
              ? item.tagline
              : undefined,
        })),
      })),
    [],
  );

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

  const visibleCount = filtered.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );

  return (
    <div
      className="mod-shell module-search px-4 py-6 md:px-8 md:py-8"
      data-tour="search-hub"
    >
      <div className="mod-hub-top">
        <div>
          <p className="mod-kicker">Workspace</p>
          <h1 className="mod-hero-title mod-hero-title--hub">Pick a module</h1>
          <p className="mod-hero-text">
            Open any lookup in its own workspace. Filter by name or input type.
          </p>
        </div>
        <Link className="mod-cta mod-cta--ghost" href="/">
          <Home className="size-4" />
          Home
        </Link>
      </div>

      <div className="mod-toolbar">
        <label className="mod-search" htmlFor="workspace-module-filter">
          <Search className="size-4 text-zinc-500" />
          <input
            id="workspace-module-filter"
            placeholder="Filter modules…"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        <div className="mod-legend">
          <span>
            <i className="mod-dot mod-dot--ok" /> Connected
          </span>
          <span>
            <i className="mod-dot mod-dot--bad" /> Offline
          </span>
          <span className="mod-toolbar-hint">{visibleCount} modules</span>
        </div>
      </div>

      <ModuleCatalog showStatus sections={filtered} />
    </div>
  );
}
