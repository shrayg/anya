"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  AtSign,
  CircleUserRound,
  Database,
  FileSearch,
  Fingerprint,
  Globe2,
  KeyRound,
  Link2,
  Network,
  ScanSearch,
  ShieldAlert,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { ThinkingOrb } from "thinking-orbs";

import { siteConfig } from "@/config/site";

type DemoFinding = {
  label: string;
  value: string;
  meta: string;
  icon: LucideIcon;
};

type DemoModule = {
  id: string;
  label: string;
  icon: LucideIcon;
  query: string;
  subject: string;
  initials: string;
  blurb: string;
  confidence: number;
  sources: number;
  caseId: string;
  statusReady: string;
  statusBusy: string;
  findings: DemoFinding[];
};

const DEMO_MODULES: DemoModule[] = [
  {
    id: "identity",
    label: "Identity search",
    icon: Fingerprint,
    query: "alex.morgan@example.com",
    subject: "Alex Morgan",
    initials: "AM",
    blurb: "Identity cluster assembled from public signals",
    confidence: 92,
    sources: 8,
    caseId: "ANYA-0172",
    statusReady: "CASE READY",
    statusBusy: "CORRELATING",
    findings: [
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
    ],
  },
  {
    id: "breach",
    label: "Breach & stealer",
    icon: KeyRound,
    query: "alex.morgan@example.com",
    subject: "Credential exposure",
    initials: "CE",
    blurb: "Stealer + breach hits correlated to the active query",
    confidence: 86,
    sources: 5,
    caseId: "ANYA-0172",
    statusReady: "HITS READY",
    statusBusy: "SCANNING LOGS",
    findings: [
      {
        label: "Breach references",
        value: "2 collections matched",
        meta: "review advised",
        icon: Database,
      },
      {
        label: "Stealer cookies",
        value: "1 session trail",
        meta: "medium risk",
        icon: ShieldAlert,
      },
      {
        label: "Password reuse",
        value: "Same hash family",
        meta: "2 services",
        icon: KeyRound,
      },
    ],
  },
  {
    id: "platform",
    label: "Platform intelligence",
    icon: AtSign,
    query: "@alexmorgan",
    subject: "Alex Morgan",
    initials: "AM",
    blurb: "Public profiles linked across social surfaces",
    confidence: 78,
    sources: 6,
    caseId: "ANYA-0172",
    statusReady: "PROFILES READY",
    statusBusy: "SWEEPING HANDLES",
    findings: [
      {
        label: "Handle matches",
        value: "4 exact / 2 fuzzy",
        meta: "6 platforms",
        icon: AtSign,
      },
      {
        label: "Avatar cluster",
        value: "Same face crop family",
        meta: "3 images",
        icon: CircleUserRound,
      },
      {
        label: "Bio pivots",
        value: "Email + city cues",
        meta: "2 sources",
        icon: Globe2,
      },
    ],
  },
  {
    id: "records",
    label: "Public records",
    icon: FileSearch,
    query: "Alex Morgan, VA",
    subject: "Public record set",
    initials: "PR",
    blurb: "Court, address, and registry signals for the subject",
    confidence: 71,
    sources: 4,
    caseId: "ANYA-0172",
    statusReady: "RECORDS READY",
    statusBusy: "QUERYING DOCKETS",
    findings: [
      {
        label: "Address history",
        value: "2 residences",
        meta: "VA / MD",
        icon: FileSearch,
      },
      {
        label: "Phone links",
        value: "1 landline / 1 mobile",
        meta: "carrier open",
        icon: Smartphone,
      },
      {
        label: "Name variants",
        value: "A. Morgan · Alex M.",
        meta: "2 aliases",
        icon: CircleUserRound,
      },
    ],
  },
  {
    id: "network",
    label: "Network & assets",
    icon: Network,
    query: "203.0.113.42",
    subject: "Infrastructure node",
    initials: "IP",
    blurb: "Hosting, ASN, and related asset fan-out",
    confidence: 84,
    sources: 7,
    caseId: "ANYA-0172",
    statusReady: "ASSETS READY",
    statusBusy: "MAPPING NODES",
    findings: [
      {
        label: "ASN owner",
        value: "Example Transit LLC",
        meta: "AS64500",
        icon: Network,
      },
      {
        label: "Open services",
        value: "3 ports observed",
        meta: "low noise",
        icon: Globe2,
      },
      {
        label: "Related domains",
        value: "2 hostnames",
        meta: "shared IP",
        icon: Link2,
      },
    ],
  },
];

type PanelDemoProps = {
  className?: string;
  /** Compact shell for embedding inside dashboard panels */
  compact?: boolean;
};

