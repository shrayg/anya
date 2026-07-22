"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  CreditCard,
  IdCard,
  LifeBuoy,
  Lock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Shield,
  UserRound,
} from "lucide-react";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/csrf-client";
import {
  SEARCH_AUTOFILL_SHIELD,
  unlockAutofillShield,
} from "@/lib/search-autofill-shield";
import {
  AI_SEARCH_MODULES,
  getHubSections,
  type SearchModuleDef,
} from "@/lib/search-modules";
import { isCryptoIntelEnabled } from "@/lib/crypto-intel/enabled";
import { checkModuleAccess, resolveUserPlan } from "@/lib/plans";
import { getPlanDisplayLabel } from "@/lib/account-plan";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import {
  SearchJobsSidebarButton,
} from "@/components/dashboard/search-jobs-context";
import {
  hasPlatformBrandIcon,
  PlatformBrandIcon,
} from "@/components/dashboard/platform-brand-icon";
import { ModuleStatusDot } from "@/components/dashboard/module-status-dot";
import { StaffBadge } from "@/components/dashboard/staff-badge";
import { useDashboardSidebar } from "@/components/dashboard/dashboard-sidebar-context";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { getStaffRoleMeta } from "@/lib/staff-roles";
import { siteLogoClassName, siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
};

const CATEGORIES_STORAGE_KEY = "anya-sidebar-categories";

const SECTION_TOUR_ATTR: Record<string, string> = {
  "Stealer Intel": "section-stealer",
  "Breach & Leaks": "section-breach",
  Identity: "section-identity",
  Network: "section-network",
  "Financial & Assets": "section-financial",
  "Crypto Intel": "section-crypto-intel",
  Platforms: "section-platforms",
  "Dating Apps": "section-dating",
};

function toSectionId(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readCategoryOpenMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const map: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") map[key] = value;
    }
    return map;
  } catch {
    return {};
  }
}

const AI_BADGES: Record<string, string> = {
  "AI Search": "NEW",
  "AI Deep Scan": "NEW",
  "Crypto Intel": "NEW",
};

const mainNav: NavItem[] = [
  { name: "Case ID", href: "/dashboard/cases", icon: IdCard },
];

const footerNav: NavItem[] = [
  { name: "Account", href: "/dashboard/account", icon: UserRound },
  { name: "Support", href: "/dashboard/support", icon: LifeBuoy },
  { name: "Pricing", href: "/pricing", icon: CreditCard },
  { name: "Status", href: "/status", icon: Activity },
];

