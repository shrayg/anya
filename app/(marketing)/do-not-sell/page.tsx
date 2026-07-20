"use client";

import { useState } from "react";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { siteConfig } from "@/config/site";

export default function DoNotSellPage() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <LegalPage
      title="Do Not Sell or Share My Personal Information"
      updated="July 15, 2026"
    >
      <LegalSection title="Our practice">
        <p>
          We do not sell personal information for money. We also do not share
          your search results with advertisers. Some US state privacy laws use
          broader definitions of “sale” or “share” that can include certain
          cross-context advertising disclosures. Anya.Int does not currently run
          third-party advertising pixels for behavioral ads on this site.
        </p>
        <p>
          You may still submit an opt-out request below. We honor Global Privacy
          Control (GPC) signals where detected by supporting tooling.
        </p>
      </LegalSection>

      <LegalSection title="Submit an opt-out">
        {submitted ? (
          <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-emerald-100">
            Request recorded. If we need more information to verify you, we will
            reply at the email you provided.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const subject = encodeURIComponent(
                "Do Not Sell or Share request",
              );
              const body = encodeURIComponent(
                `Please process a Do Not Sell or Share opt-out for:\nEmail/username: ${email}\n`,
              );

              window.location.href = `mailto:${siteConfig.privacyContactEmail}?subject=${subject}&body=${body}`;
              setSubmitted(true);
            }}
          >
            <label className="block space-y-2 text-sm">
              <span className="text-zinc-400">Account email or username</span>
              <input
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-[color:var(--anya-blush)]"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button
              className="rounded-lg bg-[color:var(--anya-blush)] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[color:var(--anya-blush-hover)]"
              type="submit"
            >
              Send opt-out request
            </button>
          </form>
        )}
        <p className="text-sm text-zinc-500">
          Or email{" "}
          <a
            className="text-zinc-200 underline-offset-4 hover:underline"
            href={`mailto:${siteConfig.privacyContactEmail}`}
          >
            {siteConfig.privacyContactEmail}
          </a>{" "}
          with subject “Do Not Sell or Share.”
        </p>
      </LegalSection>
    </LegalPage>
  );
}
