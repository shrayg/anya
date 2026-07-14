"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

import { PartnerModal } from "@/components/partner-modal";
import { PricingModal } from "@/components/pricing-modal";
import { siteLogoClassName, siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";
import type { NavItem } from "@/config/site";
import { getAppLandingPath, hasWorkspaceDashboardAccess } from "@/lib/plans";

export const Navbar = () => {
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);
  const [workspacePath, setWorkspacePath] = useState("/dashboard/search/ai-search");
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
          setShowWorkspace(hasWorkspaceDashboardAccess(user));
          setWorkspacePath(getAppLandingPath(user));
          return;
        }

        setUsername(null);
        setShowWorkspace(false);
        setWorkspacePath("/dashboard/search/ai-search");
      })
      .catch(() => {
        setUsername(null);
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
    await fetch("/api/auth/logout", { method: "POST" });
    setUsername(null);
    window.location.href = "/";
  };

  const openPartnerModal = () => {
    setMenuOpen(false);
    setPartnerOpen(true);
  };

  const openPricingModal = () => {
    setMenuOpen(false);
    window.location.assign("/pricing");
  };

  const getModalHandler = (item: NavItem) => {
    if (item.modal === "partner") return openPartnerModal;
    if (item.modal === "pricing") return openPricingModal;
    return null;
  };

  return (
    <>
      <HeroUINavbar
        isMenuOpen={menuOpen}
        maxWidth="xl"
        onMenuOpenChange={setMenuOpen}
        position="sticky"
      >
        <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
          <NavbarBrand as="li" className="gap-3 max-w-fit">
            <NextLink className="flex justify-start items-center gap-2" href="/">
              <Image src={siteLogoSrc} alt={`${siteConfig.navName} logo`} width={40} height={40} unoptimized className={clsx(siteLogoClassName, "size-8 hover:scale-105 transition-all duration-200 ease-in-out")}/>
              <p className={clsx("font-bold text-inherit hover:-rotate-6 transition-all duration-200 ease-in-out", "[font-family:var(--font-bruno-ace-sc)]")}>
                {siteConfig.navName}
              </p>
            </NextLink>
          </NavbarBrand>
          <ul className="hidden lg:flex gap-4 justify-start ml-2 font-mono">
            {siteConfig.navItems.map((item) => {
              const modalHandler = getModalHandler(item);

              return (
                <NavbarItem key={item.label}>
                  {modalHandler ? (
                    <Button
                      className="ml-1 font-medium hover:-translate-y-1 transition-all duration-200 ease-in-out"
                      variant="light"
                      onPress={modalHandler}
                    >
                      {item.label}
                    </Button>
                  ) : item.newTab ? (
                    <Button
                      as="a"
                      className="ml-1 font-medium hover:-translate-y-1 transition-all duration-200 ease-in-out"
                      href={item.href}
                      rel="noopener noreferrer"
                      target="_blank"
                      variant="light"
                    >
                      {item.label}
                    </Button>
                  ) : (
                    <Button
                      as={NextLink}
                      href={item.href}
                      variant="light"
                      className="ml-1 font-medium hover:-translate-y-1 transition-all duration-200 ease-in-out"
                    >
                      {item.label}
                    </Button>
                  )}
                </NavbarItem>
              );
            })}
          </ul>
        </NavbarContent>

        <NavbarContent
          className="hidden sm:flex basis-1/5 sm:basis-full"
          justify="end"
        >
          <NavbarItem className="hidden sm:flex gap-2 items-center">
            {username ? (
              <>
                <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-sm text-gray-300">
                  {username}
                </span>
                {showWorkspace ? (
                  <Button
                    as={NextLink}
                    className="font-semibold"
                    color="default"
                    href={workspacePath}
                    variant="flat"
                  >
                    Workspace
                  </Button>
                ) : null}
                <Button
                  className="font-semibold"
                  color="default"
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
                  className="font-semibold"
                  href="/auth?action=login"
                  variant="light"
                >
                  Login
                </Button>
                <Button
                  as={NextLink}
                  className="font-semibold bg-anya-accent text-black hover:bg-[var(--anya-blush-hover)]"
                  href="/auth?action=register"
                  variant="solid"
                >
                  Register
                </Button>
              </>
            )}
          </NavbarItem>
        </NavbarContent>

        <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
          <NavbarMenuToggle />
        </NavbarContent>

        <NavbarMenu>
          <div className="mx-4 mt-2 flex flex-col gap-2">
            {siteConfig.navMenuItems.map((item) => {
              const modalHandler = getModalHandler(item);

              return (
                <NavbarMenuItem key={item.label}>
                  {modalHandler ? (
                    <Link
                      color="foreground"
                      href="#"
                      size="lg"
                      onPress={modalHandler}
                    >
                      {item.label}
                    </Link>
                  ) : item.newTab ? (
                    <Link
                      color="foreground"
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
                  {showWorkspace ? (
                    <Button as={NextLink} href={workspacePath} variant="flat">
                      Workspace
                    </Button>
                  ) : null}
                  <Button variant="light" onPress={handleLogout}>
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Button as={NextLink} href="/auth?action=login" variant="light">
                    Login
                  </Button>
                  <Button
                    as={NextLink}
                    className="font-semibold bg-anya-accent text-black hover:bg-[var(--anya-blush-hover)]"
                    href="/auth?action=register"
                    variant="solid"
                  >
                    Register
                  </Button>
                </>
              )}
            </NavbarMenuItem>
          </div>
        </NavbarMenu>
      </HeroUINavbar>

      <PartnerModal onClose={() => setPartnerOpen(false)} open={partnerOpen} />
      <PricingModal onClose={() => setPricingOpen(false)} open={pricingOpen} />
    </>
  );
};
