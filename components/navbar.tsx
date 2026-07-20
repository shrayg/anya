"use client";

import { apiFetch } from "@/lib/csrf-client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import NextLink from "next/link";
import clsx from "clsx";
import Image from "next/image";

import { siteLogoClassName, siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";
import type { NavItem } from "@/config/site";
import {
  getAppLandingPath,
  getPlanDefinition,
  hasWorkspaceDashboardAccess,
  resolveUserPlan,
} from "@/lib/plans";

function isNavActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavPillLink({
  item,
  active,
  tabRef,
}: {
  item: NavItem;
  active: boolean;
  tabRef: (node: HTMLElement | null) => void;
}) {
  const className = clsx(
    "relative z-10 inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium transition-[color] duration-200",
    active ? "text-white" : "text-white/55 hover:text-white/90",
  );

  if (item.newTab) {
    return (
      <a
        ref={tabRef}
        className={className}
        href={item.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {item.label}
      </a>
    );
  }

  return (
    <NextLink ref={tabRef} className={className} href={item.href}>
      {item.label}
    </NextLink>
  );
}

export const Navbar = () => {
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [workspacePath, setWorkspacePath] = useState("/dashboard/search/ai-search");
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pillNavRef = useRef<HTMLElement>(null);
  const pillTabRefs = useRef<(HTMLElement | null)[]>([]);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const activePillIndexRef = useRef(-1);
  const highlightPlacedRef = useRef(false);

  const navItems = useMemo(() => {
    const fromConfig = siteConfig.navItems;
    const seen = new Set(fromConfig.map((item) => item.href));
    const ensured: NavItem[] = [...fromConfig];

    for (const item of [
      { label: "Pricing", href: "/pricing" },
      { label: "Status", href: "/status" },
      { label: "Home", href: "/" },
    ] as NavItem[]) {
      if (!seen.has(item.href)) {
        ensured.unshift(item);
        seen.add(item.href);
      }
    }

    return ensured;
  }, []);

  const activePillIndex = useMemo(
    () =>
      navItems.findIndex(
        (item) => !item.newTab && isNavActive(item.href, pathname),
      ),
    [navItems, pathname],
  );

  activePillIndexRef.current = activePillIndex;

  const measurePillHighlight = useCallback(() => {
    const nav = pillNavRef.current;
    const el = highlightRef.current;
    const index = activePillIndexRef.current;
    const tab = pillTabRefs.current[index];

    if (!el) return;

    // Keep last geometry if the active tab is briefly missing — never unmount.
    if (!nav || !tab || index < 0) {
      el.style.opacity = "0";
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const left = tabRect.left - navRect.left;
    const width = tabRect.width;

    // First placement: snap with no transition so the pill does not fly in.
    if (!highlightPlacedRef.current) {
      el.style.transition = "none";
      el.style.transform = `translate3d(${left}px,0,0)`;
      el.style.width = `${width}px`;
      el.style.opacity = "1";
      void el.offsetWidth;
      el.style.transition = "";
      highlightPlacedRef.current = true;
      return;
    }

    el.style.transform = `translate3d(${left}px,0,0)`;
    el.style.width = `${width}px`;
    el.style.opacity = "1";
  }, []);

  useLayoutEffect(() => {
    measurePillHighlight();
    const raf = requestAnimationFrame(() => measurePillHighlight());
    return () => cancelAnimationFrame(raf);
  }, [measurePillHighlight, activePillIndex, navItems.length]);

  useEffect(() => {
    const nav = pillNavRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => measurePillHighlight());
    observer.observe(nav);
    for (const tab of pillTabRefs.current) {
      if (tab) observer.observe(tab);
    }
    window.addEventListener("resize", measurePillHighlight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measurePillHighlight);
    };
  }, [measurePillHighlight, navItems.length]);

  const loadAuth = useCallback(() => {
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (data?.authenticated && data.user?.username) {
          setUsername(data.user.username);
          const user = {
            ...data.user,
            canManageWorkspace: data.canManageWorkspace,
          };
          setPlanLabel(getPlanDefinition(resolveUserPlan(user)).name);
          setShowWorkspace(hasWorkspaceDashboardAccess(user));
          setWorkspacePath(getAppLandingPath(user));
          return;
        }

        setUsername(null);
        setPlanLabel(null);
        setShowWorkspace(false);
        setWorkspacePath("/dashboard/search/ai-search");
      })
      .catch(() => {
        setUsername(null);
        setPlanLabel(null);
        setShowWorkspace(false);
        setWorkspacePath("/dashboard/search/ai-search");
      });
  }, []);

  useEffect(() => {
    loadAuth();
  }, [loadAuth, pathname]);

  useEffect(() => {
    if (window.location.hash !== "#pricing") return;
    window.location.replace("/pricing");
  }, []);

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUsername(null);
    setPlanLabel(null);
    window.location.href = "/";
  };

  return (
    <>
      <HeroUINavbar
        classNames={{
          base: "border-b border-white/[0.06] bg-black/55 backdrop-blur-xl backdrop-saturate-150",
          wrapper: "max-w-7xl px-4 sm:px-6",
        }}
        isMenuOpen={menuOpen}
        maxWidth="xl"
        onMenuOpenChange={setMenuOpen}
        position="sticky"
      >
        {/* Left — brand */}
        <NavbarContent className="basis-auto" justify="start">
          <NavbarBrand as="li" className="max-w-fit gap-0">
            <NextLink
              className="group flex items-center gap-2.5"
              href="/"
            >
              <Image
                src={siteLogoSrc}
                alt={`${siteConfig.navName} logo`}
                width={40}
                height={40}
                unoptimized
                className={clsx(
                  siteLogoClassName,
                  "size-8 transition-transform duration-200 ease-out group-hover:scale-105",
                )}
              />
              <span
                className={clsx(
                  "text-[15px] font-bold leading-none tracking-wide text-white transition-transform duration-200 ease-out group-hover:-rotate-3",
                  "[font-family:var(--font-bruno-ace-sc)]",
                )}
              >
                {siteConfig.navName}
              </span>
            </NextLink>
          </NavbarBrand>
        </NavbarContent>

        {/* Center — frosted pill nav */}
        <NavbarContent
          className="absolute left-1/2 hidden -translate-x-1/2 md:flex"
          justify="center"
        >
          <nav
            ref={pillNavRef}
            aria-label="Primary"
            className="relative flex items-center gap-0.5 rounded-full border border-white/[0.1] bg-white/[0.045] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md"
          >
            {/* Flat fill + hairline only — no blur/glow on the sliding piece */}
            <span
              ref={highlightRef}
              aria-hidden
              className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-full border border-anya-accent-soft bg-[var(--anya-blush-soft)] will-change-[transform,width] [transition:transform_180ms_ease,width_180ms_ease,opacity_180ms_ease]"
              style={{
                transform: "translate3d(0,0,0)",
                width: 0,
                opacity: 0,
              }}
            />
            {navItems.map((item, index) => {
              const active = !item.newTab && isNavActive(item.href, pathname);

              return (
                <NavbarItem key={item.href} className="relative z-10 shrink-0">
                  <NavPillLink
                    item={item}
                    active={active}
                    tabRef={(node) => {
                      pillTabRefs.current[index] = node;
                    }}
                  />
                </NavbarItem>
              );
            })}
          </nav>
        </NavbarContent>

        {/* Right — CTA + account */}
        <NavbarContent className="hidden basis-auto md:flex" justify="end">
          <NavbarItem className="flex shrink-0 items-center gap-2">
            {username ? (
              <>
                <NextLink
                  className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-sm text-gray-300 transition hover:border-white/22 hover:bg-white/[0.08] hover:text-white"
                  href="/dashboard/settings"
                  title="Account settings"
                >
                  {planLabel ? (
                    <span className="rounded-md bg-[var(--anya-blush-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-anya-accent">
                      {planLabel}
                    </span>
                  ) : null}
                  <span className="font-medium">{username}</span>
                </NextLink>
                {showWorkspace ? (
                  <Button
                    as={NextLink}
                    className="font-semibold bg-anya-accent text-black hover:bg-[var(--anya-blush-hover)]"
                    href={workspacePath}
                    radius="full"
                    variant="solid"
                  >
                    Dashboard
                  </Button>
                ) : null}
                <Button
                  className="font-medium text-white/70"
                  radius="full"
                  variant="light"
                  onPress={handleLogout}
                >
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button
                  as={NextLink}
                  className="font-medium text-white/70"
                  href="/auth?action=login"
                  radius="full"
                  variant="light"
                >
                  Login
                </Button>
                <Button
                  as={NextLink}
                  className="font-semibold bg-anya-accent text-black hover:bg-[var(--anya-blush-hover)]"
                  href="/auth?action=register"
                  radius="full"
                  variant="solid"
                >
                  Get started
                </Button>
              </>
            )}
          </NavbarItem>
        </NavbarContent>

        <NavbarContent className="basis-1 pl-2 md:hidden" justify="end">
          <NavbarMenuToggle className="text-white/80" />
        </NavbarContent>

        <NavbarMenu className="bg-black/90 backdrop-blur-xl">
          <div className="mx-4 mt-2 flex flex-col gap-2">
            {navItems.map((item) => {
              const active = !item.newTab && isNavActive(item.href, pathname);

              return (
                <NavbarMenuItem key={item.href}>
                  {item.newTab ? (
                    <Link
                      color="foreground"
                      className={clsx(active && "text-anya-accent")}
                      href={item.href}
                      rel="noopener noreferrer"
                      size="lg"
                      target="_blank"
                      onPress={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <Link
                      as={NextLink}
                      color="foreground"
                      className={clsx(active && "text-anya-accent")}
                      href={item.href}
                      size="lg"
                      onPress={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )}
                </NavbarMenuItem>
              );
            })}
            <NavbarMenuItem className="mt-4 flex flex-col gap-2">
              {username ? (
                <>
                  <Button as={NextLink} href="/dashboard/settings" radius="full" variant="flat">
                    {planLabel ? `${planLabel} · ${username}` : username}
                  </Button>
                  {showWorkspace ? (
                    <Button
                      as={NextLink}
                      className="font-semibold bg-anya-accent text-black"
                      href={workspacePath}
                      radius="full"
                      variant="solid"
                    >
                      Dashboard
                    </Button>
                  ) : null}
                  <Button radius="full" variant="light" onPress={handleLogout}>
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Button as={NextLink} href="/auth?action=login" radius="full" variant="light">
                    Login
                  </Button>
                  <Button
                    as={NextLink}
                    className="font-semibold bg-anya-accent text-black hover:bg-[var(--anya-blush-hover)]"
                    href="/auth?action=register"
                    radius="full"
                    variant="solid"
                  >
                    Get started
                  </Button>
                </>
              )}
            </NavbarMenuItem>
          </div>
        </NavbarMenu>
      </HeroUINavbar>
    </>
  );
};
