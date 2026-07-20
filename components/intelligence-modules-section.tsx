"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";

import { BrutalistReveal } from "@/components/brutalist-reveal";
import {
  ModuleCatalog,
  type ModuleCatalogSection,
} from "@/components/module-catalog";
import {
  AI_MODULE_EXPLAINERS,
  CATALOG_LANES,
  CATALOG_MODULE_COUNT,
} from "@/lib/featured-modules";
import {
  SEARCH_AUTOFILL_SHIELD,
  unlockAutofillShield,
} from "@/lib/search-autofill-shield";

const mindMapPositions = [
  { x: 13, y: 20 },
  { x: 35, y: 11 },
  { x: 65, y: 11 },
  { x: 87, y: 21 },
  { x: 91, y: 66 },
  { x: 70, y: 84 },
  { x: 38, y: 86 },
  { x: 10, y: 66 },
  { x: 24, y: 45 },
] as const;

export function IntelligenceModulesSection() {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeLane, setActiveLane] = useState(0);
  const mindMapNodes = useRef<Array<HTMLButtonElement | null>>([]);

  const activateNearestLane = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") return;

      let nearestIndex = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;

      mindMapNodes.current.forEach((node, index) => {
        if (!node) return;

        const bounds = node.getBoundingClientRect();
        const distance = Math.hypot(
          event.clientX - (bounds.left + bounds.width / 2),
          event.clientY - (bounds.top + bounds.height / 2),
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      if (nearestIndex >= 0) {
        setActiveLane((current) =>
          current === nearestIndex ? current : nearestIndex,
        );
      }
    },
    [],
  );

  const sections = useMemo<ModuleCatalogSection[]>(() => {
    return CATALOG_LANES.map((lane) => ({
      title: lane.label,
      featured: Boolean(lane.isAi),
      items: lane.modules.map((module) => ({
        code: module.code,
        name: module.name,
        slug: module.slug,
        hint: module.hint,
        summary: lane.isAi
          ? (AI_MODULE_EXPLAINERS[module.slug] ?? module.summary)
          : undefined,
      })),
    }));
  }, []);

  const filtered = useMemo(() => {
    const query = filter.toLowerCase().trim();

    if (!query) return sections;

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.hint.toLowerCase().includes(query) ||
            (item.summary?.toLowerCase().includes(query) ?? false),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [filter, sections]);

  const filteredModuleCount = filtered.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );

  return (
    <section className="brutal-modules brutal-product-section" id="trace">
      <BrutalistReveal>
        <header className="brutal-section-head brutal-modules-head">
          <p>[ 01 / MODULE NETWORK ]</p>
          <h2>
            Every source.
            <span>Within reach.</span>
          </h2>
        </header>
      </BrutalistReveal>

      <BrutalistReveal delay={80}>
        <div className="module-mindmap">
          <div className="product-scene-bar">
            <span>LIVE MODULE MAP</span>
            <span>{CATALOG_MODULE_COUNT} SEARCH MODULES</span>
          </div>

          <div className="module-mindmap-body">
            <div className="module-mindmap-viewport">
              <div
                className="module-mindmap-stage"
                onPointerMove={activateNearestLane}
              >
                <svg
                  aria-hidden
                  className="module-mindmap-lines"
                  preserveAspectRatio="none"
                  viewBox="0 0 1000 560"
                >
                  {mindMapPositions.map((position, index) => (
                    <path
                      key={`${position.x}-${position.y}`}
                      className={activeLane === index ? "is-active" : undefined}
                      d={`M500 280 Q${500 + (position.x * 10 - 500) * 0.36} ${280 + (position.y * 5.6 - 280) * 0.12} ${position.x * 10} ${position.y * 5.6}`}
                    />
                  ))}
                </svg>

                <div className="module-mindmap-core">
                  <span>ANYA</span>
                  <strong>{CATALOG_MODULE_COUNT}</strong>
                  <i>LIVE MODULES</i>
                </div>

                {CATALOG_LANES.map((lane, index) => {
                  const position =
                    mindMapPositions[index] ?? mindMapPositions[0];

                  return (
                    <button
                      key={lane.label}
                      ref={(node) => {
                        mindMapNodes.current[index] = node;
                      }}
                      className={`module-mindmap-node ${activeLane === index ? "is-active" : ""}`}
                      style={
                        {
                          "--mind-x": `${position.x}%`,
                          "--mind-y": `${position.y}%`,
                        } as CSSProperties
                      }
                      type="button"
                      onFocus={() => setActiveLane(index)}
                      onMouseEnter={() => setActiveLane(index)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{lane.label}</strong>
                      <i>{String(lane.modules.length).padStart(2, "0")}</i>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside aria-live="polite" className="module-mindmap-readout">
              <span>CATEGORY / {String(activeLane + 1).padStart(2, "0")}</span>
              <h3>{CATALOG_LANES[activeLane]?.label}</h3>
              <p>{CATALOG_LANES[activeLane]?.description}</p>
              <div>
                {CATALOG_LANES[activeLane]?.modules.map((module) => (
                  <strong key={module.slug}>
                    <i>{module.code}</i>
                    {module.name}
                  </strong>
                ))}
              </div>
              <b>{CATALOG_LANES[activeLane]?.modules.length} CONNECTED</b>
            </aside>
          </div>
        </div>
      </BrutalistReveal>

      <div className={`coverage-controls ${expanded ? "is-expanded" : ""}`}>
        {expanded ? (
          <label className="coverage-filter" htmlFor="module-directory-filter">
            <Search className="size-4" />
            <input
              {...SEARCH_AUTOFILL_SHIELD}
              readOnly
              id="module-directory-filter"
              name="module-directory-filter"
              placeholder="Filter the module directory…"
              type="text"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onFocus={unlockAutofillShield}
            />
            <span>
              {filteredModuleCount}{" "}
              {filteredModuleCount === 1 ? "MATCH" : "MATCHES"}
            </span>
          </label>
        ) : null}

        <button
          aria-expanded={expanded}
          className="coverage-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Close directory" : "Explore all 63 modules"}
          {expanded ? (
            <ArrowUp className="size-4" />
          ) : (
            <ArrowDown className="size-4" />
          )}
        </button>
      </div>

      {expanded ? (
        <div className="coverage-directory">
          <ModuleCatalog sections={filtered} />
        </div>
      ) : null}
    </section>
  );
}
