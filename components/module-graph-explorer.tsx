"use client";

import clsx from "clsx";
import { ArrowUpRight, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  ModuleCatalogItem,
  ModuleCatalogSection,
} from "@/components/module-catalog";
import { CATALOG_MODULE_COUNT } from "@/lib/featured-modules";
import {
  SEARCH_AUTOFILL_SHIELD,
  unlockAutofillShield,
} from "@/lib/search-autofill-shield";

function capabilityCount(items: ModuleCatalogItem[]) {
  return items.reduce((sum, item) => sum + 1 + (item.toolCount ?? 0), 0);
}

export function ModuleGraphExplorer({
  sections,
}: {
  sections: ModuleCatalogSection[];
}) {
  const [filter, setFilter] = useState("");
  const [activeLane, setActiveLane] = useState<string | null>(
    sections[0]?.title ?? null,
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
            section.title.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [filter, sections]);

  useEffect(() => {
    if (!filtered.length) {
      setActiveLane(null);
      return;
    }
    if (!filtered.some((section) => section.title === activeLane)) {
      setActiveLane(filtered[0].title);
    }
  }, [activeLane, filtered]);

  const activeSection =
    filtered.find((section) => section.title === activeLane) ??
    filtered[0] ??
    null;

  const totalShown = filtered.reduce(
    (sum, section) => sum + capabilityCount(section.items),
    0,
  );

  return (
    <div className="mod-index">
      <div className="mod-index-toolbar">
        <label className="mod-index-search" htmlFor="module-graph-filter">
          <Search className="size-3.5" />
          <input
            {...SEARCH_AUTOFILL_SHIELD}
            id="module-graph-filter"
            name="module-graph-filter"
            onChange={(event) => setFilter(event.target.value)}
            onFocus={unlockAutofillShield}
            placeholder="Filter by module or lane…"
            readOnly
            type="text"
            value={filter}
          />
        </label>
        <p className="mod-index-meta">
          <span>{totalShown || CATALOG_MODULE_COUNT}</span> modules
          <i aria-hidden>/</i>
          <span>{filtered.length}</span> lanes
        </p>
      </div>

      <div className="mod-index-body">
        <nav className="mod-index-lanes" aria-label="Module lanes">
          {filtered.map((section, index) => {
            const count = capabilityCount(section.items);
            const active = activeSection?.title === section.title;

            return (
              <button
                key={section.title}
                type="button"
                className={clsx(
                  "mod-index-lane",
                  active && "is-active",
                  section.featured && "is-featured",
                )}
                onClick={() => setActiveLane(section.title)}
                onMouseEnter={() => setActiveLane(section.title)}
              >
                <span className="mod-index-lane-num">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mod-index-lane-name">{section.title}</span>
                <span className="mod-index-lane-count">{count}</span>
              </button>
            );
          })}
        </nav>

        <aside className="mod-index-panel">
          {activeSection ? (
            <>
              <header className="mod-index-panel-head">
                <div>
                  <p className="mod-index-panel-kicker">Lane</p>
                  <h3>{activeSection.title}</h3>
                  {activeSection.description ? (
                    <p className="mod-index-panel-desc">
                      {activeSection.description}
                    </p>
                  ) : null}
                </div>
                <p className="mod-index-panel-count">
                  {capabilityCount(activeSection.items)}
                  <span>modules</span>
                </p>
              </header>

              <ul className="mod-index-list">
                {activeSection.items.map((item, index) => (
                  <li key={item.slug}>
                    <Link
                      className="mod-index-item"
                      href={`/dashboard/search/${item.slug}`}
                    >
                      <span className="mod-index-item-num">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="mod-index-item-copy">
                        <strong>{item.name}</strong>
                        <small>{item.hint}</small>
                      </span>
                      <ArrowUpRight className="mod-index-item-arrow" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="mod-index-empty">
              <p>No lanes match that filter.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
