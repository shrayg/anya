"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useInView } from "framer-motion";

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

function formatStat(raw: number, template: string) {
  if (template.includes("%")) {
    return `${raw.toFixed(1)}%`;
  }
  if (raw >= 1000) {
    return Math.round(raw).toLocaleString("en-US");
  }
  return String(Math.round(raw));
}

function AnimatedStatValue({
  raw,
  fallback,
  active,
}: {
  raw: number | null;
  fallback: string;
  active: boolean;
}) {
  const [display, setDisplay] = useState(fallback);

  useEffect(() => {
    if (!active || raw == null || Number.isNaN(raw)) {
      setDisplay(fallback);
      return;
    }

    const duration = 900;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(formatStat(raw * eased, fallback));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(fallback);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, fallback, raw]);

  return <strong className="by-numbers-value">{display}</strong>;
}

export function StatsSection() {
  const [stats, setStats] = useState<StatItem[]>(FALLBACK_STATS);
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

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
    <section
      ref={ref}
      className="by-numbers relative z-20 mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-16"
    >
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
            <AnimatedStatValue
              active={inView}
              fallback={stat.value}
              raw={stat.raw}
            />
            <span className="by-numbers-label">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
