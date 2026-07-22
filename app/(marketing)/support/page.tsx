import type { Metadata } from "next";

import NextLink from "next/link";
import { Headphones, LifeBuoy, Mail, MessageCircle } from "lucide-react";

import { Reveal } from "@/components/craft/reveal";
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
] as const;

export default function SupportPage() {
  return (
    <div className="brutal-page brutal-support-page relative z-20 mx-auto w-full max-w-4xl px-2 pb-24 pt-2 md:pt-4">
      <Reveal mode="mount">
        <header className="brutal-page-header mb-14 space-y-5">
          <p className="craft-kicker">
            <LifeBuoy className="size-3.5" />
            Help center
          </p>
          <h1 className="craft-display text-4xl md:text-6xl">Support</h1>
          <p className="craft-lede">
            Billing, access, and product help for {siteConfig.name}. Start with
            email or Telegram — we&apos;ll take it from there.
          </p>
        </header>
      </Reveal>

      <section className="grid gap-4 sm:grid-cols-2">
        {CHANNELS.map((channel, index) => {
          const Icon = channel.icon;

          return (
            <Reveal
              key={channel.title}
              delay={0.06 + index * 0.05}
              mode="mount"
            >
              <a
                className="support-channel group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-pink-300/35 hover:bg-pink-500/[0.07]"
                href={channel.href}
                {...(channel.external
                  ? { rel: "noreferrer", target: "_blank" }
                  : {})}
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] transition group-hover:border-pink-300/30 group-hover:bg-pink-500/15">
                  <Icon className="size-4 text-zinc-300 group-hover:text-pink-200" />
                </div>
                <h3 className="text-base font-semibold text-white">
                  {channel.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-zinc-500">
                  {channel.body}
                </p>
                <span className="mt-4 text-sm font-medium text-pink-300 group-hover:text-pink-200">
                  {channel.cta}
                </span>
              </a>
            </Reveal>
          );
        })}
      </section>

      <Reveal delay={0.16} mode="mount">
        <section className="craft-surface mt-10 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-pink-300/30 bg-pink-500/15">
              <LifeBuoy className="size-5 text-pink-200" />
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
        </section>
      </Reveal>

      <Reveal delay={0.22} mode="mount">
        <section className="mt-14 border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <Headphones className="size-4 text-zinc-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Also useful</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
            Check the{" "}
            <NextLink
              className="text-zinc-300 underline-offset-4 hover:underline"
              href="/faq"
            >
              FAQ
            </NextLink>{" "}
            and{" "}
            <NextLink
              className="text-zinc-300 underline-offset-4 hover:underline"
              href="/status"
            >
              status page
            </NextLink>{" "}
            before reaching out. Panel access requires Professional or higher.
          </p>
        </section>
      </Reveal>
    </div>
  );
}
