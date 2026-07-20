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
};

export type ModuleCatalogSection = {
  title: string;
  description?: string;
  items: ModuleCatalogItem[];
  featured?: boolean;
};

function ModuleIcon({ name }: { name: string }) {
  if (hasPlatformBrandIcon(name)) {
    return <PlatformBrandIcon className="size-5 shrink-0" name={name} />;
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
}: {
  sections: ModuleCatalogSection[];
  showStatus?: boolean;
  emptyLabel?: string;
}) {
  if (sections.length === 0) {
    return (
      <div className="mod-empty">
        <p>{emptyLabel}</p>
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
