"use client";

import { useRef } from "react";
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  BriefcaseBusiness,
  CircleUserRound,
  FolderLock,
  Globe2,
  Hash,
  Layers3,
  LockKeyhole,
  Network,
  ScanSearch,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import Link from "next/link";

import { Reveal } from "@/components/craft/reveal";
import ScrollFloat from "@/components/scroll-float";
import { SpecularButton } from "@/components/ui/specular-button";

const ENTRY_POINTS = [
  {
    label: "Email",
    example: "m.reyes@proton.me",
    icon: AtSign,
    slot: "nw",
  },
  {
    label: "Phone",
    example: "+1 415 555 0198",
    icon: Smartphone,
    slot: "ne",
  },
  {
    label: "Username",
    example: "northstar",
    icon: CircleUserRound,
    slot: "sw",
  },
  {
    label: "Discord",
    example: "@northstar",
    icon: Hash,
    slot: "se",
  },
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

const ROUTER_EASE = [0.22, 1, 0.36, 1] as const;

function SignalRouter({ moduleCount }: { moduleCount: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35, once: true });
  const reduceMotion = useReducedMotion();

  return (
    <div
      ref={ref}
      aria-label={`One clue becomes a connected map across ${moduleCount} intelligence modules`}
      className={inView ? "anya-signal-fan is-live" : "anya-signal-fan"}
      data-reduced-motion={reduceMotion ? "true" : undefined}
    >
      <svg
        aria-hidden
        className="anya-signal-fan__rays"
        fill="none"
        viewBox="0 0 480 320"
      >
        <path d="M96 64 L240 160" pathLength={1} />
        <path d="M384 64 L240 160" pathLength={1} />
        <path d="M96 256 L240 160" pathLength={1} />
        <path d="M384 256 L240 160" pathLength={1} />
      </svg>

      {ENTRY_POINTS.map(({ label, example, icon: Icon, slot }, index) => (
        <motion.div
          key={label}
          animate={
            inView
              ? { opacity: 1, y: 0 }
              : {
                  opacity: reduceMotion ? 1 : 0,
                  y: reduceMotion ? 0 : 12,
                }
          }
          className="anya-signal-fan__chip"
          data-slot={slot}
          transition={{
            delay: reduceMotion ? 0 : 0.08 + index * 0.1,
            duration: 0.55,
            ease: ROUTER_EASE,
          }}
        >
          <Icon aria-hidden />
          <div>
            <span>{label}</span>
            <strong>{example}</strong>
          </div>
        </motion.div>
      ))}

      <div className="anya-signal-fan__hub">
        <motion.div
          animate={
            inView
              ? { opacity: 1, y: 0 }
              : {
                  opacity: reduceMotion ? 1 : 0,
                  y: reduceMotion ? 0 : 10,
                }
          }
          className="anya-signal-fan__hub-inner"
          transition={{
            delay: reduceMotion ? 0 : 0.42,
            duration: 0.6,
            ease: ROUTER_EASE,
          }}
        >
          <p className="anya-signal-fan__brand">Anya</p>
          <p className="anya-signal-fan__meta">
            <strong>{moduleCount}</strong>
            <span>modules in the map</span>
          </p>
        </motion.div>
      </div>
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
            <ScrollFloat
              lines={[
                "Know who you're",
                { text: "dealing with.", accent: true },
              ]}
            />
          </div>
          <p>
            Start with one piece of information. Anya follows the connected
            trail across identities, exposure, public records, and online
            accounts—then arranges what matters in one readable workspace.
          </p>
        </header>

        <Reveal className="anya-proof-rail" role="list" y={22}>
          <div role="listitem">
            <span className="anya-proof-rail__step" aria-hidden>
              01
            </span>
            <ScanSearch aria-hidden />
            <span>ONE ENTRY POINT</span>
            <strong>Search the signal you already have</strong>
          </div>
          <div role="listitem">
            <span className="anya-proof-rail__step" aria-hidden>
              02
            </span>
            <Network aria-hidden />
            <span>CROSS-SOURCE CONTEXT</span>
            <strong>See how the findings connect</strong>
          </div>
          <div role="listitem">
            <span className="anya-proof-rail__step" aria-hidden>
              03
            </span>
            <FolderLock aria-hidden />
            <span>CASE-READY OUTPUT</span>
            <strong>Keep the evidence and its source</strong>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function HomeHowItWorks({ moduleCount }: { moduleCount: number }) {
  return (
    <section className="anya-story anya-story--router relative z-20 w-full">
      <div className="anya-story__inner anya-story__router-stage">
        <header className="anya-story__router-head">
          <p className="anya-story__eyebrow">START WITH WHAT YOU KNOW</p>
          <ScrollFloat
            lines={[
              "One clue becomes",
              { text: "a connected map.", accent: true },
            ]}
          />
          <p>
            Drop in an email, phone, username, or platform ID. Anya recognizes
            the signal, fans it across the modules that matter, and returns a
            readable map—not a pile of raw hits.
          </p>
        </header>

        <Reveal y={18}>
          <SignalRouter moduleCount={moduleCount} />
        </Reveal>

        <Link className="anya-story__text-link" href="/auth?action=register">
          Run a search
          <ArrowRight aria-hidden />
        </Link>
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
          <ScrollFloat
            lines={[
              "Answers for real life.",
              { text: "Depth for real investigations.", accent: true },
            ]}
          />
          <p>
            A clear first answer when you need reassurance. A deeper trail when
            every alias, source, and pivot matters.
          </p>
        </header>

        <Reveal className="anya-question-grid" y={24}>
          {QUESTIONS.map(({ title, body, icon: Icon, index }) => (
            <article key={title} className="anya-question-card">
              <div className="anya-question-card__meta">
                <span className="anya-question-card__index">{index}</span>
                <Icon aria-hidden />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </Reveal>
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
        <Reveal className="anya-scale-strip" role="list" y={16}>
          {stats.map((stat) => (
            <div key={stat.label} role="listitem">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </Reveal>
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
          <ScrollFloat
            lines={[
              "Evidence you can",
              { text: "understand and defend.", accent: true },
            ]}
          />
          <p>
            Anya is built to support judgment—not replace it. Every useful hit
            should be reviewable, attributable, and handled with care.
          </p>
        </div>

        <Reveal className="anya-trust-list" y={22}>
          {TRUST_POINTS.map(({ title, body, icon: Icon }, i) => (
            <article key={title}>
              <span className="anya-trust-list__index" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="anya-trust-list__icon">
                <Icon aria-hidden />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

export function HomeFinalCta() {
  return (
    <section className="anya-story anya-story--final relative z-20 w-full">
      <div className="anya-story__inner">
        <Reveal className="anya-final-card" y={20}>
          <div>
            <p className="anya-story__eyebrow">START WITH ONE SIGNAL</p>
            <h2>See what connects.</h2>
            <p>
              Run an entry search now, or compare plans when you need every
              module and a place to keep the work.
            </p>
          </div>
          <div className="anya-final-card__actions">
            <SpecularButton
              accent
              autoAnimate
              href="/auth?action=register"
              radius={999}
              size="md"
            >
              Create account
              <ArrowRight aria-hidden />
            </SpecularButton>
            <Link href="/pricing">Compare plans</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
