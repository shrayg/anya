"use client";

import { motion } from "framer-motion";
import { ExternalLink, ShieldCheck, Users } from "lucide-react";
import { PiGiftBold } from "react-icons/pi";

import { HomeBackground } from "@/components/home-background";
import { IntelligenceModulesSection } from "@/components/intelligence-modules-section";
import ShinyText from "@/components/shiny-text";
import { siteConfig } from "@/config/site";

export default function Home() {
  return (
    <>
      <HomeBackground />

      <section className="relative z-20 flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center gap-8 py-12 text-center">
        <div className="flex max-w-4xl flex-col items-center gap-5">
          <ShinyText
            className="z-20 text-5xl font-extrabold tracking-normal transition-all ease-in-out md:text-8xl"
            text={siteConfig.name}
          />
          <p className="max-w-2xl px-4 text-base leading-7 text-gray-300 md:text-xl">
            {siteConfig.tagline}. Create an account, run lookups across breach
            and social modules, and file intel into cases.
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-3 px-2 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-xl">
            <ShieldCheck className="size-5 shrink-0 text-emerald-300" />
            <span className="text-sm text-gray-300">
              Register now to secure your username and start searching.
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-xl">
            <Users className="size-5 shrink-0 text-white" />
            <span className="text-sm text-gray-300">
              Discord, Roblox, breaches, stealer logs, and dozens more modules.
            </span>
          </div>
        </div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-3xl rounded-lg border border-white/10 bg-black/40 p-5 text-left shadow-2xl shadow-black/30 backdrop-blur-xl"
          initial={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.45 }}
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
                  <PiGiftBold aria-hidden className="size-5 text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">
                    Early Access Program
                  </p>
                  <p className="text-xs text-gray-400">
                    Join Telegram and invite friends to unlock early access.
                  </p>
                </div>
              </div>
              <p className="text-sm leading-6 text-gray-300">
                Join our Telegram to get your referral link. Every real visit you
                bring gets counted toward early access time before the public
                platform opens.
              </p>
            </div>

            <a
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-200"
              href={siteConfig.links.telegram}
              rel="noreferrer"
              target="_blank"
            >
              Join Telegram
              <ExternalLink className="size-4" />
            </a>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-2 flex items-center gap-2 text-white">
                <Users className="size-4" />
                <span className="text-sm font-semibold">10 visits</span>
              </div>
              <p className="text-sm text-gray-400">Get 1 day of early access.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-2 flex items-center gap-2 text-white">
                <Users className="size-4" />
                <span className="text-sm font-semibold">25 visits</span>
              </div>
              <p className="text-sm text-gray-400">Get 3 days of early access.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-2 flex items-center gap-2 text-white">
                <Users className="size-4" />
                <span className="text-sm font-semibold">50 visits</span>
              </div>
              <p className="text-sm text-gray-400">Get 7 days of early access.</p>
            </div>
          </div>
        </motion.div>
      </section>

      <IntelligenceModulesSection />
    </>
  );
}
