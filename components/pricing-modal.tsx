"use client";

import { useEffect } from "react";
import { CreditCard, X } from "lucide-react";

import { PricingPlansGrid } from "@/components/pricing-plans";

type PricingModalProps = {
  open: boolean;
  onClose: () => void;
};

export function PricingModal({ open, onClose }: PricingModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        aria-label="Close pricing popup"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />

      <div
        className="partner-modal relative z-10 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-black/80 shadow-2xl shadow-black/50 backdrop-blur-2xl"
        role="dialog"
        aria-labelledby="pricing-modal-title"
        aria-modal="true"
      >
        <button
          aria-label="Close"
          className="absolute right-4 top-4 z-20 rounded-lg border border-white/10 bg-black/40 p-2 text-zinc-400 transition hover:border-anya-accent-soft hover:bg-white/5 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>

        <div className="shrink-0 border-b border-white/8 px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center gap-3 pr-10">
            <span className="anya-hero-kicker">
              <CreditCard className="size-3.5" />
              Plans & pricing
            </span>
            <span className="anya-pill">Choose the tier that fits your workflow</span>
          </div>
          <h2
            className="mt-4 font-[family-name:var(--font-bruno-ace-sc)] text-2xl tracking-wide text-white sm:text-3xl"
            id="pricing-modal-title"
          >
            Simple monthly pricing
          </h2>
        </div>

        <div className="overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
          <PricingPlansGrid onGetStarted={onClose} />
        </div>
      </div>
    </div>
  );
}
