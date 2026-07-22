"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

import { CATALOG_MODULE_COUNT } from "@/lib/featured-modules";

type StatItem = {
  key: string;
  label: string;
  value: string;
  raw: number | null;
  source?: string;
};

const FALLBACK_STATS: StatItem[] = [
  {
    key: "coverage",
    label: "Lookup Surfaces",
    value: String(CATALOG_MODULE_COUNT + 223),
    raw: CATALOG_MODULE_COUNT + 223,
  },
  {
    key: "platforms",
    label: "Username Platforms",
    value: "223",
    raw: 223,
  },
  {
    key: "modules",
    label: "Intelligence Modules",
    value: String(CATALOG_MODULE_COUNT),
    raw: CATALOG_MODULE_COUNT,
  },
  {
    key: "uptime",
    label: "Platform Uptime",
    value: "99.9%",
    raw: 99.9,
  },
];

export function StatsSection() {
  const [stats, setStats] = useState<StatItem[]>(FALLBACK_STATS);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/stats", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { stats?: StatItem[] } | null) => {
        if (cancelled || !data?.stats?.length) return;
        setStats(data.stats.slice(0, 4));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="by-numbers relative z-20 mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-16">
      <div className="by-numbers-head">
        <h2 className="by-numbers-title">The scale behind the speed</h2>
      </div>

      <div className="by-numbers-strip" role="list">
        {stats.map((stat, index) => (
          <div
            key={stat.key}
            className={clsx(
              "by-numbers-cell",
              index < stats.length - 1 && "by-numbers-cell--divider",
            )}
            role="listitem"
          >
            <strong className="by-numbers-value">{stat.value}</strong>
            <span className="by-numbers-label">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
