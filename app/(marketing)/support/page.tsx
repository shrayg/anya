import type { Metadata } from "next";
import NextLink from "next/link";
import {
  Headphones,
  LifeBuoy,
  Mail,
  MessageCircle,
  Ticket,
} from "lucide-react";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Support",
  description: `Get help with ${siteConfig.name} — billing, account access, and product questions.`,
};

const CHANNELS = [
  {
    title: "Email",
    body: "Best for billing issues, account recovery, and anything that needs a paper trail.",
    href: `mailto:${siteConfig.links.supportEmail}`,
    cta: siteConfig.links.supportEmail,
    icon: Mail,
    external: false,
  },
  {
    title: "Telegram",
    body: "Quick questions and community updates. Response times vary by volume.",
    href: siteConfig.links.telegram,
    cta: "Open Telegram",
    icon: MessageCircle,
    external: true,
  },
  {
    title: "Ticket desk",
    body: "Logged-in members can open a ticket from the dashboard for tracked support.",
    href: "/dashboard/support",
    cta: "Open ticket desk",
    icon: Ticket,
    external: false,
  },
] as const;

export default function SupportPage() {
  return (
    <div className="relative z-20 mx-auto w-full max-w-4xl px-2 pb-20 pt-6 md:pt-10">
      <header className="mb-12 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--anya-blush)]">
          Help center
        </p>
        <h1
          className="text-3xl font-semibold tracking-tight text-white md:text-5xl"
          style={{ fontFamily: "var(--font-bruno-ace-sc)" }}
        >
          Support
        </h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-400">
          Billing, access, and product help for {siteConfig.name}. This page is a
          starting point — more guides and self-serve tools will land here over
          time.
        </p>
      </header>

      <section className="mb-10 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-white/[0.03] to-transparent p-px shadow-lg shadow-indigo-500/10">
        <div className="rounded-[23px] bg-zinc-950/80 px-6 py-6 backdrop-blur-xl sm:px-8 sm:py-8">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-300/30 bg-indigo-500/15">
              <LifeBuoy className="size-5 text-indigo-200" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">
                Crypto payment still pending?
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-zinc-400">
                Network confirmation can take a few minutes. If access has not
                unlocked after a reasonable wait, contact us with your username,
                plan, and approximate payment time. Do not send seed phrases or
                private keys.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {CHANNELS.map((channel) => {
          const Icon = channel.icon;
          return (
            <a
              key={channel.title}
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-indigo-300/30 hover:bg-white/[0.06]"
              href={channel.href}
              {...(channel.external
                ? { rel: "noreferrer", target: "_blank" }
                : {})}
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] transition group-hover:border-indigo-300/30 group-hover:bg-indigo-500/15">
                <Icon className="size-4 text-zinc-300 group-hover:text-indigo-200" />
              </div>
              <h3 className="text-base font-semibold text-white">{channel.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-zinc-500">
                {channel.body}
              </p>
              <span className="mt-4 text-sm font-medium text-indigo-300 group-hover:text-indigo-200">
                {channel.cta}
              </span>
            </a>
          );
        })}
      </section>

      <section className="mt-10 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <Headphones className="size-4 text-zinc-400" />
        </div>
        <h2 className="text-base font-semibold text-white">More coming soon</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
          Docs, troubleshooting playbooks, and self-serve billing tools will be
          added here. Until then, use email or Telegram — or check the{" "}
          <NextLink className="text-zinc-300 underline-offset-4 hover:underline" href="/faq">
            FAQ
          </NextLink>{" "}
          and{" "}
          <NextLink
            className="text-zinc-300 underline-offset-4 hover:underline"
            href="/status"
          >
            status page
          </NextLink>
          .
        </p>
      </section>
    </div>
  );
}
