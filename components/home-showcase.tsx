"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Database,
  Hexagon,
  Sparkles,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import Link from "next/link";

import { CATALOG_MODULE_COUNT } from "@/lib/featured-modules";
import { siteConfig } from "@/config/site";

const SCAN_STEPS = [
  { id: "email", label: "Email exposure sweep" },
  { id: "phone", label: "Phone & carrier pivot" },
  { id: "social", label: "Username / platform map" },
  { id: "breach", label: "Breach & stealer indexes" },
] as const;

const FINDINGS = [
  {
    key: "geo",
    label: "LINKED ACCOUNTS",
    value: "14 profiles across 6 platforms",
    tone: "med" as const,
    badge: "MED",
  },
  {
    key: "abuse",
    label: "BREACH HITS",
    value: "3 collections · 2019–2024",
    tone: "crit" as const,
    badge: "CRIT",
  },
  {
    key: "ports",
    label: "PUBLIC RECORDS",
    value: "2 court / address signals",
    tone: "high" as const,
    badge: "HIGH",
  },
];

const PILLS = [
  {
    icon: Zap,
    label: "Sub-second lookups",
  },
  {
    icon: Database,
    label: "Breach + stealer coverage",
  },
  {
    icon: Hexagon,
    label: `${CATALOG_MODULE_COUNT} intelligence modules`,
  },
] as const;

function toneClass(tone: "med" | "crit" | "high") {
  if (tone === "crit") return "home-agent-badge--crit";
  if (tone === "high") return "home-agent-badge--high";
  return "home-agent-badge--med";
}

function SignalAgentDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!inView) return;

    setStep(0);
    setDone(false);

    const timers: number[] = [];
    SCAN_STEPS.forEach((_, index) => {
      timers.push(
        window.setTimeout(() => {
          setStep(index + 1);
        }, 420 + index * 520),
      );
    });
    timers.push(
      window.setTimeout(
        () => setDone(true),
        420 + SCAN_STEPS.length * 520 + 280,
      ),
    );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [inView]);

  return (
    <div ref={ref} className="home-agent" aria-hidden>
      <div className="home-agent-chrome">
        <div className="home-agent-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <p className="home-agent-title">
          {siteConfig.navName.toUpperCase()} AGENT
          <span> / target@signal</span>
        </p>
        <span className={`home-agent-status ${done ? "is-live" : ""}`}>
          {done ? "complete" : "scanning"}
        </span>
      </div>

      <ul className="home-agent-steps">
        {SCAN_STEPS.map((item, index) => {
          const complete = step > index;
          const active = step === index + 1 && !done;

          return (
            <motion.li
              key={item.id}
              animate={{ opacity: complete || active || step > index ? 1 : 0.35 }}
              className={
                complete ? "is-complete" : active ? "is-active" : undefined
              }
              initial={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
            >
              <span className="home-agent-step-icon">
                {complete ? (
                  <Check className="size-3.5" strokeWidth={2.5} />
                ) : (
                  <span className="home-agent-pulse" />
                )}
              </span>
              <span>{item.label}</span>
            </motion.li>
          );
        })}
      </ul>

      <AnimatePresence>
        {step >= 2 ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="home-agent-findings"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {FINDINGS.map((finding, index) => (
              <motion.div
                key={finding.key}
                animate={{ opacity: 1, x: 0 }}
                className="home-agent-finding"
                initial={{ opacity: 0, x: 8 }}
                transition={{ delay: 0.12 + index * 0.12, duration: 0.35 }}
              >
                <div>
                  <p>{finding.label}</p>
                  <strong>{finding.value}</strong>
                </div>
                <span className={`home-agent-badge ${toneClass(finding.tone)}`}>
                  {finding.badge}
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
        <span>{done ? "412ms" : "—"}</span>
        <span>4/4 engines</span>
        <span className="home-agent-footer-accent">
          {done ? "5 findings" : "…"}
        </span>
      </div>
    </div>
  );
}

export function HomeShowcase() {
  return (
    <section className="home-showcase relative z-20 mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-24">
      <div className="home-showcase-grid">
        <div className="home-showcase-copy">
          <p className="home-showcase-kicker">
            <Sparkles className="size-3.5" />
            Built for speed and depth
          </p>
          <h2 className="home-showcase-title">
            Uncover the trail.
            <span>Keep the file clean.</span>
          </h2>
          <p className="home-showcase-lede">
            One signal in — email, phone, username, Discord — and {siteConfig.name}{" "}
            fans out across exposure, platforms, and public records. Retail-ready
            when you need answers fast. Operator-grade when you need the full
            map.
          </p>

          <ul className="home-showcase-pills">
            {PILLS.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon className="size-3.5 shrink-0" aria-hidden />
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
              View plans
            </Link>
          </div>
        </div>

        <SignalAgentDemo />
      </div>
    </section>
  );
}
