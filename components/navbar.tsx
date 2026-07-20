"use client";

import { apiFetch } from "@/lib/csrf-client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { motion } from "framer-motion";

import { PricingModal } from "@/components/pricing-modal";
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
  onModal,
}: {
  item: NavItem;
  active: boolean;
  onModal?: () => void;
}) {
  const className = clsx(
    "relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200",
    active ? "text-white" : "text-white/55 hover:text-white/90",
  );

  const content = (
    <>
      {active ? (
        <motion.span
          layoutId="marketing-nav-pill"
          className="absolute inset-0 rounded-full border border-anya-accent-soft bg-[var(--anya-blush-soft)] shadow-[0_0_18px_var(--anya-blush-glow)]"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      ) : null}
      <span className="relative z-10">{item.label}</span>
    </>
  );

  if (onModal) {
    return (
      <button type="button" className={className} onClick={onModal}>
        {content}
      </button>
    );
  }

  if (item.newTab) {
    return (
      <a
        className={className}
        href={item.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return (
    <NextLink className={className} href={item.href}>
      {content}
    </NextLink>
  );
}

export const Navbar = () => {
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [workspacePath, setWorkspacePath] = useState("/dashboard/search/ai-search");
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = useMemo(() => {
    const fromConfig = siteConfig.navItems;
    const seen = new Set(fromConfig.map((item) => item.href));
    const ensured: NavItem[] = [...fromConfig];

    for (const item of [
      { label: "Pricing", href: "/pricing" },
      { label: "Status", href: "/status" },
    ] as NavItem[]) {
      if (!seen.has(item.href)) {
        ensured.unshift(item);
        seen.add(item.href);
      }
    }

    return ensured;
  }, []);

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

  const openPricingModal = () => {
    setMenuOpen(false);
    window.location.assign("/pricing");
  };

  const getModalHandler = (item: NavItem) => {
    if (item.modal === "pricing") return openPricingModal;
    return null;
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
              <span className="flex flex-col leading-none">
                <span
                  className={clsx(
                    "text-[15px] font-bold tracking-wide text-white transition-transform duration-200 ease-out group-hover:-rotate-3",
                    "[font-family:var(--font-bruno-ace-sc)]",
                  )}
                >
                  {siteConfig.navName}
                </span>
                <span className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-[0.14em] text-anya-accent sm:block">
                  OSINT
                </span>
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
            aria-label="Primary"
            className="flex items-center gap-0.5 rounded-full border border-white/[0.1] bg-white/[0.045] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md"
          >
            {navItems.map((item) => {
              const modalHandler = getModalHandler(item);
              const active = !item.newTab && isNavActive(item.href, pathname);

              return (
                <NavbarItem key={item.label} className="shrink-0">
                  <NavPillLink
                    item={item}
                    active={active}
                    onModal={modalHandler ?? undefined}
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
              const modalHandler = getModalHandler(item);
              const active = !item.newTab && isNavActive(item.href, pathname);

              return (
                <NavbarMenuItem key={item.label}>
                  {modalHandler ? (
                    <Link
                      color="foreground"
                      className={clsx(active && "text-anya-accent")}
                      href="#"
                      size="lg"
                      onPress={modalHandler}
                    >
                      {item.label}
                    </Link>
                  ) : item.newTab ? (
                    <Link
                      color="foreground"
                      className={clsx(active && "text-anya-accent")}
                      href={item.href}
                      rel="noopener noreferrer"
                      size="lg"
                      target="_blank"
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

      <PricingModal onClose={() => setPricingOpen(false)} open={pricingOpen} />
    </>
  );
};
