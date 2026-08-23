"use client";

import type { CombSearchResult } from "@/lib/proxynova-comb";

import { useEffect, useMemo, useState } from "react";

import {
  ResultCard,
  ResultCardList,
  ResultStatStrip,
  type ResultCardFieldDef,
} from "@/components/dashboard/result-card";
import { ContactProfilesPanel } from "@/components/dashboard/contact-profiles-panel";
import { EmailAnalyzerPanel } from "@/components/dashboard/email-analyzer-panel";
import { FraudFootprintPanel } from "@/components/dashboard/fraud-footprint-panel";
import { IpIntelPanel } from "@/components/dashboard/ip-intel-panel";
import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { formatBreachCredentialAsText } from "@/lib/export-intel";
import {
  extractIpsFromTexts,
  isIpAddress,
  isIpFieldKey,
} from "@/lib/ip-detect";
import { normalizeDomain } from "@/lib/domain-search";
import { normalizeEmail } from "@/lib/proxynova-comb";

function collectIpsFromResult(result: CombSearchResult): string[] {
  const values: Array<string | null | undefined> = [];

  for (const row of result.credentials) {
    if (isIpAddress(row.identifier)) values.push(row.identifier);
    for (const field of row.fields ?? []) {
      if (isIpFieldKey(field.key) || isIpAddress(field.value)) {
        values.push(field.value);
      }
    }
  }

  return extractIpsFromTexts(values);
}

export function BreachesSearchResults({
  result,
  blurResults = false,
  blurNoticeIsGuest = false,
  selectedExportIndex = null,
  onSelectExportIndex,
  vaultId,
  claimToken,
  unlock,
  balance = 0,
  onUnlocked,
}: {
  result: CombSearchResult;
  blurResults?: boolean;
  blurNoticeIsGuest?: boolean;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
  vaultId?: string | null;
  claimToken?: string | null;
  unlock?: {
    reasons?: string[];
    creditCost?: number;
    planRequired?: string | null;
    allowCreditUnlock?: boolean;
    resultCount?: number;
  } | null;
  balance?: number;
  onUnlocked?: (payload: unknown) => void;
}) {
  const selectable = Boolean(onSelectExportIndex);
  const ips = useMemo(() => collectIpsFromResult(result), [result]);
  const [activeIp, setActiveIp] = useState<string | null>(ips[0] ?? null);
  const queryEmail = useMemo(
    () => normalizeEmail(result.query),
    [result.query],
  );
  const queryDomain = useMemo(
    () => normalizeDomain(result.query),
    [result.query],
  );
  const queryLabel = queryEmail ? "Email" : queryDomain ? "Domain" : "Username";
  const queryValue = queryEmail ?? queryDomain ?? result.query.trim();

  useEffect(() => {
    setActiveIp((current) => {
      if (current && ips.includes(current)) return current;

      return ips[0] ?? null;
    });
  }, [ips]);

  // Always derive from credential rows — never trust provider index ads.
  const shownCount = result.credentials.length;
  const matchCount = Math.max(
    shownCount,
    typeof result.totalMatches === "number" ? result.totalMatches : 0,
    typeof result.returned === "number" ? result.returned : 0,
  );

  return (
    <div className="anya-result-stack anya-result-stack--breaches home-search-results-stagger">
      <div className="anya-result-stack--breaches-stats grid gap-1.5 sm:grid-cols-2">
        <ResultStatStrip
          label="Total matches"
          value={matchCount.toLocaleString()}
        />
        <ResultStatStrip
          label="Shown"
          value={
            matchCount === 0
              ? "0"
              : `${shownCount.toLocaleString()} of ${matchCount.toLocaleString()}`
          }
        />
      </div>

      <div className="anya-breaches-layout">
        {/* LEFT — IP intel window + query email */}
        <div className="anya-breaches-col anya-breaches-col--left">
          {activeIp ? (
            <div className="anya-breaches-side-panel anya-breaches-side-panel--ip">
              {ips.length > 1 ? (
                <div
                  aria-label="IP addresses"
                  className="anya-breaches-ip-picker"
                  role="listbox"
                >
                  {ips.slice(0, 12).map((ip) => (
                    <button
                      key={ip}
                      aria-selected={ip === activeIp}
                      className={
                        ip === activeIp
                          ? "anya-breaches-ip-chip anya-breaches-ip-chip--active"
                          : "anya-breaches-ip-chip"
                      }
                      role="option"
                      type="button"
                      onClick={() => setActiveIp(ip)}
                    >
                      {blurResults ? "••••••••" : ip}
                    </button>
                  ))}
                </div>
              ) : null}
              <IpIntelPanel
                blurResults={blurResults}
                ip={activeIp}
                moduleSlug="breaches"
                variant="panel"
              />
            </div>
          ) : (
            <div className="anya-breaches-side-panel anya-breaches-side-panel--ip anya-breaches-side-panel--empty">
              <p className="anya-breaches-side-panel-empty">
                No IP addresses found in these breach hits.
              </p>
            </div>
          )}

          {queryValue ? (
            <div className="anya-breaches-email-label">
              <span className="anya-breaches-email-label-caption">
                {queryLabel}
              </span>
              <span className="anya-breaches-email-label-value">
                {blurResults ? "••••••••" : queryValue}
              </span>
            </div>
          ) : null}
        </div>

        {/* MIDDLE — all breach credential cards (no page cap) */}
        <div className="anya-breaches-col anya-breaches-col--main">
          <ResultCardList className="anya-result-list--dense-main">
            {result.credentials.map((row, index) => {
              const cardIndex = index + 1;
              const selected = selectedExportIndex === cardIndex;
              const connected = row.fields ?? [];
              const fields: ResultCardFieldDef[] = [
                {
                  key: "identifier",
                  label: "Email / login",
                  value: row.identifier,
                  highlight: true,
                },
                ...(row.secret
                  ? [
                      {
                        key: "password",
                        label: "Password",
                        value: row.secret,
                        sensitive: true,
                      },
                    ]
                  : []),
                ...connected.map((field) => ({
                  key: field.key,
                  label: field.label,
                  value: field.value,
                  sensitive: field.key === "password" || field.key === "hash",
                })),
              ];

              return (
                <ResultCard
                  key={`${row.raw}-${cardIndex}`}
                  badge={null}
                  blurResults={blurResults}
                  className="anya-result-card--dense"
                  copyText={formatBreachCredentialAsText(row, cardIndex)}
                  fields={fields}
                  indexLabel={cardIndex}
                  listIndex={index}
                  selectable={selectable}
                  selected={selected}
                  subtitle={row.identifier}
                  title={row.secret ? "Leaked credential" : "Match"}
                  onSelect={
                    selectable
                      ? () =>
                          onSelectExportIndex?.(selected ? -1 : cardIndex)
                      : undefined
                  }
                />
              );
            })}
          </ResultCardList>
        </div>

        {/* RIGHT — Email Analyzer + Contact Profiles + Fraud Footprint (email) */}
        <div className="anya-breaches-col anya-breaches-col--right">
          <EmailAnalyzerPanel
            blurResults={blurResults}
            omitContactProfiles
            query={result.query}
          />
          <ContactProfilesPanel
            blurResults={blurResults}
            query={result.query}
          />
          <FraudFootprintPanel
            blurResults={blurResults}
            query={result.query}
          />
        </div>
      </div>

      {blurResults ? (
        <ResultsBlurNotice
          balance={balance}
          claimToken={claimToken}
          isGuest={blurNoticeIsGuest}
          unlock={unlock}
          vaultId={vaultId}
          onUnlocked={onUnlocked}
        />
      ) : null}
    </div>
  );
}
