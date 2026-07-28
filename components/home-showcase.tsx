"use client";

import { useRef } from "react";
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
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
  Sparkles,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import Link from "next/link";

import ScrollFloat from "@/components/scroll-float";
import { PanelDemo } from "@/components/panel-demo";

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

        <PanelDemo />

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
          <ScrollFloat
            lines={[
              "One clue becomes",
              { text: "a connected map.", accent: true },
            ]}
          />
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
