"use client";

import Image from "next/image";
import { useEffect } from "react";
import { ArrowUpRight, CheckCircle2, Handshake, X } from "lucide-react";

import { siteConfig } from "@/config/site";

const RAINBET_URL = "https://rainbet.com/";

const highlights = [
  "Crypto-friendly gaming with fast deposits and withdrawals.",
  "Casino, sports, and originals in one place.",
  "Trusted platform our community recommends.",
];

type PartnerModalProps = {
  open: boolean;
  onClose: () => void;
};

export function PartnerModal({ open, onClose }: PartnerModalProps) {
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
        aria-label="Close partner popup"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />

      <div
        className="partner-modal relative z-10 w-full max-w-3xl overflow-hidden border border-white/10 bg-black/80 shadow-2xl shadow-black/50 backdrop-blur-2xl"
        role="dialog"
        aria-labelledby="partner-modal-title"
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

        <div className="border-b border-white/8 px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center gap-3 pr-10">
            <span className="anya-hero-kicker">
              <Handshake className="size-3.5" />
              Official partner
            </span>
            <span className="anya-pill">Proudly supported by Rainbet</span>
          </div>
        </div>

        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <h2
              className="font-[family-name:var(--font-bruno-ace-sc)] text-3xl tracking-wide text-white sm:text-4xl"
              id="partner-modal-title"
            >
              Check out <em className="not-italic text-[var(--anya-blush)]">Rainbet</em>
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-300">
              {siteConfig.name} partners with Rainbet to bring our community a go-to
              destination for online gaming. Explore casino, sports, and more — all
              in one place.
            </p>

            <ul className="mt-6 space-y-3">
              {highlights.map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm text-zinc-300">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--anya-blush)]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <a
              className="anya-run-btn mt-8 no-underline"
              href={RAINBET_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              Go to Rainbet
              <ArrowUpRight className="size-4" />
            </a>
          </div>

          <div className="anya-ai-brief flex flex-col items-start">
            <Image
              alt="Rainbet logo"
              className="size-16 rounded-xl"
              height={64}
              src="/images/rainbet-logo.png"
              width={64}
            />
            <p className="mt-4 text-lg font-semibold text-white">Rainbet</p>
            <p className="mt-5 text-sm leading-6 text-zinc-400">
              Head to the main Rainbet site to explore games, promos, and everything
              the platform has to offer.
            </p>
            <p className="mt-5 font-[family-name:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace] text-[0.68rem] uppercase tracking-[0.14em] text-zinc-500">
              rainbet.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
