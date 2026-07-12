"use client";

import Link from "next/link";
import clsx from "clsx";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { getHubSections } from "@/lib/search-modules";
import {
  catalogSpanDataAttributes,
  getHubSectionSpan,
  hubSectionLayoutClass,
} from "@/lib/catalog-grid";
import {
  hasPlatformBrandIcon,
  PlatformBrandIcon,
} from "@/components/dashboard/platform-brand-icon";
import { ModuleStatusDot } from "@/components/dashboard/module-status-dot";

function sectionGridClass(title: string): string {
  switch (title) {
    case "AI Intelligence":
      return "catalog-module-grid catalog-module-grid--double";
    case "Financial & Assets":
    case "Platforms":
    case "Dating Apps":
      return "catalog-module-grid catalog-module-grid--quad catalog-module-grid--dense";
    default:
      return "catalog-module-grid catalog-module-grid--triple catalog-module-grid--dense";
  }
}

export default function SearchHubPage() {
  const [filter, setFilter] = useState("");
  const sections = getHubSections();

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
            item.tagline.toLowerCase().includes(q),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [filter, sections]);

  return (
    <div className="module-search module-search-hub px-6 py-6 md:px-8 md:py-8" data-tour="search-hub">
      <header className="module-search-hero">
        <h1 className="module-search-title">Pick a module</h1>
        <p className="module-search-tagline">
          Every lookup opens its own workspace — IntelX, stealer logs, social
          pivots, AI analysis, and more.
        </p>
      </header>

      <div className="relative mb-6 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          className="ui-input ui-input--icon py-2.5"
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter modules…"
          value={filter}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400" />
          Connected
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-red-500" />
          Not connected
        </span>
      </div>

      <div className="module-hub-layout">
        {filtered.map((section) => (
          <section
            key={section.title}
            className={clsx("module-hub-section", hubSectionLayoutClass(section.title))}
          >
            <h2 className="module-hub-section-title">{section.title}</h2>
            <div className={sectionGridClass(section.title)}>
              {section.items.map((item, index) => {
                const span = getHubSectionSpan(
                  index,
                  section.items.length,
                  section.title,
                );

                return (
                  <Link
                    key={item.slug}
                    className={clsx(
                      "catalog-module-item module-catalog-row group",
                      section.title === "AI Intelligence" && "module-catalog-row--ai",
                    )}
                    {...catalogSpanDataAttributes(span)}
                    href={`/dashboard/search/${item.slug}`}
                  >
                    <span className="module-catalog-row-icon">
                      {hasPlatformBrandIcon(item.name) ? (
                        <PlatformBrandIcon className="size-4 shrink-0" name={item.name} />
                      ) : (
                        <Search className="size-4 shrink-0 text-zinc-500" />
                      )}
                    </span>
                    <span className="module-catalog-row-copy">
                      <span className="module-catalog-row-title">{item.name}</span>
                      <span className="module-catalog-row-hint">{item.hint}</span>
                    </span>
                    <ModuleStatusDot slug={item.slug} />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
