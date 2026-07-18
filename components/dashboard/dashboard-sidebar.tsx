"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Coffee,
  CreditCard,
  IdCard,
  Lock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
} from "lucide-react";
import clsx from "clsx";
import { useMemo, useState } from "react";

import {
  AI_SEARCH_MODULES,
  SEARCH_MODULE_SECTIONS,
  type SearchModuleDef,
} from "@/lib/search-modules";
import { checkModuleAccess, resolveUserPlan } from "@/lib/plans";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import {
  hasPlatformBrandIcon,
  PlatformBrandIcon,
} from "@/components/dashboard/platform-brand-icon";
import { ModuleStatusDot } from "@/components/dashboard/module-status-dot";
import { StaffBadge } from "@/components/dashboard/staff-badge";
import { useDashboardSidebar } from "@/components/dashboard/dashboard-sidebar-context";
import { getStaffRoleMeta } from "@/lib/staff-roles";
import { siteLogoClassName, siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
};

const SECTION_TOUR_ATTR: Record<string, string> = {
  "Stealer Intel": "section-stealer",
  "Breach & Leaks": "section-breach",
  Identity: "section-identity",
  Network: "section-network",
  "Financial & Assets": "section-financial",
  Platforms: "section-platforms",
  "Dating Apps": "section-dating",
};

const AI_BADGES: Record<string, string> = {
  "AI Search": "NEW",
  "AI Deep Scan": "NEW",
  "Crypto AI Analyse": "NEW",
};

const mainNav: NavItem[] = [
  { name: "Case ID", href: "/dashboard/cases", icon: IdCard },
];

const footerNav: NavItem[] = [
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "Pricing", href: "/pricing", icon: CreditCard },
  { name: "Coffee Support", href: "/dashboard/support", icon: Coffee },
];

function isNavActive(item: NavItem, pathname: string) {
  if (item.name === "Case ID") {
    return pathname.startsWith("/dashboard/cases");
  }
  if (item.name === "Settings") {
    return pathname.startsWith("/dashboard/settings");
  }
  if (item.name === "Admin Dashboard") {
    return pathname.startsWith("/dashboard/settings");
  }
  if (item.name === "Coffee Support") {
    return pathname.startsWith("/dashboard/support");
  }
  return pathname === item.href;
}

function isModuleActive(pathname: string, slug: string) {
  return pathname === `/dashboard/search/${slug}`;
}

