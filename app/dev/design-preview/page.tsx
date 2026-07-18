"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Coffee,
  CreditCard,
  Download,
  FolderPlus,
  Home,
  IdCard,
  Search,
  Settings,
  Users,
} from "lucide-react";
import clsx from "clsx";

import { HomeBackground } from "@/components/home-background";
import { IntelSignalLoader } from "@/components/dashboard/intel-signal-loader";
import {
  hasPlatformBrandIcon,
  PlatformBrandIcon,
} from "@/components/dashboard/platform-brand-icon";
import { SEARCH_MODULE_SECTIONS } from "@/lib/search-modules";
import { siteLogoClassName, siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";

function PreviewModuleIcon({ name }: { name: string }) {
  if (hasPlatformBrandIcon(name)) {
    return <PlatformBrandIcon className="size-4 shrink-0" name={name} />;
  }
  return <Search className="size-4 shrink-0 text-zinc-400" />;
}

type View = "instagram" | "hub" | "home";

/**
 * Full-bleed production mock for visual QA.
 * http://localhost:3000/dev/design-preview
 */
export default function DesignPreviewPage() {
  const [view, setView] = useState<View>("instagram");
  const [scanning, setScanning] = useState(true);
  const [query, setQuery] = useState("https://www.instagram.com/keeganhoyne/");

  const sections = useMemo(
    () =>
      SEARCH_MODULE_SECTIONS.map((section) => ({
        ...section,
        items: section.items.slice(0, 5),
      })),
    [],
  );

  return (
    <div className="dash-shell text-white">
      <HomeBackground />

      {/* Local-only chrome */}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 rounded-xl border border-white/12 bg-black/80 p-3 shadow-2xl backdrop-blur-xl md:flex-row md:items-center">
        <p className="px-1 text-[11px] leading-snug text-zinc-400">
          <span className="font-semibold text-[var(--anya-blush)]">
            Design preview
          </span>{" "}
          · full production layout mock · not live data
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["instagram", "Module"],
              ["hub", "Hub"],
              ["home", "Marketing"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={clsx(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold",
                view === id
                  ? "bg-[var(--anya-blush)] text-[#14110f]"
                  : "bg-white/8 text-zinc-300 hover:bg-white/12",
              )}
              onClick={() => setView(id)}
              type="button"
            >
              {label}
            </button>
          ))}
          <Link className="ui-btn ui-btn-ghost !px-2 !py-1 !text-[11px]" href="/">
            Real site
          </Link>
        </div>
      </div>

      {view === "home" ? (
        <MarketingMock />
      ) : (
        <>
          <aside className="dash-sidebar" data-tour="sidebar">
            <div className="dash-sidebar-brand">
          <Image
            alt=""
            className={siteLogoClassName}
            height={36}
            src={siteLogoSrc}
            unoptimized
            width={36}
          />
          <span>{siteConfig.name}</span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4 pt-1">
              <Link
                className={clsx(
                  "dash-nav-link",
                  view === "hub" && "dash-nav-link-active",
                )}
                href="#hub"
                onClick={(e) => {
                  e.preventDefault();
                  setView("hub");
                }}
              >
                <span className="flex items-center gap-2">
                  <IdCard className="size-4 opacity-70" />
                  Search Hub
                </span>
              </Link>

              {sections.map((section) => (
                <div key={section.title} className="mt-2">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    {section.title}
                  </p>
                  {section.items.map((item) => {
                    const active =
                      view === "instagram" && item.slug === "instagram";
                    return (
                      <button
                        key={item.slug}
                        className={clsx(
                          "dash-nav-link w-full text-left",
                          active && "dash-nav-link-active",
                        )}
                        onClick={() => {
                          setView("instagram");
                          setScanning(true);
                        }}
                        type="button"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <PreviewModuleIcon name={item.name} />
                          <span className="truncate">{item.name}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}

              <div className="dash-sidebar-section-divider mt-3" />
              <Link className="dash-nav-link" href="/dashboard/cases">
                <span className="flex items-center gap-2">
                  <IdCard className="size-4 opacity-70" />
                  Case ID
                </span>
              </Link>
              <Link className="dash-nav-link" href="/dashboard/settings">
                <span className="flex items-center gap-2">
                  <Settings className="size-4 opacity-70" />
                  Settings
                </span>
              </Link>
              <Link className="dash-nav-link" href="/pricing">
                <span className="flex items-center gap-2">
                  <CreditCard className="size-4 opacity-70" />
                  Pricing
                </span>
              </Link>
              <Link className="dash-nav-link dash-nav-link-coffee" href="/dashboard/support">
                <span className="flex items-center gap-2">
                  <Coffee className="size-4 opacity-70" />
                  Coffee Support
                </span>
              </Link>
            </div>
          </aside>

          <main className="dash-main" data-tour="main-content">
            {view === "hub" ? (
              <HubMock onOpenInstagram={() => setView("instagram")} />
            ) : (
              <div className="module-search px-6 py-6 md:px-8 md:py-8">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <button
                    className="module-search-back inline-flex items-center gap-1.5"
                    onClick={() => setView("hub")}
                    type="button"
                  >
                    ← Search Hub
                  </button>
                  <Link className="module-search-back inline-flex items-center gap-1.5" href="/">
                    <Home className="size-3.5" />
                    Home
                  </Link>
                </div>

                <header className="module-search-hero">
                  <p className="module-search-section">Platforms</p>
                  <h1 className="module-search-title mt-1 flex items-center gap-2.5">
                    <PreviewModuleIcon name="Instagram" />
                    Instagram
                  </h1>
                  <p className="module-search-tagline">
                    Profile intel plus follower and following list export.
                  </p>
                  <p className="module-search-hint">
                    Instagram user or profile link.
                  </p>
                </header>

                <section className="ui-panel">
                  <div className="ui-panel-body">
                    <form
                      className="flex flex-col gap-3 sm:flex-row sm:items-start"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setScanning(true);
                      }}
                    >
                      <input
                        className="ui-input flex-1 font-mono text-sm"
                        onChange={(e) => setQuery(e.target.value)}
                        value={query}
                      />
                      <button
                        className="ui-btn ui-btn-primary shrink-0 sm:min-w-[6.5rem]"
                        disabled={scanning}
                        type="submit"
                      >
                        {scanning ? "Scanning…" : "Run"}
                      </button>
                    </form>

                    <IntelSignalLoader
                      active={scanning}
                      title="Instagram"
                    />

                    {!scanning ? (
                      <div className="mt-5 border-t border-white/8 pt-5">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-zinc-400">
                            Instagram · keeganhoyne
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button className="ui-btn ui-btn-ghost" type="button">
                              <Download className="size-3.5" />
                              Export all data
                            </button>
                            <button className="ui-btn ui-btn-primary" type="button">
                              <FolderPlus className="size-3.5" />
                              File intel
                            </button>
                          </div>
                        </div>

                        <div className="mb-4 flex flex-wrap gap-2">
                          {["Profile", "Bubble map", "Mutuals", "Followers", "Leaks"].map(
                            (tab, i) => (
                              <button
                                key={tab}
                                className={clsx(
                                  "ui-tab",
                                  i === 0 && "ui-tab--active",
                                )}
                                type="button"
                              >
                                {tab}
                              </button>
                            ),
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {[
                            ["Username", "@keeganhoyne"],
                            ["Followers", "12,480"],
                            ["Following", "891"],
                            ["Posts", "342"],
                            ["Private", "No"],
                            ["Verified", "No"],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                {label}
                              </p>
                              <p className="mt-1 font-mono text-sm text-zinc-100">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>

                        <button
                          className="ui-btn ui-btn-ghost mt-5"
                          onClick={() => setScanning(true)}
                          type="button"
                        >
                          Replay scan animation
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 flex justify-end">
                        <button
                          className="ui-btn ui-btn-ghost"
                          onClick={() => setScanning(false)}
                          type="button"
                        >
                          Simulate results ready
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}

function HubMock({ onOpenInstagram }: { onOpenInstagram: () => void }) {
  return (
    <div className="module-search module-search-hub px-6 py-6 md:px-8 md:py-8">
      <header className="module-search-hero mb-8">
        <span className="dash-badge">Workspace</span>
        <h1 className="dash-title">Search Hub</h1>
        <p className="dash-subtitle">
          Pick a module. Every run uses the shared signal lattice while indexes
          respond — same chrome you&apos;ll ship to production.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SEARCH_MODULE_SECTIONS.flatMap((section) =>
          section.items.slice(0, 3).map((item) => (
            <button
              key={item.slug}
              className="module-search-card text-left"
              onClick={() => {
                if (item.slug === "instagram") onOpenInstagram();
                else onOpenInstagram();
              }}
              type="button"
            >
              <p className="module-search-card-section">{section.title}</p>
              <p className="module-search-card-title">{item.name}</p>
              <p className="module-search-card-hint">{item.tagline}</p>
              <span className="module-search-card-cta">Open module →</span>
            </button>
          )),
        )}
      </div>
    </div>
  );
}

function MarketingMock() {
  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <Image
            alt=""
            className={siteLogoClassName}
            height={32}
            src={siteLogoSrc}
            width={32}
          />
          <span className="font-[family-name:var(--font-bruno-ace-sc)] text-sm tracking-wide">
            {siteConfig.name}
          </span>
        </div>
        <div className="flex gap-2">
          <Link className="ui-btn ui-btn-ghost" href="/auth?action=login">
            Sign in
          </Link>
          <Link className="ui-btn ui-btn-primary" href="/auth?action=register">
            Create account
          </Link>
        </div>
      </header>

      <section className="relative z-20 flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-24 pt-10 text-center">
        <div className="flex max-w-4xl flex-col items-center gap-5">
          <Image
              alt=""
              className={siteLogoClassName}
              height={64}
              src={siteLogoSrc}
              unoptimized
              width={64}
            />
          <h1 className="font-[family-name:var(--font-bruno-ace-sc)] text-5xl tracking-normal md:text-8xl">
            {siteConfig.name}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-300 md:text-xl">
            {siteConfig.tagline}. Authorized lookups across exposure and social
            modules — filed into cases for investigators.
          </p>
        </div>

        <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
          <input
            className="ui-input flex-1 text-left"
            placeholder="Email, username, domain…"
            readOnly
          />
          <button className="ui-btn ui-btn-primary sm:min-w-[7rem]" type="button">
            Search
          </button>
        </div>

        <div className="grid w-full max-w-3xl gap-3 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-xl">
            <Users className="size-5 shrink-0 text-[var(--anya-blush)]" />
            <span className="text-sm text-zinc-300">
              Discord, Roblox, breaches, stealer logs, and dozens more modules.
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-xl">
            <FolderPlus className="size-5 shrink-0 text-emerald-300" />
            <span className="text-sm text-zinc-300">
              File intel into cases. Export clean. Same lattice on every run.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
