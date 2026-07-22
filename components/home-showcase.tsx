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

const SCAN_STEPS = [
  { id: "geo", label: "Identity resolve", ms: "38ms" },
  { id: "stealer", label: "Stealer / breach fan-out", ms: "91ms" },
  { id: "social", label: "Platform username map", ms: "74ms" },
  { id: "records", label: "Public records pivot", ms: "112ms" },
] as const;

const FINDINGS = [
  {
    key: "accounts",
    label: "LINKED ACCOUNTS",
    value: "14 profiles · 6 platforms",
    tone: "med" as const,
    badge: "MED",
  },
  {
    key: "breach",
    label: "BREACH EXPOSURE",
    value: "3 collections · credential hits",
    tone: "crit" as const,
    badge: "CRIT",
  },
  {
    key: "records",
    label: "PUBLIC SIGNALS",
    value: "2 court / address matches",
    tone: "high" as const,
    badge: "HIGH",
  },
  {
    key: "score",
    label: "CONFIDENCE",
    value: "82 / 100 correlation score",
    tone: "med" as const,
    badge: "MED",
  },
];

const PILLS = [
  { icon: Zap, label: "Sub-second lookups" },
  { icon: Database, label: "Breach + stealer indexes" },
  { icon: Hexagon, label: `${CATALOG_MODULE_COUNT}+ live modules` },
] as const;

const SHOWCASE_STATS = [
  { value: "4.2B+", label: "Records indexed" },
  { value: String(CATALOG_MODULE_COUNT), label: "Intelligence modules" },
  { value: "99.9%", label: "Platform uptime" },
  { value: "320ms", label: "P95 response" },
] as const;

function toneClass(tone: "med" | "crit" | "high") {
  if (tone === "crit") return "home-agent-badge--crit";
  if (tone === "high") return "home-agent-badge--high";
  return "home-agent-badge--med";
}

function SignalAgentDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!inView) return;

    setStep(0);
    setDone(false);

    const timers: number[] = [];
    SCAN_STEPS.forEach((_, index) => {
      timers.push(
        window.setTimeout(() => setStep(index + 1), 280 + index * 480),
      );
    });
    timers.push(
      window.setTimeout(() => setDone(true), 280 + SCAN_STEPS.length * 480 + 220),
    );
    timers.push(
      window.setTimeout(() => setCycle((c) => c + 1), 280 + SCAN_STEPS.length * 480 + 2800),
    );

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [inView, cycle]);

  const progress = Math.min(100, (step / SCAN_STEPS.length) * 100);

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
          {siteConfig.navName.toUpperCase()} AGENT
          <span> / target@signal.io</span>
        </p>
        <span className={`home-agent-status ${done ? "is-live" : "is-run"}`}>
          {done ? "complete" : "scanning"}
        </span>
      </div>

      <div className="home-agent-progress">
        <motion.span
          animate={{ width: `${done ? 100 : progress}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>

      <ul className="home-agent-steps">
        {SCAN_STEPS.map((item, index) => {
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
                {complete || active ? item.ms : "—"}
              </span>
            </motion.li>
          );
        })}
      </ul>

      <AnimatePresence mode="wait">
        {step >= 2 ? (
          <motion.div
            key={`findings-${cycle}`}
            animate={{ opacity: 1, y: 0 }}
            className="home-agent-findings"
            exit={{ opacity: 0, y: 6 }}
            initial={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="home-agent-findings-head">
              <span>Live correlation</span>
              <span>{done ? "5 findings" : "collecting…"}</span>
            </div>
            {FINDINGS.map((finding, index) => (
              <motion.div
                key={finding.key}
                animate={{ opacity: 1, x: 0 }}
                className="home-agent-finding"
                initial={{ opacity: 0, x: 10 }}
                transition={{ delay: 0.08 + index * 0.1, duration: 0.35 }}
              >
                <div>
                  <p>{finding.label}</p>
                  <strong>{finding.value}</strong>
                </div>
                <span className={`home-agent-badge ${toneClass(finding.tone)}`}>
                  · {finding.badge}
                </span>
              </motion.div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="home-agent-footer">
        <span className={done ? "is-live" : undefined}>
          {done ? "COMPLETE" : "RUNNING"}
        </span>
        <span>{done ? "412ms" : "…"}</span>
        <span>4/4 engines</span>
        <span className="home-agent-footer-accent">
          {done ? "5 findings" : "awaiting"}
        </span>
      </div>
    </div>
  );
}

export function HomeShowcase() {
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
              Drop one signal — email, phone, username, Discord — and{" "}
              {siteConfig.name} fans out across breach, stealer, social, and
              public-record engines. Built for Meta/TikTok buyers and the
              Discord kids who already know how deep this goes.
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
          {SHOWCASE_STATS.map((stat) => (
            <div key={stat.label} className="home-showcase-stat" role="listitem">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
