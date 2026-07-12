"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { TbSearch } from "react-icons/tb";

import {
  hasPlatformBrandIcon,
  PlatformBrandIcon,
} from "@/components/dashboard/platform-brand-icon";
import {
  AI_MODULE_EXPLAINERS,
  CATALOG_LANES,
  CATALOG_MODULE_COUNT,
  STANDARD_CATALOG_LANES,
  type CatalogLane,
  type CatalogModule,
} from "@/lib/featured-modules";
import { catalogSpanDataAttributes, getCatalogItemSpan } from "@/lib/catalog-grid";
import { hasWorkspaceDashboardAccess } from "@/lib/plans";
import { siteConfig } from "@/config/site";
import { useEffect, useState } from "react";

function CatalogIcon({ name }: { name: string }) {
  if (hasPlatformBrandIcon(name)) {
    return <PlatformBrandIcon className="size-[18px] shrink-0" name={name} />;
  }

  return <TbSearch aria-hidden className="size-[18px] shrink-0 text-zinc-400" />;
}

function ModuleRow({
  module,
  index,
  total,
  moduleGrid,
}: {
  module: CatalogModule;
  index: number;
  total: number;
  moduleGrid: "single" | "double" | "triple" | "quad";
}) {
  const span = getCatalogItemSpan(index, total, moduleGrid);

  return (
    <li className="catalog-module-item min-w-0" {...catalogSpanDataAttributes(span)}>
      <Link
        className="group flex h-full w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left no-underline transition hover:border-anya-accent-soft hover:bg-white/[0.05] md:gap-3.5 md:px-3.5"
        href={`/dashboard/search/${module.slug}`}
      >
        <span className="w-11 shrink-0 font-mono text-[0.6rem] tracking-wide text-zinc-600 transition group-hover:text-anya-accent">
          {module.code}
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/40">
          <CatalogIcon name={module.name} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white">
            {module.name}
          </span>
          <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
            {module.hint}
          </span>
        </span>
        <ArrowUpRight className="size-3.5 shrink-0 text-zinc-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-anya-accent" />
      </Link>
    </li>
  );
}

function CatalogLaneBlock({
  lane,
  moduleGrid = "single",
}: {
  lane: CatalogLane;
  moduleGrid?: "single" | "double" | "triple" | "quad";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm md:p-5">
      <div className="mb-3">
        <h3 className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {lane.label}
        </h3>
        {lane.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            {lane.description}
          </p>
        )}
      </div>
      <ul
        className={clsx(
          "catalog-module-grid m-0 list-none gap-1.5 p-0",
          moduleGrid === "double" && "catalog-module-grid--double",
          moduleGrid === "triple" && "catalog-module-grid--triple",
          moduleGrid === "quad" && "catalog-module-grid--quad catalog-module-grid--dense",
        )}
      >
        {lane.modules.map((module, index) => (
          <ModuleRow
            key={module.code}
            index={index}
            module={module}
            moduleGrid={moduleGrid}
            total={lane.modules.length}
          />
        ))}
      </ul>
    </div>
  );
}

const COMPACT_LANE_LABELS = new Set([
  "Stealer Intel",
  "Breach & Leaks",
  "Identity",
  "Network",
]);

export function IntelligenceModulesSection() {
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

  if (hideCatalog) {
    return null;
  }

  const aiModules = CATALOG_LANES.find((lane) => lane.isAi)?.modules ?? [];
  const compactLanes = STANDARD_CATALOG_LANES.filter((lane) =>
    COMPACT_LANE_LABELS.has(lane.label),
  );
  const financialLane = STANDARD_CATALOG_LANES.find(
    (lane) => lane.label === "Financial & Assets",
  );
  const platformsLane = STANDARD_CATALOG_LANES.find(
    (lane) => lane.label === "Platforms",
  );
  const datingLane = STANDARD_CATALOG_LANES.find(
    (lane) => lane.label === "Dating Apps",
  );

  return (
    <section className="relative z-20 mx-auto w-full max-w-6xl px-2 py-16 text-left md:py-20">
      <div className="mb-10 rounded-xl border border-white/10 bg-black/55 p-6 backdrop-blur-xl md:p-8">
        <span className="flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-anya-accent">
          <span className="h-px w-5 bg-anya-accent opacity-75" />
          trace catalog
        </span>
        <h2 className="mt-4 font-[family-name:var(--font-bruno-ace-sc)] text-3xl leading-tight tracking-wide text-white md:text-4xl">
          Every module.
          <br />
          <span className="text-zinc-500">One workspace.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300">
          {siteConfig.name} ships {CATALOG_MODULE_COUNT} live search nodes — AI
          synthesis, breach indexes, financial pivots, and platform lookups. Pick
          a lane below or open the workspace sidebar after login.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-white/10 pt-5">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xl font-semibold text-white">
              {CATALOG_MODULE_COUNT}
            </span>
            <span className="text-[0.68rem] uppercase tracking-wider text-zinc-500">
              search modules
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xl font-semibold text-white">4</span>
            <span className="text-[0.68rem] uppercase tracking-wider text-zinc-500">
              AI synthesizers
            </span>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-lg border border-anya-accent-soft bg-anya-accent/10 px-4 py-2.5 text-sm font-semibold text-anya-accent no-underline transition hover:bg-anya-accent/15 hover:text-anya-accent-hover"
            href={siteConfig.defaultWorkspacePath}
          >
            Open workspace
            <ArrowUpRight className="size-4 shrink-0" />
          </Link>
        </div>
      </div>

      <div className="mb-10">
        <div className="mb-5 flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-anya-accent-soft bg-anya-accent/10 text-anya-accent">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-white">AI Intelligence</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
              These four modules don&apos;t stop at a single API response. They
              fan out across breach, network, and social indexes, then write an
              investigator brief — sources included, noise stripped.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {aiModules.map((module) => (
            <Link
              key={module.code}
              className="group flex flex-col rounded-xl border border-white/10 bg-gradient-to-br from-anya-accent/8 via-black/50 to-black/60 p-4 no-underline transition hover:border-anya-accent-soft md:p-5"
              href={`/dashboard/search/${module.slug}`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-black/50">
                    <CatalogIcon name={module.name} />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold text-white">
                      {module.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-[0.62rem] text-anya-accent">
                      {module.code}
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-zinc-600 transition group-hover:text-anya-accent" />
              </div>
              <p className="text-xs font-medium text-zinc-400">{module.hint}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                {AI_MODULE_EXPLAINERS[module.slug] ?? module.summary}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {compactLanes.map((lane) => (
            <CatalogLaneBlock key={lane.label} lane={lane} />
          ))}
        </div>

        {financialLane && (
          <CatalogLaneBlock lane={financialLane} moduleGrid="quad" />
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          {platformsLane && (
            <CatalogLaneBlock lane={platformsLane} moduleGrid="quad" />
          )}

          {datingLane && (
            <CatalogLaneBlock lane={datingLane} moduleGrid="quad" />
          )}
        </div>
      </div>
    </section>
  );
}
