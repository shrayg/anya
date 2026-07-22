"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, Search } from "lucide-react";

import {
  hasPlatformBrandIcon,
  PlatformBrandIcon,
} from "@/components/dashboard/platform-brand-icon";
import { ModuleStatusDot } from "@/components/dashboard/module-status-dot";

export type ModuleCatalogItem = {
  name: string;
  slug: string;
  hint: string;
  summary?: string;
  code?: string;
  /** In-module tools counted toward marketed totals. */
  toolCount?: number;
};

export type ModuleCatalogSection = {
  title: string;
  description?: string;
  items: ModuleCatalogItem[];
  featured?: boolean;
};

function ModuleIcon({ name }: { name: string }) {
  if (hasPlatformBrandIcon(name)) {
    return (
      <PlatformBrandIcon
        muted
        className="size-5 shrink-0 text-zinc-400"
        name={name}
      />
    );
  }

  return <Search aria-hidden className="size-5 shrink-0 text-zinc-500" />;
}

export function ModuleCatalogTile({
  item,
  featured = false,
  showStatus = false,
}: {
  item: ModuleCatalogItem;
  featured?: boolean;
  showStatus?: boolean;
}) {
  return (
    <Link
      className={clsx("mod-tile group", featured && "mod-tile--featured")}
      href={`/dashboard/search/${item.slug}`}
    >
      <div className="mod-tile-top">
        <div className="mod-tile-identity">
          <span className="mod-tile-icon">
            <ModuleIcon name={item.name} />
          </span>
          {item.code ? (
            <span className="mod-tile-code">{item.code}</span>
          ) : null}
        </div>
        <span className="mod-tile-meta">
          {showStatus ? (
            <ModuleStatusDot slug={item.slug} />
          ) : (
            <ArrowUpRight className="mod-tile-arrow" />
          )}
        </span>
      </div>

      <div className="mod-tile-body">
        <h3 className="mod-tile-title">{item.name}</h3>
        <p className="mod-tile-hint">{item.hint}</p>
        {featured && item.summary ? (
          <p className="mod-tile-summary">{item.summary}</p>
        ) : null}
      </div>
    </Link>
  );
}

export function ModuleCatalogSectionBlock({
  section,
  showStatus = false,
}: {
  section: ModuleCatalogSection;
  showStatus?: boolean;
}) {
  return (
    <section
      className={clsx(
        "mod-section",
        section.featured && "mod-section--featured",
      )}
    >
      <header className="mod-section-head">
        <div>
          <h2 className="mod-section-title">{section.title}</h2>
          {section.description ? (
            <p className="mod-section-desc">{section.description}</p>
          ) : null}
        </div>
        <span className="mod-section-count">{section.items.length}</span>
      </header>

      <div
        className={clsx(
          "mod-grid",
          section.featured ? "mod-grid--featured" : "mod-grid--standard",
        )}
      >
        {section.items.map((item) => (
          <ModuleCatalogTile
            key={item.slug}
            featured={section.featured}
            item={item}
            showStatus={showStatus}
          />
        ))}
      </div>
    </section>
  );
}

export function ModuleCatalog({
  sections,
  showStatus = false,
  emptyLabel = "No modules match that filter.",
  variant = "cards",
}: {
  sections: ModuleCatalogSection[];
  showStatus?: boolean;
  emptyLabel?: string;
  variant?: "cards" | "mindmap";
}) {
  if (sections.length === 0) {
    return (
      <div className="mod-empty">
        <p>{emptyLabel}</p>
      </div>
    );
  }

  if (variant === "mindmap") {
    const moduleCount = sections.reduce(
      (sum, section) => sum + section.items.length,
      0,
    );

    return (
      <div className="mod-map" role="list">
        <div className="mod-map-rail" aria-hidden>
          <span />
          <p>
            {moduleCount} modules · {sections.length} lanes
          </p>
          <span />
        </div>

        <div className="mod-map-grid">
          {sections.map((section, index) => (
            <section
              key={section.title}
              className={clsx(
                "mod-map-node",
                `mod-map-node--n${(index % 3) + 1}`,
                section.featured && "mod-map-node--featured",
              )}
              role="listitem"
            >
              <header className="mod-map-node-head">
                <h3>{section.title}</h3>
                <span>{section.items.length}</span>
              </header>
              {section.description ? (
                <p className="mod-map-node-desc">{section.description}</p>
              ) : null}
              <div className="mod-map-node-items">
                {section.items.map((item) => (
                  <Link
                    key={item.slug}
                    className="mod-map-item"
                    href={`/dashboard/search/${item.slug}`}
                  >
                    <span className="mod-map-item-icon">
                      <ModuleIcon name={item.name} />
                    </span>
                    <span className="mod-map-item-copy">
                      <strong>{item.name}</strong>
                      <small>{item.hint}</small>
                    </span>
                    <span className="mod-map-item-meta">
                      {showStatus ? (
                        <ModuleStatusDot slug={item.slug} />
                      ) : (
                        <ArrowUpRight className="size-3.5" />
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mod-catalog">
      {sections.map((section) => (
        <ModuleCatalogSectionBlock
          key={section.title}
          section={section}
          showStatus={showStatus}
        />
      ))}
    </div>
  );
}
