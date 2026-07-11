"use client";

import Link from "next/link";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { themeAccent } from "@/config/branding";
import type { AiIntelResult } from "@/lib/ai-intel";

function riskColor(score: number) {
  if (score >= 75) return "#f87171";
  if (score >= 50) return "#fb923c";
  if (score >= 25) return themeAccent.blush;
  return "#86efac";
}

export function AiSearchResults({
  result,
  blurResults = false,
}: {
  result: AiIntelResult;
  blurResults?: boolean;
}) {
  const meterColor = riskColor(result.riskScore);

  return (
    <div className="anya-ai-results space-y-5">
      <div className="anya-ai-brief">
        <div className="anya-ai-brief-header">
          <span className="anya-ai-mode-tag">{result.mode.replace(/-/g, " ")}</span>
          <div className="flex flex-wrap items-center gap-2">
            {result.confidence !== undefined && (
              <span className="anya-ai-confidence">
                <BlurredValue forceBlur={blurResults} text={`${result.confidence}% confidence`} />
              </span>
            )}
            <span
              className="anya-ai-risk-pill"
              style={{ borderColor: `${meterColor}55`, color: meterColor }}
            >
              <BlurredValue
                forceBlur={blurResults}
                text={`${result.riskLabel} · ${result.riskScore}`}
              />
            </span>
          </div>
        </div>
        <p className="anya-ai-brief-text">
          <BlurredValue forceBlur={blurResults} text={result.aiBrief} />
        </p>
        <div className="anya-ai-meter">
          <div
            className="anya-ai-meter-fill"
            style={{
              width: `${result.riskScore}%`,
              background: `linear-gradient(90deg, #86efac, ${themeAccent.blush}, ${meterColor})`,
            }}
          />
        </div>
      </div>

      {result.insights && result.insights.length > 0 && (
        <div className="anya-ai-insights">
          <p className="anya-ai-insights-title">AI insights</p>
          <ul>
            {result.insights.map((insight) => (
              <li key={insight}>
                <BlurredValue forceBlur={blurResults} text={insight} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.entities.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {result.entities.map((entity) => (
            <div key={entity.label} className="anya-result-strip">
              <p className="anya-result-label">{entity.label}</p>
              <p className="anya-result-value">
                <BlurredValue forceBlur={blurResults} text={entity.value} />
              </p>
            </div>
          ))}
        </div>
      )}

      {result.signals.length > 0 && (
        <div>
          <p className="mb-2 font-[family-name:var(--font-bruno-ace-sc)] text-xs tracking-wide text-zinc-400">
            Signals
          </p>
          <div className="space-y-2">
            {result.signals.map((signal) => (
              <div
                key={`${signal.title}-${signal.detail}`}
                className={`anya-ai-signal anya-ai-signal--${signal.level}`}
              >
                <p className="anya-ai-signal-title">
                  <BlurredValue forceBlur={blurResults} text={signal.title} />
                </p>
                <p className="anya-ai-signal-detail">
                  <BlurredValue forceBlur={blurResults} text={signal.detail} />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.pivots && result.pivots.length > 0 && (
        <div className="anya-ai-pivots">
          <p className="anya-ai-pivots-title">Suggested pivots</p>
          <div className="flex flex-wrap gap-2">
            {result.pivots.map((pivot) => (
              <Link
                key={`${pivot.slug}-${pivot.label}`}
                className="anya-ai-pivot-chip"
                href={`/dashboard/search/${pivot.slug}`}
                title={pivot.reason}
              >
                <span>
                  <BlurredValue forceBlur={blurResults} text={pivot.label} />
                </span>
                <span className="anya-ai-pivot-arrow">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div className="anya-ai-recs">
          <p className="anya-ai-recs-title">Next moves</p>
          <ul>
            {result.recommendations.map((rec) => (
              <li key={rec}>
                <BlurredValue forceBlur={blurResults} text={rec} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {blurResults ? <ResultsBlurNotice /> : null}

      <p className="text-[10px] uppercase tracking-widest text-zinc-600">
        Sources: {result.sources.join(" · ")} · {result.elapsedMs}ms
      </p>
    </div>
  );
}
