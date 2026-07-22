"use client";

import clsx from "clsx";
import { ArrowUpRight, Search } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type {
  ModuleCatalogItem,
  ModuleCatalogSection,
} from "@/components/module-catalog";
import { CATALOG_MODULE_COUNT } from "@/lib/featured-modules";
import {
  SEARCH_AUTOFILL_SHIELD,
  unlockAutofillShield,
} from "@/lib/search-autofill-shield";

const LANE_ACCENTS = [
  "#c3d3e6",
  "#86efac",
  "#fbbf24",
  "#fda4af",
  "#93c5fd",
  "#a3e635",
  "#f0abfc",
  "#67e8f9",
  "#fdba74",
  "#e7e5e4",
];

function capabilityCount(items: ModuleCatalogItem[]) {
  return items.reduce((sum, item) => sum + 1 + (item.toolCount ?? 0), 0);
}

function laneAccent(index: number) {
  return LANE_ACCENTS[index % LANE_ACCENTS.length];
}

export function ModuleGraphExplorer({
  sections,
}: {
  sections: ModuleCatalogSection[];
}) {
  const [filter, setFilter] = useState("");
  const [hoveredLane, setHoveredLane] = useState<string | null>(null);
  const [pinnedLane, setPinnedLane] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const activeLaneTitle = pinnedLane ?? hoveredLane;
  const activeSection =
    filtered.find((section) => section.title === activeLaneTitle) ?? null;
  const activeIndex = activeSection
    ? filtered.findIndex((section) => section.title === activeSection.title)
    : -1;

  const totalShown = filtered.reduce(
    (sum, section) => sum + capabilityCount(section.items),
    0,
  );

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  const clearHoverSoon = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHoveredLane(null), 140);
  };

  const keepHover = (title: string) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHoveredLane(title);
  };

  // Drop a pin if that lane disappeared from the filter
  useEffect(() => {
    if (
      pinnedLane &&
      !filtered.some((section) => section.title === pinnedLane)
    ) {
      setPinnedLane(null);
    }
  }, [filtered, pinnedLane]);

  // When filtering to a single lane match, auto-show that lane's list
  useEffect(() => {
    if (filter.trim() && filtered.length === 1) {
      setHoveredLane(filtered[0].title);
    }
  }, [filter, filtered]);

  return (
    <div className="mod-graph">
      <div className="mod-graph-toolbar">
        <label className="mod-graph-search" htmlFor="module-graph-filter">
          <Search className="size-3.5 text-zinc-500" />
          <input
            {...SEARCH_AUTOFILL_SHIELD}
            id="module-graph-filter"
            name="module-graph-filter"
            onChange={(event) => setFilter(event.target.value)}
            onFocus={unlockAutofillShield}
            placeholder="Filter modules…"
            readOnly
            type="text"
            value={filter}
          />
        </label>
        <p className="mod-graph-count">
          {totalShown || CATALOG_MODULE_COUNT} modules · {filtered.length} lanes
        </p>
      </div>

      <div className="mod-graph-body">
        <div className="mod-graph-stage" aria-label="Module lanes">
          <svg
            aria-hidden
            className="mod-graph-spokes"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
          >
            {filtered.map((section, index) => {
              const angle =
                (index / Math.max(filtered.length, 1)) * Math.PI * 2 -
                Math.PI / 2;
              const x = 50 + Math.cos(angle) * 34;
              const y = 50 + Math.sin(angle) * 34;
              const accent = laneAccent(index);
              const active = activeLaneTitle === section.title;

              return (
                <line
                  key={section.title}
                  className={clsx(
                    "mod-graph-spoke",
                    active && "is-active",
                  )}
                  x1="50"
                  y1="50"
                  x2={x}
                  y2={y}
                  stroke={accent}
                />
              );
            })}
          </svg>

          <div className="mod-graph-hub-core">
            <strong>{totalShown || CATALOG_MODULE_COUNT}</strong>
            <span>modules</span>
            <small>{filtered.length} lanes</small>
          </div>

          {filtered.map((section, index) => {
            const angle =
              (index / Math.max(filtered.length, 1)) * Math.PI * 2 -
              Math.PI / 2;
            const x = 50 + Math.cos(angle) * 34;
            const y = 50 + Math.sin(angle) * 34;
            const accent = laneAccent(index);
            const active = activeLaneTitle === section.title;
            const pinned = pinnedLane === section.title;
            const count = capabilityCount(section.items);

            return (
              <button
                key={section.title}
                type="button"
                className={clsx(
                  "mod-graph-orbit",
                  active && "is-active",
                  pinned && "is-pinned",
                  section.featured && "is-featured",
                )}
                style={
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    "--lane-accent": accent,
                  } as CSSProperties
                }
                onMouseEnter={() => keepHover(section.title)}
                onMouseLeave={clearHoverSoon}
                onFocus={() => keepHover(section.title)}
                onBlur={clearHoverSoon}
                onClick={() =>
                  setPinnedLane((current) =>
                    current === section.title ? null : section.title,
                  )
                }
              >
                <span className="mod-graph-orbit-label">{section.title}</span>
                <span className="mod-graph-orbit-count">{count}</span>
              </button>
            );
          })}
        </div>

        <aside
          className={clsx(
            "mod-graph-panel",
            activeSection ? "is-open" : "is-empty",
          )}
          onMouseEnter={() => {
            if (activeLaneTitle) keepHover(activeLaneTitle);
          }}
          onMouseLeave={clearHoverSoon}
        >
          {activeSection ? (
            <>
              <header className="mod-graph-panel-head">
                <div>
                  <p
                    className="mod-graph-panel-kicker"
                    style={
                      {
                        color:
                          activeIndex >= 0
                            ? laneAccent(activeIndex)
                            : undefined,
                      } as CSSProperties
                    }
                  >
                    {activeSection.title}
                  </p>
                  <h3>
                    {capabilityCount(activeSection.items)} modules
                    {pinnedLane === activeSection.title ? (
                      <span className="mod-graph-panel-pin"> pinned</span>
                    ) : null}
                  </h3>
                  {activeSection.description ? (
                    <p className="mod-graph-panel-desc">
                      {activeSection.description}
                    </p>
                  ) : null}
                </div>
                {pinnedLane === activeSection.title ? (
                  <button
                    className="mod-graph-panel-clear"
                    type="button"
                    onClick={() => setPinnedLane(null)}
                  >
                    Unpin
                  </button>
                ) : null}
              </header>

              <ul className="mod-graph-panel-list">
                {activeSection.items.map((item) => (
                  <li key={item.slug}>
                    <Link
                      className="mod-graph-panel-item"
                      href={`/dashboard/search/${item.slug}`}
                    >
                      <span className="mod-graph-panel-item-copy">
                        <strong>{item.name}</strong>
                        <small>{item.hint}</small>
                      </span>
                      <ArrowUpRight className="size-3.5 shrink-0 opacity-50" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="mod-graph-panel-empty">
              <p>Hover a lane</p>
              <span>
                Module lists open here. Click a lane to pin it open.
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
