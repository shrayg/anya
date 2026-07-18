"use client";

import { useState } from "react";

import { IntelSignalLoader } from "@/components/dashboard/intel-signal-loader";

/**
 * Local-only visual preview for the search signal lattice.
 * Visit http://localhost:3000/dev/signal-loader
 */
export default function SignalLoaderPreviewPage() {
  const [active, setActive] = useState(true);
  const [variant, setVariant] = useState<"hero" | "compact">("hero");

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-zinc-100 md:px-10">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 15% 90%, rgba(240,164,184,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 85% 10%, rgba(255,255,255,0.04), transparent 50%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--anya-blush)]">
          Preview
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Intel signal lattice
        </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">
          This is the loader that appears under the search bar while a module
          run is in flight. Toggle controls below — no login required.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/30"
            onClick={() => setActive((v) => !v)}
            type="button"
          >
            {active ? "Stop" : "Start"} animation
          </button>
          <button
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/30"
            onClick={() =>
              setVariant((v) => (v === "hero" ? "compact" : "hero"))
            }
            type="button"
          >
            Variant: {variant}
          </button>
        </div>

        <section className="ui-panel mt-10">
          <div className="ui-panel-body">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="ui-input flex-1 font-mono text-sm"
                defaultValue="https://www.instagram.com/keeganhoyne/"
                readOnly
              />
              <button
                className="ui-btn ui-btn-primary shrink-0 sm:min-w-[6.5rem]"
                disabled={active}
                type="button"
              >
                {active ? "Scanning…" : "Run"}
              </button>
            </div>
          </div>
        </section>

        {active ? (
          <IntelSignalLoader active title="Instagram" variant={variant} />
        ) : (
          <p className="mt-10 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
            Animation stopped — hit Start to replay.
          </p>
        )}

        <p className="mt-6 text-xs text-zinc-600">
          Dev route only — not linked from the product nav.
        </p>
      </div>
    </main>
  );
}
