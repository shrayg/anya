"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CircleUserRound,
  Database,
  FileSearch,
  Fingerprint,
  FolderLock,
  Globe2,
  Hash,
  KeyRound,
  Layers3,
  Link2,
  LockKeyhole,
  Network,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ThinkingOrb } from "thinking-orbs";

import { siteConfig } from "@/config/site";

const PANEL_MODULES = [
  { label: "Identity search", icon: Fingerprint },
  { label: "Breach & stealer", icon: KeyRound },
  { label: "Platform intelligence", icon: AtSign },
  { label: "Public records", icon: FileSearch },
  { label: "Network & assets", icon: Network },
] as const;

const PANEL_FINDINGS = [
  {
    label: "Identity cluster",
    value: "3 aliases resolved",
    meta: "high confidence",
    icon: CircleUserRound,
  },
  {
    label: "Connected accounts",
    value: "7 profiles linked",
    meta: "4 platforms",
    icon: Link2,
  },
  {
    label: "Exposure signal",
    value: "2 breach references",
    meta: "review advised",
    icon: Database,
  },
] as const;

const ENTRY_POINTS = [
  { label: "Email", example: "name@domain.com", icon: AtSign },
  { label: "Phone", example: "+1 555 012 0142", icon: Smartphone },
  { label: "Username", example: "northstar_01", icon: CircleUserRound },
  { label: "Discord", example: "123456789012345678", icon: Hash },
] as const;

const QUESTIONS = [
  {
    title: "Can I trust this person?",
    body: "Review public signals around a date, caregiver, seller, new contact, or professional relationship before trust becomes risk.",
    icon: ShieldCheck,
    index: "01",
  },
  {
    title: "Where else do they appear?",
    body: "Follow usernames, aliases, email addresses, phone numbers, and platform IDs across the open web.",
    icon: Globe2,
    index: "02",
  },
  {
    title: "Has this identity been exposed?",
    body: "Surface breach and stealer-log references with enough context to understand what needs attention.",
    icon: LockKeyhole,
    index: "03",
  },
  {
    title: "What connects the evidence?",
    body: "Cross-reference profiles, records, infrastructure, and assets without losing the path that produced each finding.",
    icon: Layers3,
    index: "04",
  },
] as const;

const TRUST_POINTS = [
  {
    title: "Context stays attached",
    body: "Source labels, confidence cues, and the original query travel with every finding.",
    icon: BadgeCheck,
  },
  {
    title: "Sensitive details stay controlled",
    body: "Disclosure controls help prevent accidental exposure while reviewing or sharing a screen.",
    icon: FolderLock,
  },
  {
    title: "Built for lawful investigation",
    body: "Clear acceptable-use boundaries keep the product focused on legitimate research and safety work.",
    icon: BriefcaseBusiness,
  },
] as const;

function PanelPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!inView) return;

    if (reduceMotion) {
      setStage(4);

      return;
    }

    setStage(0);
    const timers = [
      window.setTimeout(() => setStage(1), 260),
      window.setTimeout(() => setStage(2), 720),
      window.setTimeout(() => setStage(3), 1180),
      window.setTimeout(() => setStage(4), 1640),
    ];

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [inView, reduceMotion]);

  return (
    <div
      ref={ref}
      aria-label="Illustrative Anya Panel investigation"
      className="anya-panel-preview"
    >
      <div className="anya-panel-preview__topbar">
        <div aria-hidden className="anya-panel-preview__dots">
          <span />
          <span />
          <span />
        </div>
        <span>{siteConfig.navName} / PANEL</span>
        <span className={stage === 4 ? "is-ready" : "is-running"}>
          {stage === 4 ? "CASE READY" : "CORRELATING"}
        </span>
      </div>

      <div className="anya-panel-preview__shell">
        <aside
          aria-label="Panel modules"
          className="anya-panel-preview__sidebar"
        >
          <div className="anya-panel-preview__mark">
            <ScanSearch aria-hidden />
            <span>MODULES</span>
          </div>
          <ul>
            {PANEL_MODULES.map(({ label, icon: Icon }, index) => (
              <li key={label} className={index === 0 ? "is-active" : undefined}>
                <Icon aria-hidden />
                <span>{label}</span>
                {index === 0 ? (
                  <span className="anya-panel-preview__live" />
                ) : null}
              </li>
            ))}
          </ul>
          <div className="anya-panel-preview__case-count">
            <span>OPEN CASE</span>
            <strong>ANYA-0172</strong>
          </div>
        </aside>

        <div className="anya-panel-preview__main">
          <div className="anya-panel-preview__query">
            <SearchQueryIcon />
            <div>
              <span>ACTIVE QUERY</span>
              <strong>alex.morgan@example.com</strong>
            </div>
            <span className="anya-panel-preview__query-state">
              {stage === 4 ? "8 SOURCES" : `${Math.min(stage * 2, 6)} / 8`}
            </span>
          </div>

          <div className="anya-panel-preview__workspace">
            <div className="anya-panel-preview__identity">
              <div className="anya-panel-preview__profile">
                <div aria-hidden className="anya-panel-preview__avatar">
                  AM
                </div>
                <div>
                  <span>RESOLVED SUBJECT</span>
                  <strong>Alex Morgan</strong>
                  <p>Identity cluster assembled from public signals</p>
                </div>
                <div className="anya-panel-preview__confidence">
                  <strong>{stage >= 3 ? "92" : "--"}</strong>
                  <span>CONFIDENCE</span>
                </div>
              </div>

              <div aria-hidden className="anya-panel-preview__orb-stage">
                <div className="anya-panel-preview__orb">
                  <ThinkingOrb
                    paused={Boolean(reduceMotion)}
                    size={64}
                    speed={1.05}
                    // Keep the globe scan only — do not cycle into solving/working.
                    state="searching"
                    theme="dark"
                  />
                </div>
                <p className="anya-panel-preview__orb-caption">
                  Searching sources
                </p>
              </div>
            </div>

            <div className="anya-panel-preview__findings">
              <div className="anya-panel-preview__findings-head">
                <span>FINDINGS</span>
                <span>{stage === 4 ? "3 VERIFIED" : "BUILDING"}</span>
              </div>
              {PANEL_FINDINGS.map(
                ({ label, value, meta, icon: Icon }, index) => {
                  const visible = stage >= index + 2;

                  return (
                    <motion.div
                      key={label}
                      animate={{
                        opacity: visible ? 1 : 0.22,
                        y: visible ? 0 : 8,
                      }}
                      className="anya-panel-preview__finding"
                      initial={false}
                      transition={{ duration: 0.28 }}
                    >
                      <Icon aria-hidden />
                      <div>
                        <span>{label}</span>
                        <strong>
                          {visible ? value : "Waiting for source response"}
                        </strong>
                      </div>
                      <span>{visible ? meta : "queued"}</span>
                    </motion.div>
                  );
                },
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="anya-panel-preview__footer">
        <span>
          <i className={stage === 4 ? "is-ready" : undefined} />
          {stage === 4 ? "CORRELATION COMPLETE" : "QUERYING PROVIDERS"}
        </span>
        <span>ILLUSTRATIVE WORKSPACE</span>
      </div>
    </div>
  );
}

function SearchQueryIcon() {
  return (
    <span aria-hidden className="anya-panel-preview__query-icon">
      <ScanSearch />
    </span>
  );
}

function SignalRouter({ moduleCount }: { moduleCount: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.45 });
  const reduceMotion = useReducedMotion();

  return (
    <div ref={ref} className="anya-signal-router">
      <div className="anya-signal-router__inputs">
        {ENTRY_POINTS.map(({ label, example, icon: Icon }, index) => (
          <motion.div
            key={label}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0.4, x: -10 }}
            className="anya-signal-router__input"
            transition={{
              delay: reduceMotion ? 0 : index * 0.08,
              duration: 0.35,
            }}
          >
            <Icon aria-hidden />
            <div>
              <span>{label}</span>
              <code>{example}</code>
            </div>
          </motion.div>
        ))}
      </div>

      <div aria-hidden className="anya-signal-router__rail">
        <span />
      </div>

      <motion.div
        animate={
          inView ? { opacity: 1, scale: 1 } : { opacity: 0.4, scale: 0.96 }
        }
        className="anya-signal-router__core"
        transition={{ delay: reduceMotion ? 0 : 0.28, duration: 0.4 }}
      >
        <Sparkles aria-hidden />
        <span>ANYA CROSS-REFERENCE</span>
        <strong>{moduleCount} intelligence modules</strong>
      </motion.div>
    </div>
  );
}

