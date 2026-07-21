"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, Search, ShieldCheck } from "lucide-react";

import { AnimatedNumber } from "@/components/animated-price";
import { siteLogoSrc } from "@/config/branding";

const intelligenceSources = [
  { code: "BRK", name: "IntelX", value: "12 HITS" },
  { code: "USR", name: "Public records", value: "4 MATCHES" },
  { code: "PLT", name: "Social graph", value: "7 ALIASES" },
  { code: "NET", name: "Network intel", value: "2 ASSETS" },
];

const workspaceModules = [
  "AI Search",
  "Breach Intelligence",
  "Identity Pivot",
  "Public Records",
  "Network Intel",
];

export function AiCrossReferenceScene() {
  return (
    <div
      aria-label="AI search cross-referencing results from several intelligence sources"
      className="ai-correlation-scene"
      role="img"
    >
      <div className="product-scene-bar">
        <span>AI SEARCH / LIVE CORRELATION</span>
        <span>63 SOURCES IN PARALLEL</span>
      </div>

      <div className="ai-query-line">
        <Search aria-hidden />
        <span>target@example.com</span>
        <i>0.84S</i>
      </div>

      <div className="ai-correlation-body">
        <svg
          aria-hidden
          className="ai-correlation-lines"
          preserveAspectRatio="none"
          viewBox="0 0 1000 430"
        >
          <path d="M204 55 C350 55 365 194 500 214" />
          <path d="M204 155 C345 155 382 205 500 214" />
          <path d="M204 255 C345 255 382 224 500 214" />
          <path d="M204 355 C350 355 365 236 500 214" />
          <path className="is-resolved" d="M500 214 C646 214 692 214 805 214" />
        </svg>

        <div className="ai-source-stack">
          {intelligenceSources.map((source, index) => (
            <div
              key={source.code}
              className="ai-source-row"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <span>{source.code}</span>
              <strong>{source.name}</strong>
              <i>{source.value}</i>
            </div>
          ))}
        </div>

        <div className="ai-synthesis-core">
          <span className="ai-synthesis-logo">
            <Image
              unoptimized
              alt=""
              height={44}
              src={siteLogoSrc}
              width={44}
            />
          </span>
          <span>ANYA AI</span>
          <strong>CROSS-REFERENCING</strong>
        </div>

        <div className="ai-resolved-card">
          <span>RESOLVED IDENTITY</span>
          <strong>
            <AnimatedNumber value={94} />% confidence
          </strong>
          <div>
            <span>Primary alias</span>
            <b>northstar_01</b>
          </div>
          <div>
            <span>Linked accounts</span>
            <b>07 confirmed</b>
          </div>
          <div>
            <span>Exposure</span>
            <b>12 records</b>
          </div>
          <i>
            <ShieldCheck aria-hidden /> SOURCE-BACKED
          </i>
        </div>
      </div>
    </div>
  );
}

export function PremiumWorkspaceScene() {
  return (
    <div className="premium-workspace-scene">
      <div className="product-scene-bar">
        <span>ANYA / PROFESSIONAL WORKSPACE</span>
        <span>ALL MODULES ONLINE</span>
      </div>

      <div className="premium-workspace-body">
        <aside className="premium-module-rail">
          <span>MODULES / 63</span>
          {workspaceModules.map((module, index) => (
            <div key={module} className={index === 0 ? "is-active" : undefined}>
              <i>{String(index + 1).padStart(2, "0")}</i>
              <strong>{module}</strong>
              <Check aria-hidden />
            </div>
          ))}
        </aside>

        <div className="premium-workspace-main">
          <div className="premium-command">
            <span>COMMAND</span>
            <strong>Search any identity, network, asset, or platform…</strong>
            <ArrowUpRight aria-hidden />
          </div>

          <div className="premium-case-grid">
            <div className="premium-case-primary">
              <span>ACTIVE INVESTIGATION</span>
              <strong>Case 0172 / Identity exposure</strong>
              <div className="premium-progress">
                <i />
              </div>
              <small>47 sources resolved / 16 processing</small>
            </div>
            <div>
              <span>CASE GRAPH</span>
              <strong>18 linked signals</strong>
            </div>
            <div>
              <span>EXPORTS</span>
              <strong>Report ready</strong>
            </div>
          </div>

          <div className="premium-workspace-actions">
            <div>
              <span>SEARCH / CROSS-REFERENCE / PRESERVE / EXPORT</span>
              <strong>One workspace. No dead ends.</strong>
            </div>
            <Link href="/auth?action=register">
              Open the panel <ArrowUpRight aria-hidden />
            </Link>
            <Link href="/pricing">View plans</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
