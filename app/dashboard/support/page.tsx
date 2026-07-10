"use client";

import { useEffect, useState } from "react";
import { Mail, MessageCircle } from "lucide-react";
import type { IconType } from "react-icons";
import { BsStarFill } from "react-icons/bs";
import { GiCoffeeCup } from "react-icons/gi";
import { PiUserCircleFill } from "react-icons/pi";

import {
  DashButton,
  DashInput,
  DashPanel,
  DashTextarea,
  PageHeader,
} from "@/components/dashboard/dashboard-ui";
import { siteConfig } from "@/config/site";

const TOPICS: {
  title: string;
  description: string;
  icon: IconType;
  iconClassName?: string;
}[] = [
  {
    title: "Account & billing",
    description: "Plans, credits, and subscription questions.",
    icon: BsStarFill,
    iconClassName: "text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]",
  },
  {
    title: "Search modules",
    description: "Help with OSINT lookups and API limits.",
    icon: PiUserCircleFill,
    iconClassName: "text-amber-100/95",
  },
  {
    title: "Cases & intel",
    description: "Saving people, notes, and case workflows.",
    icon: GiCoffeeCup,
    iconClassName: "text-amber-200/90",
  },
];

export default function CoffeeSupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        if (data?.user?.username) {
          setEmail(`${data.user.username}@anya.local`);
        }
      })
      .catch(() => undefined);
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSent(true);
  };

  return (
    <div className="px-6 py-6 md:px-8 md:py-8">
      <PageHeader
        badge="Warm help desk"
        subtitle={`Grab a virtual coffee with the ${siteConfig.name} team. We're here for account issues, search modules, and case management.`}
        title="Coffee Support"
      />

      <section className="dash-coffee-hero mb-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-amber-300/90">
              <GiCoffeeCup aria-hidden className="text-amber-200" size={22} />
              <span className="text-sm font-medium">Brewed fresh · 24/7 queue</span>
            </div>
            <h2 className="text-2xl font-semibold text-white">
              Need a hand? We&apos;ve got you.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Drop a message below or join the live intel chat on your dashboard.
              Average response time under 2 hours for paid tiers.
            </p>
          </div>
          <div className="flex gap-3">
            <a href={siteConfig.links.telegram} rel="noreferrer" target="_blank">
              <DashButton className="dash-btn-coffee" variant="coffee">
                <MessageCircle className="size-4" />
                Telegram
              </DashButton>
            </a>
            <DashButton variant="secondary">
              <Mail className="size-4" />
              {siteConfig.links.supportEmail}
            </DashButton>
          </div>
        </div>
      </section>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {TOPICS.map((topic) => (
          <DashPanel key={topic.title} glow="amber">
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-amber-400/10 bg-gradient-to-br from-amber-500/15 to-amber-950/20 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)]">
              <topic.icon
                aria-hidden
                className={topic.iconClassName ?? "text-amber-300"}
                size={22}
              />
            </div>
            <h3 className="font-medium text-white">{topic.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{topic.description}</p>
          </DashPanel>
        ))}
      </div>

      <DashPanel className="max-w-2xl" glow="amber">
        <h3 className="mb-4 text-lg font-semibold text-white">Send a message</h3>

        {sent ? (
          <div className="rounded-xl border border-teal-500/25 bg-teal-500/8 px-4 py-6 text-center">
            <p className="font-medium text-teal-200">Message received!</p>
            <p className="mt-1 text-sm text-zinc-400">
              We&apos;ll get back to you at {email || "your account email"}.
            </p>
            <DashButton
              className="mt-4"
              onClick={() => {
                setSent(false);
                setSubject("");
                setMessage("");
              }}
              variant="secondary"
            >
              Send another
            </DashButton>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="dash-field-label" htmlFor="support-subject">
                Subject
              </label>
              <DashInput
                id="support-subject"
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What's this about?"
                value={subject}
              />
            </div>
            <div>
              <label className="dash-field-label" htmlFor="support-message">
                Message
              </label>
              <DashTextarea
                id="support-message"
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Tell us what you need help with..."
                rows={5}
                value={message}
              />
            </div>
            <DashButton
              className="dash-btn-coffee"
              disabled={!subject.trim() || !message.trim()}
              type="submit"
              variant="coffee"
            >
              <GiCoffeeCup aria-hidden size={18} />
              Send to Coffee Support
            </DashButton>
          </form>
        )}
      </DashPanel>
    </div>
  );
}