export function HomeShowcase() {
  return (
    <section className="anya-story anya-story--proof relative z-20 w-full">
      <div className="anya-story__inner">
        <header className="anya-story__split-head">
          <div>
            <p className="anya-story__eyebrow">FROM SIGNAL TO CONTEXT</p>
            <h2>
              Know who you&apos;re
              <span>dealing with.</span>
            </h2>
          </div>
          <p>
            Start with one piece of information. Anya follows the connected
            trail across identities, exposure, public records, and online
            accounts—then arranges what matters in one readable workspace.
          </p>
        </header>

        <PanelPreview />

        <div className="anya-proof-rail" role="list">
          <div role="listitem">
            <ScanSearch aria-hidden />
            <span>ONE ENTRY POINT</span>
            <strong>Search the signal you already have</strong>
          </div>
          <div role="listitem">
            <Network aria-hidden />
            <span>CROSS-SOURCE CONTEXT</span>
            <strong>See how the findings connect</strong>
          </div>
          <div role="listitem">
            <FolderLock aria-hidden />
            <span>CASE-READY OUTPUT</span>
            <strong>Keep the evidence and its source</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeHowItWorks({ moduleCount }: { moduleCount: number }) {
  return (
    <section className="anya-story anya-story--router relative z-20 w-full">
      <div className="anya-story__inner anya-story__router-grid">
        <div className="anya-story__copy">
          <p className="anya-story__eyebrow">START WITH WHAT YOU KNOW</p>
          <h2>
            One clue becomes
            <span>a connected map.</span>
          </h2>
          <p>
            You do not need to understand every database before you search. Anya
            recognizes the input, routes it to the relevant modules, and brings
            the useful signals back together.
          </p>
          <Link className="anya-story__text-link" href="/auth?action=register">
            Run a search
            <ArrowRight aria-hidden />
          </Link>
        </div>
        <SignalRouter moduleCount={moduleCount} />
      </div>
    </section>
  );
}

export function HomeAudiences() {
  return (
    <section className="anya-story anya-story--questions relative z-20 w-full">
      <div className="anya-story__inner">
        <header className="anya-story__section-head">
          <p className="anya-story__eyebrow">QUESTIONS HAVE STAKES</p>
          <h2>
            Answers for real life.
            <span>Depth for real investigations.</span>
          </h2>
          <p>
            A clear first answer when you need reassurance. A deeper trail when
            every alias, source, and pivot matters.
          </p>
        </header>

        <div className="anya-question-grid">
          {QUESTIONS.map(({ title, body, icon: Icon, index }) => (
            <article key={title} className="anya-question-card">
              <span className="anya-question-card__index">{index}</span>
              <Icon aria-hidden />
              <h3>{title}</h3>
              <p>{body}</p>
              <span aria-hidden className="anya-question-card__line" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeStatsStrip({ moduleCount }: { moduleCount: number }) {
  const stats = [
    { value: String(moduleCount), label: "Live intelligence modules" },
    { value: "223+", label: "Username surfaces" },
    { value: "1", label: "Connected case workspace" },
    { value: "24/7", label: "Provider health watch" },
  ] as const;

  return (
    <section className="anya-story anya-story--scale relative z-20 w-full">
      <div className="anya-story__inner">
        <div className="anya-scale-strip" role="list">
          {stats.map((stat) => (
            <div key={stat.label} role="listitem">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeTrust() {
  return (
    <section className="anya-story anya-story--trust relative z-20 w-full">
      <div className="anya-story__inner anya-trust-grid">
        <div className="anya-story__copy">
          <p className="anya-story__eyebrow">POWER WITHOUT AMBIGUITY</p>
          <h2>
            Evidence you can
            <span>understand and defend.</span>
          </h2>
          <p>
            Anya is built to support judgment—not replace it. Every useful hit
            should be reviewable, attributable, and handled with care.
          </p>
        </div>

        <div className="anya-trust-list">
          {TRUST_POINTS.map(({ title, body, icon: Icon }) => (
            <article key={title}>
              <span>
                <Icon aria-hidden />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
              <Check aria-hidden />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeFinalCta() {
  return (
    <section className="anya-story anya-story--final relative z-20 w-full">
      <div className="anya-story__inner">
        <div className="anya-final-card">
          <div>
            <p className="anya-story__eyebrow">START WITH ONE SIGNAL</p>
            <h2>See what connects.</h2>
            <p>
              Run an entry search now, or open Panel when the investigation
              needs every module and a place to keep the work.
            </p>
          </div>
          <div className="anya-final-card__actions">
            <Link href="/auth?action=register">
              Create account
              <ArrowRight aria-hidden />
            </Link>
            <Link href="/pricing">Compare plans</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
