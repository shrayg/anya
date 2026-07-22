"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  FolderOpen,
  Layers,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

import { CATALOG_MODULE_COUNT } from "@/lib/featured-modules";
import { siteConfig } from "@/config/site";

const SCAN_STEPS = [
  { id: "resolve", label: "Normalize input signal", ms: "24ms" },
  { id: "fanout", label: "Fan out across indexes", ms: "86ms" },
  { id: "link", label: "Link accounts & aliases", ms: "61ms" },
  { id: "pack", label: "Pack into case-ready hits", ms: "44ms" },
] as const;

const FINDINGS = [
  {
    key: "accounts",
    label: "CONNECTED PROFILES",
    value: "11 handles across social + gaming",
    tone: "med" as const,
    badge: "LINK",
  },
  {
    key: "exposure",
    label: "EXPOSURE",
    value: "2 breach sets · password reuse risk",
    tone: "crit" as const,
    badge: "HOT",
  },
  {
    key: "records",
    label: "RECORDS",
    value: "Address + filing pivot available",
    tone: "high" as const,
    badge: "OPEN",
  },
] as const;

const FLOW = [
  {
    icon: Search,
    title: "Search once",
    body: "Email, phone, username, Discord — one field, then Anya decides which engines to wake.",
  },
  {
    icon: Layers,
    title: "Read the trail",
    body: "Hits come back linked: accounts, exposure, and public signals in one readable stack.",
  },
  {
    icon: FolderOpen,
    title: "File the case",
    body: "Pin what matters into a dossier. Notes, exports, and follow-ups stay with the target.",
  },
] as const;

const AUDIENCES = [
  {
    icon: Shield,
    title: "Investigators & teams",
    body: "Panel access, case filing, and module depth for people who live in this work.",
  },
  {
    icon: Users,
    title: "Operators & community",
    body: "Fast lookups when you need a clean answer — without a 40-tab circus.",
  },
] as const;

function toneClass(tone: "med" | "crit" | "high") {
  if (tone === "crit") return "home-agent-badge--crit";
  if (tone === "high") return "home-agent-badge--high";
  return "home-agent-badge--med";
}

function SignalAgentDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
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
        window.setTimeout(() => setStep(index + 1), 320 + index * 460),
      );
    });
    timers.push(
      window.setTimeout(() => setDone(true), 320 + SCAN_STEPS.length * 460 + 200),
    );
    timers.push(
      window.setTimeout(() => setCycle((c) => c + 1), 320 + SCAN_STEPS.length * 460 + 3200),
    );

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [inView, cycle]);

  const progress = Math.min(100, (step / SCAN_STEPS.length) * 100);
  const showFindings = step >= 2;

  return (
    <div ref={ref} className="home-agent" aria-hidden>
      <div className="home-agent-chrome">
        <div className="home-agent-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <p className="home-agent-title">
          {siteConfig.navName} · live pass
        </p>
        <span className={`home-agent-status ${done ? "is-live" : "is-run"}`}>
          {done ? "ready" : "running"}
        </span>
      </div>

      <div className="home-agent-progress">
        <motion.span
          animate={{ width: `${done ? 100 : progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      <div className="home-agent-body">
        <ul className="home-agent-steps">
          {SCAN_STEPS.map((item, index) => {
            const complete = step > index;
            const active = step === index + 1 && !done;

            return (
              <li
                key={item.id}
                className={
                  complete ? "is-complete" : active ? "is-active" : "is-pending"
                }
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
              </li>
            );
          })}
        </ul>

        <div className="home-agent-findings-slot">
          <div className="home-agent-findings">
            <div className="home-agent-findings-head">
              <span>Packed hits</span>
              <span>
                {!showFindings ? "waiting" : done ? "3 stacked" : "filling…"}
              </span>
            </div>
            {FINDINGS.map((finding, index) => {
              const visible = showFindings && (done || step >= index + 2);

              return (
                <motion.div
                  key={`${finding.key}-${cycle}`}
                  animate={{ opacity: visible ? 1 : 0.22 }}
                  className="home-agent-finding"
                  initial={false}
                  transition={{ duration: 0.28 }}
                >
                  <div>
                    <p>{finding.label}</p>
                    <strong>{finding.value}</strong>
                  </div>
                  <span
                    className={`home-agent-badge ${toneClass(finding.tone)}`}
                  >
                    {finding.badge}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="home-agent-footer">
        <span className={done ? "is-live" : undefined}>
          {done ? "PASS COMPLETE" : "PASS RUNNING"}
        </span>
        <span>{done ? "215ms" : "…"}</span>
        <span>engines hot</span>
      </div>
    </div>
  );
}

/** Product story + fixed agent panel under the search hero. */
export function HomeShowcase() {
  return (
    <section className="home-band home-showcase relative z-20 w-full">
      <div className="home-band-inner mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:items-center md:gap-12 md:px-6 md:py-24">
        <div className="home-showcase-copy">
          <p className="home-kicker">
            <Sparkles className="size-3.5" />
            After the search bar
          </p>
          <h2 className="home-title">
            One input.
            <span>A readable trail.</span>
          </h2>
          <p className="home-lede">
            {siteConfig.name} is not a raw dump factory. You run a lookup, we
            stitch the connected surface — accounts, exposure, records — then
            you decide what belongs in the case.
          </p>
          <ul className="home-pill-row">
            <li>{CATALOG_MODULE_COUNT}+ modules</li>
            <li>Case filing</li>
            <li>Retail + operator</li>
          </ul>
          <div className="home-actions">
            <Link className="home-btn-primary" href="/auth?action=register">
              Create account
              <ArrowRight className="size-4" />
            </Link>
            <Link className="home-btn-ghost" href="/pricing">
              See plans
            </Link>
          </div>
        </div>

        <SignalAgentDemo />
      </div>
    </section>
  );
}

export function HomeHowItWorks() {
  return (
    <section className="home-band relative z-20 w-full">
      <div className="home-band-inner mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <header className="home-section-head">
          <p className="home-kicker">How it runs</p>
          <h2 className="home-title home-title--sm">
            Search → trail → case
          </h2>
          <p className="home-lede">
            Three moves. No dashboard archaeology just to find where a hit went.
          </p>
        </header>

        <ol className="home-flow-grid">
          {FLOW.map((item, index) => {
            const Icon = item.icon;

            return (
              <li key={item.title} className="home-flow-card">
                <span className="home-flow-num">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon className="home-flow-icon" aria-hidden />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

export function HomeAudiences() {
  return (
    <section className="home-band home-band--tint relative z-20 w-full">
      <div className="home-band-inner mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <header className="home-section-head">
          <p className="home-kicker">Who it’s for</p>
          <h2 className="home-title home-title--sm">
            Two crowds. Same product.
          </h2>
        </header>

        <div className="home-audience-grid">
          {AUDIENCES.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title} className="home-audience-card">
                <Icon className="size-5 text-[var(--anya-blush)]" aria-hidden />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HomeStatsStrip() {
  const stats = [
    { value: String(CATALOG_MODULE_COUNT), label: "Live modules" },
    { value: "223+", label: "Username platforms" },
    { value: "Panel", label: "Case workspace" },
    { value: "24/7", label: "Status watched" },
  ] as const;

  return (
    <section className="home-band relative z-20 w-full">
      <div className="home-band-inner mx-auto w-full max-w-6xl px-4 pb-6 pt-4 md:px-6">
        <div className="home-stats" role="list">
          {stats.map((stat) => (
            <div key={stat.label} className="home-stat" role="listitem">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeFinalCta() {
  return (
    <section className="home-band relative z-20 w-full">
      <div className="home-band-inner mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="home-final-cta">
          <div>
            <p className="home-kicker">Ready</p>
            <h2 className="home-title home-title--sm">
              Run the next lookup in Panel.
            </h2>
            <p className="home-lede">
              Start on the homepage search, then unlock the full module map when
              you need depth.
            </p>
          </div>
          <div className="home-actions">
            <Link
              className="home-btn-primary"
              href={siteConfig.defaultWorkspacePath}
            >
              Open Panel
              <ArrowRight className="size-4" />
            </Link>
            <Link className="home-btn-ghost" href="/pricing">
              Pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
