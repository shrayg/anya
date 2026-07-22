"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Code2,
  Database,
  Hexagon,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import Link from "next/link";

import { CATALOG_MODULE_COUNT } from "@/lib/featured-modules";
import { siteConfig } from "@/config/site";

/** Matches `stats-section` / `getPlatformStats` username-site fallback. */
const USERNAME_PLATFORM_FALLBACK = 223;

const FANOUT_STEPS = [
  { id: "breach", label: "breach-index", ms: "42ms", hits: 12 },
  { id: "stealer", label: "stealer-logs", ms: "88ms", hits: 3 },
  { id: "discord", label: "discord-recon", ms: "61ms", hits: 4 },
  { id: "specialty", label: "specialty-maps", ms: "104ms", hits: 2 },
] as const;

const LIVE_HITS = [
  {
    key: "b1",
    lane: "breach",
    text: "adobe2013 · email credential hit",
  },
  {
    key: "s1",
    lane: "stealer",
    text: "RedLine · cookie domain match",
  },
  {
    key: "d1",
    lane: "discord",
    text: "user resolve · linked phone pivot",
  },
  {
    key: "u1",
    lane: "username",
    text: "github · twitter · steam handles",
  },
  {
    key: "sp1",
    lane: "specialty",
    text: "minecraft · roblox profile map",
  },
] as const;

const PILLS = [
  { icon: Zap, label: "Sub-second lookups" },
  { icon: Database, label: "Breach + stealer indexes" },
  { icon: Hexagon, label: `${CATALOG_MODULE_COUNT}+ live modules` },
] as const;

type ShowcaseStat = {
  key: string;
  value: string;
  label: string;
};

const FALLBACK_STATS: ShowcaseStat[] = [
  {
    key: "coverage",
    value: String(CATALOG_MODULE_COUNT + USERNAME_PLATFORM_FALLBACK),
    label: "Lookup surfaces",
  },
  {
    key: "modules",
    value: String(CATALOG_MODULE_COUNT),
    label: "Intelligence modules",
  },
  {
    key: "uptime",
    value: "99.9%",
    label: "Platform uptime",
  },
  {
    key: "p95",
    value: "320ms",
    label: "P95 response",
  },
];

function laneClass(lane: (typeof LIVE_HITS)[number]["lane"]) {
  return `home-agent-hit-lane home-agent-hit-lane--${lane}`;
}

function SignalAgentDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [step, setStep] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [done, setDone] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!inView) return;

    setStep(0);
    setHitCount(0);
    setDone(false);

    const timers: number[] = [];
    FANOUT_STEPS.forEach((_, index) => {
      timers.push(
        window.setTimeout(() => setStep(index + 1), 260 + index * 420),
      );
    });
    LIVE_HITS.forEach((_, index) => {
      timers.push(
        window.setTimeout(
          () => setHitCount(index + 1),
          520 + index * 340,
        ),
      );
    });
    timers.push(
      window.setTimeout(
        () => setDone(true),
        260 + FANOUT_STEPS.length * 420 + 900,
      ),
    );
    timers.push(
      window.setTimeout(
        () => setCycle((c) => c + 1),
        260 + FANOUT_STEPS.length * 420 + 3200,
      ),
    );

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [inView, cycle]);

  const progress = Math.min(100, (step / FANOUT_STEPS.length) * 100);
  const totalHits = FANOUT_STEPS.reduce((sum, item) => sum + item.hits, 0);
  const visibleHits = LIVE_HITS.slice(0, hitCount);

  return (
    <div ref={ref} className="home-agent" aria-hidden>
      <div className="home-agent-glow" />
      <div className="home-agent-scanline" />

      <div className="home-agent-chrome">
        <div className="home-agent-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <p className="home-agent-title">
          {siteConfig.navName.toUpperCase()} FAN-OUT
          <span> / email seed</span>
        </p>
        <span className={`home-agent-status ${done ? "is-live" : "is-run"}`}>
          {done ? "settled" : "streaming"}
        </span>
      </div>

      <div className="home-agent-progress">
        <motion.span
          animate={{ width: `${done ? 100 : progress}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>

      <ul className="home-agent-steps">
        {FANOUT_STEPS.map((item, index) => {
          const complete = step > index;
          const active = step === index + 1 && !done;

          return (
            <motion.li
              key={`${item.id}-${cycle}`}
              animate={{ opacity: 1, x: 0 }}
              className={
                complete ? "is-complete" : active ? "is-active" : "is-pending"
              }
              initial={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <span className="home-agent-step-icon">
                {complete ? (
                  <Check className="size-3.5" strokeWidth={2.75} />
                ) : (
                  <span className="home-agent-pulse" />
                )}
              </span>
              <span className="home-agent-step-label">{item.label}</span>
              <span className="home-agent-step-ms">
                {complete
                  ? `${item.hits} hits · ${item.ms}`
                  : active
                    ? "probing…"
                    : "queued"}
              </span>
            </motion.li>
          );
        })}
      </ul>

      <AnimatePresence mode="wait">
        {hitCount > 0 ? (
          <motion.div
            key={`hits-${cycle}`}
            animate={{ opacity: 1, y: 0 }}
            className="home-agent-hits"
            exit={{ opacity: 0, y: 6 }}
            initial={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="home-agent-findings-head">
              <span>Module hit stream</span>
              <span>
                {done ? `${totalHits} hits` : `${hitCount} incoming…`}
              </span>
            </div>
            {visibleHits.map((hit, index) => (
              <motion.div
                key={hit.key}
                animate={{ opacity: 1, x: 0 }}
                className="home-agent-hit"
                initial={{ opacity: 0, x: 10 }}
                transition={{ delay: 0.04 + index * 0.06, duration: 0.3 }}
              >
                <span className={laneClass(hit.lane)}>{hit.lane}</span>
                <code>{hit.text}</code>
              </motion.div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="home-agent-footer">
        <span className={done ? "is-live" : undefined}>
          {done ? "SETTLED" : "FAN-OUT"}
        </span>
        <span>{done ? "295ms" : "…"}</span>
        <span>
          {Math.min(step, FANOUT_STEPS.length)}/{FANOUT_STEPS.length} modules
        </span>
        <span className="home-agent-footer-accent">
          {done ? `${totalHits} hits` : "awaiting"}
        </span>
      </div>
    </div>
  );
}

export function HomeShowcase() {
  const [stats, setStats] = useState<ShowcaseStat[]>(FALLBACK_STATS);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/stats", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            stats?: Array<{
              key: string;
              label: string;
              value: string;
            }>;
          } | null,
        ) => {
          if (cancelled || !data?.stats?.length) return;

          const live = data.stats.slice(0, 3).map((stat) => ({
            key: stat.key,
            value: stat.value,
            label: stat.label,
          }));

          // Keep marketing P95 as the fourth slot; first three come from
          // /api/stats (live indexed records when providers respond, else
          // honest catalog coverage — never a fabricated "4.2B").
          setStats([
            ...live,
            {
              key: "p95",
              value: "320ms",
              label: "P95 response",
            },
          ]);
        },
      )
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="home-showcase relative z-20 w-full">
      <div className="home-showcase-veil" aria-hidden />
      <div className="home-showcase-inner mx-auto w-full max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="home-showcase-grid">
          <div className="home-showcase-copy">
            <p className="home-showcase-kicker">OSINT that moves</p>
            <h2 className="home-showcase-title">
              Uncover truth
              <span>in the shadows.</span>
            </h2>
            <p className="home-showcase-lede">
              Start with one identifier — email, phone, username, or Discord
              ID — and {siteConfig.name} fans out across breach, stealer,
              social, and public-record engines in parallel. Built for
              investigators who need clear answers without the noise.
            </p>

            <ul className="home-showcase-pills">
              {PILLS.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <span className="home-showcase-pill-icon">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            <div className="home-showcase-actions">
              <Link className="home-showcase-cta" href="/auth?action=register">
                Get started
                <ArrowRight className="size-4" />
              </Link>
              <Link className="home-showcase-cta-ghost" href="/pricing">
                <Code2 className="size-3.5" aria-hidden />
                View plans
              </Link>
            </div>
          </div>

          <SignalAgentDemo />
        </div>

        <div className="home-showcase-stats" role="list">
          {stats.map((stat) => (
            <div key={stat.key} className="home-showcase-stat" role="listitem">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