function SidebarLink({
  item,
  pathname,
  coffee,
  collapsed,
  dataTour,
}: {
  item: NavItem;
  pathname: string;
  coffee?: boolean;
  collapsed?: boolean;
  dataTour?: string;
}) {
  const isActive = isNavActive(item, pathname);

  return (
    <Link
      className={clsx(
        "dash-nav-link",
        collapsed && "dash-nav-link--icon-only",
        isActive && "dash-nav-link-active",
        coffee && "dash-nav-link-coffee",
      )}
      data-tour={dataTour}
      href={item.href}
      prefetch
      title={item.name}
    >
      {collapsed ? (
        <item.icon className="size-[1.15rem] shrink-0" />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <item.icon className="size-4 shrink-0" />
            <span>{item.name}</span>
          </div>
          {item.badge && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-300">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

function ModuleIcon({ name }: { name: string }) {
  if (hasPlatformBrandIcon(name)) {
    return (
      <PlatformBrandIcon className="size-[1.15rem] shrink-0" name={name} />
    );
  }

  return <Search className="size-[1.15rem] shrink-0 text-zinc-400" />;
}

function ModuleLink({
  name,
  slug,
  hint,
  pathname,
  badge,
  locked,
  collapsed,
}: {
  name: string;
  slug: string;
  hint: string;
  pathname: string;
  badge?: string;
  locked?: boolean;
  collapsed?: boolean;
}) {
  const isActive = isModuleActive(pathname, slug);
  const title = locked ? `${name} — upgrade to unlock` : `${name} — ${hint}`;

  return (
    <Link
      className={clsx(
        "dash-nav-link w-full",
        collapsed && "dash-nav-link--icon-only",
        isActive && "dash-nav-link-active",
        locked && "opacity-45",
      )}
      href={`/dashboard/search/${slug}`}
      prefetch
      title={title}
    >
      {collapsed ? (
        <span className="dash-nav-link-icon-wrap">
          <ModuleIcon name={name} />
          <ModuleStatusDot
            className="dash-nav-link-status size-1.5"
            slug={slug}
          />
        </span>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-3">
            <ModuleIcon name={name} />
            <span className="truncate">{name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ModuleStatusDot className="size-1.5" slug={slug} />
            {locked && <Lock className="size-3 text-zinc-500" />}
            {badge && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-300">
                {badge}
              </span>
            )}
          </div>
        </>
      )}
    </Link>
  );
}

export function DashboardSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useDashboardUser();
  const plan = resolveUserPlan(profile);
  const balance = profile.balance ?? 0;
  const staffMeta = getStaffRoleMeta(profile.staffRole);
  const { collapsed, toggleCollapsed } = useDashboardSidebar();
  const [moduleQuery, setModuleQuery] = useState("");

  const footerItems = useMemo<NavItem[]>(() => {
    const items = profile.canManageWorkspace
      ? footerNav.filter((item) => item.name !== "Settings")
      : [...footerNav];

    if (profile.canManageWorkspace) {
      items.unshift({
        name: "Admin Dashboard",
        href: "/dashboard/settings#admin",
        icon: Shield,
        badge: "ADMIN",
      });
    }

    return items;
  }, [profile.canManageWorkspace]);

  const accountHref = profile.canManageWorkspace
    ? "/dashboard/settings#admin"
    : "/dashboard/settings";

  const isModuleLocked = (slug: string) =>
    !checkModuleAccess(plan, slug, { balance }).allowed;

  const query = moduleQuery.toLowerCase();

  const filteredAiItems = AI_SEARCH_MODULES.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      item.hint.toLowerCase().includes(query),
  );

  const filteredSections = SEARCH_MODULE_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.hint.toLowerCase().includes(query),
    ),
  })).filter((section) => section.items.length > 0);

  const collapsedModules = useMemo(
    (): Array<SearchModuleDef & { badge?: string }> => [
      ...filteredAiItems.map((item) => ({
        ...item,
        badge: AI_BADGES[item.name],
      })),
      ...filteredSections.flatMap((section) => section.items),
    ],
    [filteredAiItems, filteredSections],
  );

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <aside className={clsx("dash-sidebar", collapsed && "dash-sidebar--collapsed")}>
      <div className="dash-sidebar-header">
        <Link
          className="dash-sidebar-brand min-w-0 flex-1"
          href={siteConfig.defaultWorkspacePath}
          prefetch
          title={`${siteConfig.name} dashboard`}
        >
          <Image
            alt={siteConfig.name}
            className={siteLogoClassName}
            height={36}
            src={siteLogoSrc}
            unoptimized
            width={36}
          />
          {!collapsed && (
            <span className="[font-family:var(--font-bruno-ace-sc)]">
              {siteConfig.name}
            </span>
          )}
        </Link>
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="dash-sidebar-toggle shrink-0"
          onClick={toggleCollapsed}
          type="button"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="border-b border-white/6 px-4 pb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              className="dash-input dash-input--icon py-2 pr-3"
              data-tour="sidebar-filter"
              onChange={(event) => setModuleQuery(event.target.value)}
              placeholder="Filter modules..."
              value={moduleQuery}
            />
          </div>
        </div>
      )}

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4" data-tour="sidebar-scroll">
        <div className="space-y-1">
          {mainNav.map((item) => (
            <SidebarLink
              key={item.name}
              collapsed={collapsed}
              dataTour={item.name === "Case ID" ? "case-id" : undefined}
              item={item}
              pathname={pathname}
            />
          ))}
        </div>

        {collapsed ? (
          <>
            <div className="dash-sidebar-section-divider" />
            <div className="space-y-1">
              {collapsedModules.map((item) => (
                <ModuleLink
                  key={item.slug}
                  badge={item.badge}
                  collapsed
                  hint={item.hint}
                  locked={isModuleLocked(item.slug)}
                  name={item.name}
                  pathname={pathname}
                  slug={item.slug}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            {filteredAiItems.length > 0 && (
              <div data-tour="section-ai">
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  AI Intelligence
                </p>
                <div className="space-y-0.5">
                  {filteredAiItems.map((item) => (
                    <ModuleLink
                      key={item.slug}
                      badge={AI_BADGES[item.name]}
                      hint={item.hint}
                      locked={isModuleLocked(item.slug)}
                      name={item.name}
                      pathname={pathname}
                      slug={item.slug}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredSections.map((section) => (
              <div
                data-tour={SECTION_TOUR_ATTR[section.title]}
                key={section.title}
              >
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <ModuleLink
                      key={item.slug}
                      hint={item.hint}
                      locked={isModuleLocked(item.slug)}
                      name={item.name}
                      pathname={pathname}
                      slug={item.slug}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="space-y-1 border-t border-white/6 px-3 py-3">
        {footerItems.map((item) => (
          <SidebarLink
            key={item.name}
            coffee={item.name === "Coffee Support"}
            collapsed={collapsed}
            dataTour={
              item.name === "Settings"
                ? "footer-settings"
                : item.name === "Admin Dashboard"
                  ? "footer-admin"
                  : undefined
            }
            item={item}
            pathname={pathname}
          />
        ))}
      </div>

      <div className="border-t border-white/6 p-4">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Link
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-semibold text-white ring-2 ring-transparent"
              href={accountHref}
              title={username}
            >
              {username.charAt(0).toUpperCase()}
            </Link>
            <button
              aria-label="Log out"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white"
              onClick={handleLogout}
              type="button"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/30 px-3 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  "flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-semibold text-white ring-2",
                  staffMeta?.avatarRingClass ?? "ring-transparent",
                )}
              >
                {username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white">{username}</p>
                  <StaffBadge role={profile.staffRole} size="xs" />
                </div>
                <p className="text-[10px] text-zinc-500">
                  {staffMeta ? `${staffMeta.label} staff` : "Investigator"}
                </p>
              </div>
            </div>
            <button
              aria-label="Log out"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white"
              onClick={handleLogout}
              type="button"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
