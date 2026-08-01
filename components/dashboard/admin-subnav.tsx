"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Ban, Shield, Users } from "lucide-react";
import clsx from "clsx";

const TABS = [
  {
    name: "Dashboard",
    href: "/dashboard/admin",
    icon: Activity,
    match: (pathname: string) =>
      pathname === "/dashboard/admin" ||
      pathname.startsWith("/dashboard/admin/overview"),
  },
  {
    name: "Users",
    href: "/dashboard/admin/users",
    icon: Users,
    match: (pathname: string) => pathname.startsWith("/dashboard/admin/users"),
  },
  {
    name: "Blacklist",
    href: "/dashboard/admin/blacklist",
    icon: Ban,
    match: (pathname: string) =>
      pathname.startsWith("/dashboard/admin/blacklist"),
  },
  {
    name: "API",
    href: "/dashboard/admin/api",
    icon: Shield,
    match: (pathname: string) => pathname.startsWith("/dashboard/admin/api"),
  },
] as const;

export function AdminSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin dashboards"
      className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.07] bg-[#0c0c0e] p-1"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            className={clsx(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium transition",
              active
                ? "text-[#c3d3e6] shadow-[inset_0_0_0_1px_rgba(195,211,230,0.28)]"
                : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200",
            )}
            href={tab.href}
            style={
              active
                ? {
                    backgroundColor:
                      "color-mix(in srgb, #c3d3e6 16%, transparent)",
                  }
                : undefined
            }
          >
            <Icon className="size-3.5 opacity-80" />
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
