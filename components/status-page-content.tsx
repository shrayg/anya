"use client";

import type {
  PublicStatusLevel,
  PublicStatusPayload,
  PublicStatusService,
} from "@/lib/public-status";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Activity, RefreshCw } from "lucide-react";

import { siteConfig } from "@/config/site";
import { Reveal } from "@/components/craft/reveal";
import { SpecularButton } from "@/components/ui/specular-button";

type StatusHistorySeries = {
  segments: PublicStatusLevel[];
  uptimePercent: number;
};

const STATUS_LABEL: Record<PublicStatusLevel, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
};

const OVERALL_COPY: Record<PublicStatusLevel, string> = {
  operational: "All systems operational",
  degraded: "Some systems are degraded",
  outage: "Service disruption detected",
};

function statusDotClass(status: PublicStatusLevel) {
  if (status === "operational")
    return "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]";
  if (status === "degraded")
    return "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]";

  return "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.55)]";
}

function statusTextClass(status: PublicStatusLevel) {
  if (status === "operational") return "text-emerald-300";
  if (status === "degraded") return "text-amber-300";

  return "text-rose-300";
}

function segmentBarClass(status: PublicStatusLevel) {
  if (status === "operational") return "bg-emerald-500/90 hover:bg-emerald-400";
  if (status === "degraded") return "bg-amber-400/90 hover:bg-amber-300";

  return "bg-rose-500/90 hover:bg-rose-400";
}