export function PanelDemo({ className, compact = false }: PanelDemoProps) {
  const reduceMotion = useReducedMotion();
  const [moduleId, setModuleId] = useState(DEMO_MODULES[0].id);
  const [stage, setStage] = useState(reduceMotion ? 4 : 0);
  const [selectedFinding, setSelectedFinding] = useState<number | null>(null);
  const [runKey, setRunKey] = useState(0);

  const active =
    DEMO_MODULES.find((module) => module.id === moduleId) ?? DEMO_MODULES[0];

  useEffect(() => {
    if (reduceMotion) {
      setStage(4);
      return;
    }

    setStage(0);
    setSelectedFinding(null);
    const timers = [
      window.setTimeout(() => setStage(1), 180),
      window.setTimeout(() => setStage(2), 480),
      window.setTimeout(() => setStage(3), 820),
      window.setTimeout(() => setStage(4), 1180),
    ];

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [moduleId, runKey, reduceMotion]);

  const selectModule = (id: string) => {
    if (id === moduleId) {
      setRunKey((key) => key + 1);
      return;
    }
    setModuleId(id);
  };

  const ready = stage === 4;
  const ActiveIcon = active.icon;

  return (
    <div
      aria-label="Illustrative Anya panel demo — clicks stay inside this preview"
      className={[
        "anya-panel-preview",
        compact ? "anya-panel-preview--compact" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="anya-panel-preview__topbar">
        <div aria-hidden className="anya-panel-preview__dots">
          <span />
          <span />
          <span />
        </div>
        <span>
          {siteConfig.navName} / PANEL
        </span>
        <span className={ready ? "is-ready" : "is-running"}>
          {ready ? active.statusReady : active.statusBusy}
        </span>
      </div>

      <div className="anya-panel-preview__shell">
        <aside
          aria-label="Demo modules"
          className="anya-panel-preview__sidebar"
        >
          <div className="anya-panel-preview__mark">
            <ScanSearch aria-hidden />
            <span>MODULES</span>
          </div>
          <ul>
            {DEMO_MODULES.map((module) => {
              const Icon = module.icon;
              const isActive = module.id === active.id;

              return (
                <li key={module.id}>
                  <button
                    aria-pressed={isActive}
                    className={
                      isActive
                        ? "anya-panel-preview__nav is-active"
                        : "anya-panel-preview__nav"
                    }
                    type="button"
                    onClick={() => selectModule(module.id)}
                  >
                    <Icon aria-hidden />
                    <span>{module.label}</span>
                    {isActive ? (
                      <span className="anya-panel-preview__live" />
                    ) : (
                      <span className="anya-panel-preview__nav-spacer" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="anya-panel-preview__case-count">
            <span>OPEN CASE</span>
            <strong>{active.caseId}</strong>
          </div>
        </aside>

        <div className="anya-panel-preview__main">
          <div className="anya-panel-preview__mobile-nav" role="tablist">
            {DEMO_MODULES.map((module) => {
              const Icon = module.icon;
              const isActive = module.id === active.id;

              return (
                <button
                  key={module.id}
                  aria-pressed={isActive}
                  className={
                    isActive
                      ? "anya-panel-preview__chip is-active"
                      : "anya-panel-preview__chip"
                  }
                  type="button"
                  onClick={() => selectModule(module.id)}
                >
                  <Icon aria-hidden />
                  <span>{module.label}</span>
                </button>
              );
            })}
          </div>

          <button
            className="anya-panel-preview__query"
            type="button"
            onClick={() => setRunKey((key) => key + 1)}
          >
            <span aria-hidden className="anya-panel-preview__query-icon">
              <ActiveIcon />
            </span>
            <div>
              <span>ACTIVE QUERY</span>
              <strong>{active.query}</strong>
            </div>
            <span className="anya-panel-preview__query-state">
              {ready
                ? `${active.sources} SOURCES`
                : `${Math.min(stage * 2, active.sources)} / ${active.sources}`}
            </span>
          </button>

          <div className="anya-panel-preview__workspace">
            <div className="anya-panel-preview__identity">
              <div className="anya-panel-preview__profile">
                <div aria-hidden className="anya-panel-preview__avatar">
                  {active.initials}
                </div>
                <div>
                  <span>RESOLVED SUBJECT</span>
                  <strong>{active.subject}</strong>
                  <p>{active.blurb}</p>
                </div>
                <button
                  className="anya-panel-preview__confidence"
                  type="button"
                  onClick={() => setRunKey((key) => key + 1)}
                >
                  <strong>{stage >= 3 ? active.confidence : "--"}</strong>
                  <span>CONFIDENCE</span>
                </button>
              </div>

              <div aria-hidden className="anya-panel-preview__orb-stage">
                <div className="anya-panel-preview__orb">
                  <ThinkingOrb
                    paused={Boolean(reduceMotion) || ready}
                    size={64}
                    speed={1.05}
                    state={ready ? "searching" : "searching"}
                    theme="dark"
                  />
                </div>
                <p className="anya-panel-preview__orb-caption">
                  {ready ? "Correlation complete" : "Searching sources"}
                </p>
              </div>
            </div>

            <div className="anya-panel-preview__findings">
              <div className="anya-panel-preview__findings-head">
                <span>FINDINGS</span>
                <span>
                  {ready
                    ? `${active.findings.length} VERIFIED`
                    : "BUILDING"}
                </span>
              </div>
              {active.findings.map(
                ({ label, value, meta, icon: Icon }, index) => {
                  const visible = stage >= index + 2;
                  const selected = selectedFinding === index;

                  return (
                    <motion.button
                      key={`${active.id}-${label}`}
                      animate={{
                        opacity: visible ? 1 : 0.22,
                        y: visible ? 0 : 8,
                      }}
                      className={
                        selected
                          ? "anya-panel-preview__finding is-selected"
                          : "anya-panel-preview__finding"
                      }
                      disabled={!visible}
                      initial={false}
                      transition={{ duration: 0.28 }}
                      type="button"
                      onClick={() =>
                        setSelectedFinding((current) =>
                          current === index ? null : index,
                        )
                      }
                    >
                      <Icon aria-hidden />
                      <div>
                        <span>{label}</span>
                        <strong>
                          {visible ? value : "Waiting for source response"}
                        </strong>
                      </div>
                      <span>{visible ? meta : "queued"}</span>
                    </motion.button>
                  );
                },
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="anya-panel-preview__footer">
        <span>
          <i className={ready ? "is-ready" : undefined} />
          {ready ? "DEMO INTERACTIVE — NOTHING IS LIVE" : "QUERYING PROVIDERS"}
        </span>
        <span>CLICK MODULES TO EXPLORE</span>
      </div>
    </div>
  );
}

export default PanelDemo;
