"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { getHubSections } from "@/lib/search-modules";
import {
  hasPlatformBrandIcon,
  PlatformBrandIcon,
} from "@/components/dashboard/platform-brand-icon";
import { ModuleStatusDot } from "@/components/dashboard/module-status-dot";

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
    <div className="module-search px-6 py-6 md:px-8 md:py-8">
      <header className="module-search-hero">
        <h1 className="module-search-title">Pick a module</h1>
        <p className="module-search-tagline">
          Every lookup opens its own workspace — IntelX, stealer logs, social
          pivots, AI analysis, and more.
        </p>
      </header>

      <div className="relative mb-8 max-w-xl">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          className="ui-input py-2.5 pl-10"
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter modules…"
          value={filter}
        />
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400" />
          Connected
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-red-500" />
          Not connected
        </span>
      </div>

      <div className="space-y-10">
        {filtered.map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 text-sm font-medium text-zinc-500">
              {section.title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => (
                <Link
                  key={item.slug}
                  className={`module-search-card group ${
                    section.title === "AI Intelligence" ? "module-search-card--ai" : ""
                  }`}
                  href={`/dashboard/search/${item.slug}`}
                >
                  <span className="module-search-card-section">{item.section}</span>
                  <div className="flex items-center gap-2">
                    {hasPlatformBrandIcon(item.name) && (
                      <PlatformBrandIcon className="size-5 shrink-0" name={item.name} />
                    )}
                    <ModuleStatusDot slug={item.slug} />
                    <h3 className="module-search-card-title">{item.name}</h3>
                  </div>
                  <p className="module-search-card-hint">{item.hint}</p>
                  <span className="module-search-card-cta">Open →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
