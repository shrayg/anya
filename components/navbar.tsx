"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";

import { siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";
import { apiFetch } from "@/lib/csrf-client";
import {
  getAppLandingPath,
  getPlanDefinition,
  hasWorkspaceDashboardAccess,
  resolveUserPlan,
} from "@/lib/plans";

const publicLinks = [
  { label: "Home", href: "/" },
  { label: "Pricing", href: "/pricing" },
  { label: "Status", href: "/status" },
  { label: "Support", href: "/support" },
];

export const Navbar = () => {
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [workspacePath, setWorkspacePath] = useState(
    siteConfig.defaultWorkspacePath,
  );
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadAuth = useCallback(() => {
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (!data?.authenticated || !data.user?.username) {
          setUsername(null);
          setPlanLabel(null);
          setShowWorkspace(false);
          setWorkspacePath(siteConfig.defaultWorkspacePath);

          return;
        }

        const user = {
          ...data.user,
          canManageWorkspace: data.canManageWorkspace,
        };

        setUsername(data.user.username);
        setPlanLabel(getPlanDefinition(resolveUserPlan(user)).name);
        setShowWorkspace(hasWorkspaceDashboardAccess(user));
        setWorkspacePath(getAppLandingPath(user));
      })
      .catch(() => {
        setUsername(null);
        setPlanLabel(null);
        setShowWorkspace(false);
      });
  }, []);

  useEffect(() => {
    loadAuth();
    setMenuOpen(false);
  }, [loadAuth, pathname]);

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  };

  return (
    <header className="site-nav-shell">
      <nav aria-label="Primary navigation" className="site-nav">
        <Link
          aria-label={`${siteConfig.name} home`}
          className="site-nav-brand"
          href="/"
        >
          <span className="site-nav-mark">
            <Image
              unoptimized
              alt=""
              height={40}
              src={siteLogoSrc}
              width={40}
            />
          </span>
          <span>{siteConfig.navName}</span>
        </Link>

        <div className="site-nav-links">
          {publicLinks.map((item) => (
            <Link
              key={item.href}
              className={pathname === item.href ? "is-active" : ""}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
          <Link
            className={pathname.startsWith("/dashboard") ? "is-active" : ""}
            href={username ? workspacePath : "/auth?action=login"}
          >
            Panel
          </Link>
        </div>

        <div className="site-nav-actions">
          {username ? (
            <>
              <Link className="site-nav-account" href="/dashboard/account">
                {planLabel ? <span>{planLabel}</span> : null}
                {username}
              </Link>
              {showWorkspace ? (
                <Link className="site-nav-primary" href={workspacePath}>
                  Workspace <ArrowUpRight className="size-3.5" />
                </Link>
              ) : null}
              <button
                className="site-nav-quiet"
                type="button"
                onClick={handleLogout}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link className="site-nav-quiet" href="/auth?action=login">
                Log in
              </Link>
              <Link className="site-nav-primary" href="/auth?action=register">
                Start searching <ArrowUpRight className="size-3.5" />
              </Link>
            </>
          )}
        </div>

        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="site-nav-menu-button"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <div className={`site-nav-mobile ${menuOpen ? "is-open" : ""}`}>
          {publicLinks.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label} <ArrowUpRight className="size-4" />
            </Link>
          ))}
          <Link href={username ? workspacePath : "/auth?action=login"}>
            Panel <ArrowUpRight className="size-4" />
          </Link>
          {username ? (
            <>
              <Link href="/dashboard/account">Account</Link>
              {showWorkspace ? (
                <Link href={workspacePath}>Workspace</Link>
              ) : null}
              <button type="button" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth?action=login">Log in</Link>
              <Link className="is-primary" href="/auth?action=register">
                Start searching
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};
