"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  CreditCard,
  IdCard,
  LifeBuoy,
  Lock,
  LogOut,
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
import { AI_SEARCH_MODULES, getHubSections } from "@/lib/search-modules";
import { isCryptoIntelEnabled } from "@/lib/crypto-intel/enabled";
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
  "Crypto AI Analyse": "NEW",
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
  dataTour,
}: {
  item: NavItem;
  pathname: string;
  dataTour?: string;
}) {
  const isActive = isNavActive(item, pathname);

  return (
    <Link
      prefetch
      className={clsx("dash-nav-link", isActive && "dash-nav-link-active")}
      data-tour={dataTour}
      href={item.href}
      title={item.name}
    >
      <div className="flex items-center gap-3">
        <item.icon className="size-4 shrink-0" />
        <span>{item.name}</span>
      </div>
      {item.badge && (
        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-300">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function ModuleIcon({ name }: { name: string }) {
  if (hasPlatformBrandIcon(name)) {
    return (
      <PlatformBrandIcon
        muted
        className="size-[1.15rem] shrink-0 text-zinc-400"
        name={name}
      />
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
}: {
  name: string;
  slug: string;
  hint: string;
  pathname: string;
  badge?: string;
  locked?: boolean;
}) {
  const isActive = isModuleActive(pathname, slug);
  const title = locked ? `${name} — upgrade to unlock` : `${name} — ${hint}`;

  return (
    <Link
      prefetch
      className={clsx(
        "dash-nav-link w-full",
        isActive && "dash-nav-link-active",
        locked && "opacity-45",
      )}
      href={`/dashboard/search/${slug}`}
      title={title}
    >
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
    </Link>
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
    <div data-tour={dataTour}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="dash-sidebar-category-toggle"
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
          <div className="space-y-0.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useDashboardUser();
  const plan = resolveUserPlan(profile);
  const balance = profile.balance ?? 0;
  const staffMeta = getStaffRoleMeta(profile.staffRole);
  const { footerCollapsed, toggleFooterCollapsed } = useDashboardSidebar();
  const [moduleQuery, setModuleQuery] = useState("");
  const [categoryOpen, setCategoryOpen] = useState<Record<string, boolean>>({});
  const [categoriesReady, setCategoriesReady] = useState(false);

  useEffect(() => {
    setCategoryOpen(readCategoryOpenMap());
    setCategoriesReady(true);
  }, []);

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
          item.name.toLowerCase().includes(query) ||
          item.hint.toLowerCase().includes(query),
      ),
    }))
    .filter((section) => section.items.length > 0);

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <aside className="dash-sidebar">
      <div className="dash-sidebar-header">
        <Link
          prefetch
          className="dash-sidebar-brand min-w-0 flex-1"
          href={siteConfig.defaultWorkspacePath}
          title={`${siteConfig.name} dashboard`}
        >
          <Image
            unoptimized
            alt={siteConfig.name}
            className={siteLogoClassName}
            height={36}
            src={siteLogoSrc}
            width={36}
          />
          <span className="[font-family:var(--font-bruno-ace-sc)]">
            {siteConfig.name}
          </span>
        </Link>
      </div>

      <div className="border-b border-white/6 px-4 pb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            {...SEARCH_AUTOFILL_SHIELD}
            readOnly
            className="dash-input dash-input--icon py-2 pr-3"
            data-tour="sidebar-filter"
            name="module-filter"
            placeholder="Filter modules..."
            type="text"
            value={moduleQuery}
            onChange={(event) => setModuleQuery(event.target.value)}
            onFocus={unlockAutofillShield}
          />
        </div>
      </div>

      <div
        className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
        data-tour="sidebar-scroll"
      >
        <div className="space-y-1">
          {mainNav.map((item) => (
            <SidebarLink
              key={item.name}
              dataTour={item.name === "Case ID" ? "case-id" : undefined}
              item={item}
              pathname={pathname}
            />
          ))}
        </div>

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
      </div>

      <div className="border-t border-white/6 px-3 py-2">
        <button
          aria-controls="dash-sidebar-footer-links"
          aria-expanded={!footerCollapsed}
          aria-label={
            footerCollapsed
              ? "Show account and more links"
              : "Minimize account and more links"
          }
          className="dash-sidebar-minimize"
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
              <span>Account & more</span>
            </>
          ) : (
            <>
              <ChevronDown className="size-4 shrink-0" />
              <span>Minimize</span>
            </>
          )}
        </button>
      </div>

      <div
        className={clsx(
          "dash-sidebar-footer-nav",
          footerCollapsed && "dash-sidebar-footer-nav--collapsed",
        )}
        id="dash-sidebar-footer-links"
      >
        <div className="dash-sidebar-footer-nav-inner">
          <div className="space-y-1 border-t border-white/6 px-3 py-3">
            {footerItems.map((item) => (
              <SidebarLink
                key={item.name}
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
          </div>
        </div>
      </div>

      <div className="border-t border-white/6 p-4">
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
            title="Log out"
            type="button"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