function formatCheckedAt(iso: string | null) {
  if (!iso) return "Checking…";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatUptime(pct: number) {
  if (!Number.isFinite(pct)) return "—";

  return `${pct.toFixed(2)}%`;
}

function groupServices(services: PublicStatusService[]) {
  const order = ["Platform", "Intelligence"];
  const map = new Map<string, PublicStatusService[]>();

  for (const service of services) {
    const list = map.get(service.group) ?? [];

    list.push(service);
    map.set(service.group, list);
  }

  const groups = [...map.entries()].sort((a, b) => {
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);

    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return groups;
}

function UptimeTimeline({
  series,
  compact = false,
}: {
  series: StatusHistorySeries | null | undefined;
  compact?: boolean;
}) {
  if (!series || series.segments.length === 0) return null;

  const days = series.segments.length;

  return (
    <div className={clsx("w-full", compact ? "mt-3" : "mt-5")}>
      <div
        aria-label={`Uptime over the last ${days} days, ${formatUptime(series.uptimePercent)}`}
        className={clsx(
          "flex w-full gap-px overflow-hidden rounded-sm",
          compact ? "h-7" : "h-8",
        )}
        role="img"
      >
        {series.segments.map((status, index) => (
          <span
            key={index}
            className={clsx(
              "status-timeline-segment min-w-0 flex-1 transition-colors",
              segmentBarClass(status),
            )}
            style={{ animationDelay: `${index * 7}ms` }}
            title={`${STATUS_LABEL[status]} · day ${index + 1}/${days}`}
          />
        ))}
      </div>
      <div
        className={clsx(
          "mt-1.5 flex items-center justify-between text-zinc-500",
          compact ? "text-[0.65rem]" : "text-xs",
        )}
      >
        <span>Last {days}d</span>
        <span className="tabular-nums text-zinc-400">
          {formatUptime(series.uptimePercent)} uptime
        </span>
      </div>
    </div>
  );
}

export function StatusPageContent() {
  const [data, setData] = useState<PublicStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/status", { cache: "no-store" });

      if (!res.ok) throw new Error("Unable to load status");
      const json = (await res.json()) as PublicStatusPayload;

      setData(json);
      setError(null);
    } catch {
      setError("Status checks are temporarily unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const id = window.setInterval(() => void load(true), 60_000);

    return () => window.clearInterval(id);
  }, [load]);

  const overall: PublicStatusLevel = data?.overall ?? "degraded";
  const groups = useMemo(
    () => (data ? groupServices(data.services) : []),
    [data],
  );

  return (
    <section className="brutal-page brutal-status-page relative z-20 mx-auto w-full max-w-3xl px-2 pb-20 pt-4 md:pt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -top-16 h-64 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(240,164,184,0.12),transparent_70%)] blur-2xl"
      />

      <Reveal mode="mount">
        <header className="brutal-page-header relative mb-10 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="craft-kicker">
              <Activity className="size-3.5" />
              System status
            </p>
            <span className="anya-pill">{siteConfig.name}</span>
          </div>

          <h1 className="craft-display text-3xl md:text-5xl">
            Platform status
          </h1>
          <p className="craft-lede">
            Live health for {siteConfig.name} core services. Checks refresh
            about every minute.
          </p>
        </header>
      </Reveal>

      <Reveal delay={0.08} mode="mount">
        <div
          className={clsx(
            "relative mb-10 overflow-hidden rounded-2xl border px-5 py-5 sm:px-6",
            overall === "operational" &&
              "border-emerald-400/25 bg-emerald-500/[0.07]",
            overall === "degraded" && "border-amber-400/25 bg-amber-500/[0.07]",
            overall === "outage" && "border-rose-500/30 bg-rose-500/[0.08]",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={clsx(
                  "mt-1.5 size-3 shrink-0 rounded-full",
                  statusDotClass(overall),
                )}
              />
              <div>
                <p
                  className={clsx(
                    "text-lg font-semibold",
                    statusTextClass(overall),
                  )}
                >
                  {loading && !data
                    ? "Checking systems…"
                    : OVERALL_COPY[overall]}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Last checked {formatCheckedAt(data?.checkedAt ?? null)}
                  {data?.cached ? " · cached" : null}
                </p>
              </div>
            </div>

            <SpecularButton
              className="gap-2 px-3 py-2 text-sm"
              disabled={loading || refreshing}
              size="sm"
              type="button"
              onClick={() => void load(true)}
            >
              <RefreshCw
                className={clsx(
                  "size-3.5",
                  (loading || refreshing) && "animate-spin",
                )}
              />
              Refresh
            </SpecularButton>
          </div>

          {data ? (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-xs text-zinc-500">
              <span>
                <span className="text-emerald-300">
                  {data.summary.operational}
                </span>{" "}
                operational
              </span>
              <span>
                <span className="text-amber-300">{data.summary.degraded}</span>{" "}
                degraded
              </span>
              <span>
                <span className="text-rose-300">{data.summary.outage}</span>{" "}
                outage
              </span>
            </div>
          ) : null}

          <UptimeTimeline series={data?.history?.overall} />
        </div>
      </Reveal>

      {error && !data ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="space-y-10">
        {loading && !data
          ? ["Platform", "Intelligence"].map((group) => (
              <div key={group} className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {group}
                </h2>
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-[5.5rem] animate-pulse rounded-xl border border-white/8 bg-white/[0.03]"
                    />
                  ))}
                </div>
              </div>
            ))
          : groups.map(([group, services], groupIndex) => (
              <Reveal key={group} delay={0.12 + groupIndex * 0.07} mode="mount">
                <div key={group} className="space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {group}
                  </h2>
                  <ul className="space-y-2">
                    {services.map((service) => (
                      <li
                        key={service.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-white/15 hover:bg-white/[0.045] sm:px-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={clsx(
                                  "size-2.5 shrink-0 rounded-full",
                                  statusDotClass(service.status),
                                )}
                              />
                              <p className="font-medium text-white">
                                {service.name}
                              </p>
                            </div>
                            <p className="mt-1.5 pl-5 text-sm leading-5 text-zinc-500">
                              {service.description}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p
                              className={clsx(
                                "text-sm font-medium",
                                statusTextClass(service.status),
                              )}
                            >
                              {STATUS_LABEL[service.status]}
                            </p>
                          </div>
                        </div>
                        <UptimeTimeline
                          compact
                          series={data?.history?.services?.[service.id]}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
      </div>

      <p className="mt-12 text-sm leading-6 text-zinc-500">
        Timeline bars show the last 90 days — green operational, amber degraded,
        red outage. For incidents, reach us on{" "}
        <a
          className="text-zinc-300 underline-offset-4 hover:underline"
          href={siteConfig.links.telegram}
          rel="noreferrer"
          target="_blank"
        >
          Telegram
        </a>{" "}
        or{" "}
        <a
          className="text-zinc-300 underline-offset-4 hover:underline"
          href={`mailto:${siteConfig.links.supportEmail}`}
        >
          {siteConfig.links.supportEmail}
        </a>
        .
      </p>
    </section>
  );
}