function isNavActive(item: NavItem, pathname: string) {
  if (item.name === "Case ID") {
    return pathname.startsWith("/dashboard/cases");
  }
  if (item.name === "Account") {
    return pathname.startsWith("/dashboard/account");
  }
  if (
    item.name === "Settings" ||
    item.name === "Admin" ||
    item.name === "Helper"
  ) {
    return pathname.startsWith("/dashboard/settings");
  }
  if (item.name === "Admin Dashboard" || item.name === "Helper Dashboard") {
    return pathname.startsWith("/dashboard/settings");
  }
  if (item.name === "Support") {
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
  collapsed,
  dataTour,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  dataTour?: string;
}) {
  const isActive = isNavActive(item, pathname);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={clsx(collapsed && "dash-sidebar-menu-button--icon-only")}
        isActive={isActive}
      >
        <Link
          prefetch
          data-tour={dataTour}
          href={item.href}
          title={item.name}
        >
          <div>
            <item.icon />
            <span className="dash-sidebar-label">{item.name}</span>
          </div>
          {item.badge ? (
            <SidebarMenuBadge className="dash-sidebar-label-meta">
              {item.badge}
            </SidebarMenuBadge>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ModuleIcon({ name }: { name: string }) {
  if (hasPlatformBrandIcon(name)) {
    return (
      <PlatformBrandIcon
        muted
        className="size-4 shrink-0 text-zinc-400"
        name={name}
      />
    );
  }

  return <Search className="size-4 shrink-0 text-zinc-400" />;
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
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={clsx(
          collapsed && "dash-sidebar-menu-button--icon-only",
          locked && "opacity-45",
        )}
        isActive={isActive}
      >
        <Link prefetch href={`/dashboard/search/${slug}`} title={title}>
          <div className={clsx(collapsed && "dash-sidebar-menu-icon-wrap")}>
            <ModuleIcon name={name} />
            <span className="dash-sidebar-label">{name}</span>
            {collapsed ? (
              <ModuleStatusDot
                className="dash-sidebar-menu-status size-1.5"
                slug={slug}
              />
            ) : null}
          </div>
          <div className="dash-sidebar-label-meta flex shrink-0 items-center gap-1.5">
            {!collapsed ? (
              <ModuleStatusDot className="size-1.5" slug={slug} />
            ) : null}
            {locked ? <Lock className="size-3 text-zinc-500" /> : null}
            {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function CollapsibleCategory({
  title,
  sectionId,
  open,
  onToggle,
  dataTour,
  children,
}: {
  title: string;
  sectionId: string;
  open: boolean;
  onToggle: () => void;
  dataTour?: string;
  children: React.ReactNode;
}) {
  const panelId = `dash-sidebar-category-${sectionId}`;

  return (
    <SidebarGroup data-tour={dataTour}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="dash-sidebar-category-toggle"
        data-sidebar="group-label"
        title={open ? `Collapse ${title}` : `Expand ${title}`}
        type="button"
        onClick={onToggle}
      >
        <span>{title}</span>
        <ChevronDown
          aria-hidden
          className={clsx(
            "dash-sidebar-category-chevron size-3.5",
            open && "dash-sidebar-category-chevron--open",
          )}
        />
      </button>
      <div
        className={clsx(
          "dash-sidebar-category-body",
          !open && "dash-sidebar-category-body--collapsed",
        )}
        id={panelId}
      >
        <div className="dash-sidebar-category-body-inner">
          <SidebarGroupContent>
            <SidebarMenu>{children}</SidebarMenu>
          </SidebarGroupContent>
        </div>
      </div>
    </SidebarGroup>
  );
}

export function DashboardSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useDashboardUser();
  const plan = resolveUserPlan(profile);
  const planLabel = getPlanDisplayLabel(profile);
  const balance = profile.balance ?? 0;
  const staffMeta = getStaffRoleMeta(profile.staffRole);
  const {
    collapsed,
    isResizing,
    toggleCollapsed,
    footerCollapsed,
    toggleFooterCollapsed,
  } = useDashboardSidebar();
  const [moduleQuery, setModuleQuery] = useState("");
  const [categoryOpen, setCategoryOpen] = useState<Record<string, boolean>>({});
  const [categoriesReady, setCategoriesReady] = useState(false);
  /** Icon-rail nav tree lags width collapse so labels can fade first. */
  const [railContent, setRailContent] = useState(collapsed);

  useEffect(() => {
    setCategoryOpen(readCategoryOpenMap());
    setCategoriesReady(true);
  }, []);

  useEffect(() => {
    if (!collapsed) {
      setRailContent(false);
      return;
    }

    // Hydrate / post-animation: snap to rail. Mid-collapse: delay for label fade.
    if (!isResizing) {
      setRailContent(true);
      return;
    }

    const timer = window.setTimeout(() => setRailContent(true), 160);
    return () => window.clearTimeout(timer);
  }, [collapsed, isResizing]);

  const isCategoryOpen = useCallback(
    (sectionId: string) => {
      // While filtering, keep matching sections visible.
      if (moduleQuery.trim()) return true;
      if (!categoriesReady) return true;
      return categoryOpen[sectionId] !== false;
    },
    [categoriesReady, categoryOpen, moduleQuery],
  );

  const toggleCategory = useCallback((sectionId: string) => {
    setCategoryOpen((current) => {
      const nextOpen = current[sectionId] === false;
      const next = { ...current, [sectionId]: nextOpen };

      try {
        localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }

      return next;
    });
  }, []);

  const footerItems = useMemo<NavItem[]>(() => {
    const items = [...footerNav];

    if (profile.canManageWorkspace) {
      items.unshift({
        name: "Admin",
        href: "/dashboard/settings#admin",
        icon: Shield,
        badge: "ADMIN",
      });
    } else if (profile.canAccessHelperDashboard) {
      items.unshift({
        name: "Helper",
        href: "/dashboard/settings#helper",
        icon: Shield,
        badge: "HELPER",
      });
    }

    return items;
  }, [profile.canAccessHelperDashboard, profile.canManageWorkspace]);

  const accountHref = "/dashboard/account";

  const isModuleLocked = (slug: string) =>
    !checkModuleAccess(plan, slug, { balance }).allowed;

  const query = moduleQuery.toLowerCase();

  const filteredAiItems = AI_SEARCH_MODULES.filter((item) => {
    if (isCryptoIntelEnabled() && item.slug === "crypto-ai") return false;

    return (
      item.name.toLowerCase().includes(query) ||
      item.hint.toLowerCase().includes(query)
    );
  });

  const hubSections = getHubSections().filter(
    (section) => section.title !== "AI Intelligence",
  );

  const filteredSections = hubSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !item.comingSoon &&
          (item.name.toLowerCase().includes(query) ||
            item.hint.toLowerCase().includes(query)),
      ),
    }))
    .filter((section) => section.items.length > 0);

  const collapsedModules = useMemo(
    (): Array<SearchModuleDef & { badge?: string }> => [
      ...filteredAiItems.map((item) => ({
        ...item,
        badge: AI_BADGES[item.name],
      })),
      ...filteredSections.flatMap((section) =>
        section.items.map((item) => ({
          ...item,
          badge: AI_BADGES[item.name],
        })),
      ),
    ],
    [filteredAiItems, filteredSections],
  );

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <Sidebar
      className={clsx(collapsed && "dash-sidebar--collapsed")}
      data-collapsed={collapsed ? "true" : undefined}
      data-resizing={isResizing ? "true" : undefined}
    >
      <LiquidGlassCard
        blurIntensity="md"
        borderRadius="16px"
        className="dash-sidebar-liquid-glass"
        draggable={false}
        glowIntensity="none"
        shadowIntensity="xs"
      >
        <SidebarHeader>
          <div className="dash-sidebar-header-row">
            <SidebarMenuButton asChild size="lg">
              <Link
                prefetch
                className={clsx(
                  "dash-sidebar-brand",
                  collapsed && "dash-sidebar-brand--collapsed",
                )}
                href={siteConfig.defaultWorkspacePath}
                title={`${siteConfig.name} dashboard`}
              >
                <Image
                  unoptimized
                  alt={siteConfig.name}
                  className={siteLogoClassName}
                  height={32}
                  src={siteLogoSrc}
                  width={32}
                />
                <span className="dash-sidebar-label [font-family:var(--font-bruno-ace-sc)]">
                  {siteConfig.name}
                </span>
              </Link>
            </SidebarMenuButton>

            <button
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="dash-sidebar-toggle"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              type="button"
              onClick={toggleCollapsed}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          </div>

          <div
            className={clsx(
              "dash-sidebar-filter",
              collapsed && "dash-sidebar-filter--collapsed",
            )}
          >
            <div className="dash-sidebar-filter-inner">
              <div className="relative px-0.5 pb-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <SidebarInput
                  {...SEARCH_AUTOFILL_SHIELD}
                  readOnly
                  data-tour="sidebar-filter"
                  name="module-filter"
                  placeholder="Filter modules..."
                  tabIndex={collapsed ? -1 : undefined}
                  type="text"
                  value={moduleQuery}
                  onChange={(event) => setModuleQuery(event.target.value)}
                  onFocus={unlockAutofillShield}
                />
              </div>
              <div className="px-0.5 pb-1">
                <SearchJobsSidebarButton collapsed={collapsed} />
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent data-tour="sidebar-scroll">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNav.map((item) => (
                  <SidebarLink
                    key={item.name}
                    collapsed={collapsed}
                    dataTour={item.name === "Case ID" ? "case-id" : undefined}
                    item={item}
                    pathname={pathname}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {railContent ? (
            <>
              <div className="dash-sidebar-section-divider" />
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {collapsedModules.map((item) => (
                      <ModuleLink
                        key={item.slug}
                        collapsed
                        badge={item.badge}
                        hint={item.hint}
                        locked={isModuleLocked(item.slug)}
                        name={item.name}
                        pathname={pathname}
                        slug={item.slug}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          ) : (
            <>
              {filteredAiItems.length > 0 && (
                <CollapsibleCategory
                  dataTour="section-ai"
                  open={isCategoryOpen("ai-intelligence")}
                  sectionId="ai-intelligence"
                  title="AI Intelligence"
                  onToggle={() => toggleCategory("ai-intelligence")}
                >
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
                </CollapsibleCategory>
              )}

              {filteredSections.map((section) => {
                const sectionId = toSectionId(section.title);

                return (
                  <CollapsibleCategory
                    key={section.title}
                    dataTour={SECTION_TOUR_ATTR[section.title]}
                    open={isCategoryOpen(sectionId)}
                    sectionId={sectionId}
                    title={section.title}
                    onToggle={() => toggleCategory(sectionId)}
                  >
                    {section.items.map((item) => (
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
                  </CollapsibleCategory>
                );
              })}
            </>
          )}
        </SidebarContent>

        <SidebarFooter>
          <div
            className={clsx(
              "dash-sidebar-utility",
              footerCollapsed && "dash-sidebar-utility--collapsed",
              collapsed && "dash-sidebar-utility--rail",
            )}
          >
            <button
              aria-controls="dash-sidebar-footer-links"
              aria-expanded={!footerCollapsed}
              aria-label={
                footerCollapsed
                  ? "Show account and more links"
                  : "Minimize account and more links"
              }
              className={clsx(
                "dash-sidebar-minimize",
                collapsed && "dash-sidebar-minimize--icon-only",
              )}
              title={
                footerCollapsed
                  ? "Show Account, Support, and more"
                  : "Hide Account, Support, and more"
              }
              type="button"
              onClick={toggleFooterCollapsed}
            >
              {footerCollapsed ? (
                <>
                  <ChevronUp className="size-4 shrink-0" />
                  <span className="dash-sidebar-label">Account & more</span>
                </>
              ) : (
                <>
                  <ChevronsLeft className="size-4 shrink-0" />
                  <span className="dash-sidebar-label">Minimize</span>
                </>
              )}
            </button>

            <div
              className={clsx(
                "dash-sidebar-footer-nav",
                footerCollapsed && "dash-sidebar-footer-nav--collapsed",
              )}
              id="dash-sidebar-footer-links"
            >
              <div className="dash-sidebar-footer-nav-inner">
                <SidebarMenu>
                  {footerItems.map((item) => (
                    <SidebarLink
                      key={item.name}
                      collapsed={collapsed}
                      dataTour={
                        item.name === "Account"
                          ? "footer-settings"
                          : item.name === "Admin"
                            ? "footer-admin"
                            : undefined
                      }
                      item={item}
                      pathname={pathname}
                    />
                  ))}
                </SidebarMenu>
              </div>
            </div>
          </div>

          <div
            className={clsx(
              "dash-sidebar-user",
              collapsed && "dash-sidebar-user--collapsed",
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Link
                className={clsx(
                  "dash-sidebar-user-avatar ring-2",
                  staffMeta?.avatarRingClass ?? "ring-transparent",
                )}
                href={accountHref}
                title={username}
              >
                {username.charAt(0).toUpperCase()}
              </Link>
              <div className="dash-sidebar-user-meta min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-white">
                    {username}
                  </p>
                  <StaffBadge role={profile.staffRole} size="xs" />
                </div>
                <p className="truncate text-[11px] capitalize text-zinc-500">
                  {staffMeta
                    ? `${staffMeta.label} staff`
                    : planLabel
                      ? planLabel
                      : "Investigator"}
                </p>
              </div>
            </div>
            <button
              aria-label="Log out"
              className="rounded-md p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white"
              title="Log out"
              type="button"
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </SidebarFooter>
      </LiquidGlassCard>
    </Sidebar>
  );
}
