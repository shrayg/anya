import type { CSSProperties } from "react";
import type { IconType } from "react-icons";
import type {
  AdCampaign,
  AdFormat,
  CampaignIconKey,
} from "@/config/ad-campaigns";

import Image from "next/image";
import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  BadgeCheck,
  Check,
  Database,
  FileText,
  Fingerprint,
  Gamepad2,
  Globe2,
  Heart,
  House,
  KeyRound,
  Link2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Phone,
  ScanSearch,
  Search,
  ShieldCheck,
  UserRound,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import {
  SiDiscord,
  SiGithub,
  SiInstagram,
  SiRoblox,
  SiSnapchat,
} from "react-icons/si";

import styles from "./page.module.css";

type CampaignFrameProps = {
  campaign: AdCampaign;
  format?: AdFormat;
};

type AnyIcon = IconType | typeof Search;

const RESULT_ICONS: Record<CampaignIconKey, AnyIcon> = {
  alert: AlertTriangle,
  at: AtSign,
  badge: BadgeCheck,
  database: Database,
  discord: SiDiscord,
  file: FileText,
  fingerprint: Fingerprint,
  game: Gamepad2,
  github: SiGithub,
  globe: Globe2,
  heart: Heart,
  home: House,
  instagram: SiInstagram,
  key: KeyRound,
  link: Link2,
  lock: LockKeyhole,
  mail: Mail,
  message: MessageCircle,
  phone: Phone,
  roblox: SiRoblox,
  scan: ScanSearch,
  shield: ShieldCheck,
  snapchat: SiSnapchat,
  tinder: Heart,
  user: UserRound,
  users: UsersRound,
};

const INPUT_ICONS: Record<AdCampaign["inputKind"], AnyIcon> = {
  email: Mail,
  name: UserRound,
  phone: Phone,
  username: AtSign,
};

function splitHook(hook: string) {
  const words = hook.split(" ");

  if (words.length < 2) return [hook, ""];

  const breakpoint = words
    .slice(1)
    .map((_, index) => index + 1)
    .reduce((best, candidate) => {
      const bestDifference = Math.abs(
        words.slice(0, best).join(" ").length -
          words.slice(best).join(" ").length,
      );
      const candidateDifference = Math.abs(
        words.slice(0, candidate).join(" ").length -
          words.slice(candidate).join(" ").length,
      );

      return candidateDifference < bestDifference ? candidate : best;
    }, 1);

  return [
    words.slice(0, breakpoint).join(" "),
    words.slice(breakpoint).join(" "),
  ];
}

export function CampaignFrame({
  campaign,
  format = "4x5",
}: CampaignFrameProps) {
  const [hookLead, hookPayoff] = splitHook(campaign.hook);
  const InputIcon = INPUT_ICONS[campaign.inputKind];
  const frameStyle = {
    "--campaign-accent": campaign.accent,
  } as CSSProperties;

  return (
    <main className={styles.page}>
      <article
        aria-label={`${campaign.campaignName} campaign ad`}
        className={`${styles.frame} ${format === "square" ? styles.square : ""}`}
        data-campaign={campaign.slug}
        data-format={format}
        style={frameStyle}
      >
        <div aria-hidden className={styles.grid} />
        <div aria-hidden className={styles.glowTop} />
        <div aria-hidden className={styles.glowBottom} />

        <header className={styles.brandBar}>
          <div className={styles.wordmarkWrap}>
            <Image
              priority
              alt="Anya logo"
              className={styles.brandLogo}
              height={38}
              src="/images/anya-logo.png"
              width={38}
            />
            <span className={styles.wordmark}>ANYA</span>
          </div>
          <span className={styles.brandMeta}>
            {campaign.categoryLabel} / {campaign.id}
          </span>
        </header>

        <section className={styles.heroCopy}>
          <p className={styles.eyebrow}>{campaign.eyebrow}</p>
          <h1>
            {hookLead}
            {hookPayoff ? <span>{hookPayoff}</span> : null}
          </h1>
        </section>

        <section className={styles.productShell}>
          <div className={styles.productChrome}>
            <div className={styles.productIdentity}>
              <span className={styles.productDot} />
              <span>ANYA / {campaign.moduleLabel}</span>
            </div>
            <div className={styles.demoFlag}>
              <ShieldCheck aria-hidden />
              FICTIONAL DEMO
            </div>
          </div>

          <div className={styles.searchBlock}>
            <div className={styles.inputLabel}>
              <span>01 / INPUT</span>
              <span>{campaign.inputLabel}</span>
            </div>
            <div className={styles.searchBar}>
              <Search aria-hidden />
              <InputIcon aria-hidden className={styles.atSign} />
              <span className={styles.query}>{campaign.inputValue}</span>
              <span className={styles.searchAction}>
                Search
                <ArrowRight aria-hidden />
              </span>
            </div>
          </div>

          <div className={styles.signalRail}>
            {campaign.stats.map((stat) => (
              <div key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
            <div className={styles.completeStat}>
              <Check aria-hidden />
              <span>{campaign.searchStatus}</span>
            </div>
          </div>

          <div className={styles.resultsHead}>
            <div>
              <p>02 / CONNECTED RESULTS</p>
              <h2>{campaign.resultTitle}</h2>
            </div>
            <span className={styles.resultsCount}>4 SIGNALS</span>
          </div>

          <div className={styles.resultsGrid}>
            {campaign.results.map((result, index) => {
              const ResultIcon = RESULT_ICONS[result.icon];

              return (
                <article
                  key={`${result.title}-${index}`}
                  className={styles.resultCard}
                >
                  <div className={styles.cardTop}>
                    <span
                      className={`${styles.platformIcon} ${styles[result.tone]}`}
                    >
                      <ResultIcon aria-hidden />
                    </span>
                    <span className={styles.cardIndex}>0{index + 1}</span>
                  </div>
                  <div className={styles.cardCopy}>
                    <span>{result.title}</span>
                    <strong>{result.value}</strong>
                    <small>{result.detail}</small>
                  </div>
                  <div
                    className={`${styles.cardStatus} ${
                      result.statusTone === "risk"
                        ? styles.statusRisk
                        : result.statusTone === "warn"
                          ? styles.statusWarn
                          : ""
                    }`}
                  >
                    <span />
                    {result.status}
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.connectionBand}>
            <span className={styles.connectionIcon}>
              <Link2 aria-hidden />
            </span>
            <div>
              <span>CROSS-SOURCE CONTEXT</span>
              <strong>{campaign.payoff}</strong>
            </div>
            <UserRoundSearch aria-hidden className={styles.connectionFigure} />
          </div>
        </section>

        <footer className={styles.footer}>
          <p>Look people up. Connect the trail.</p>
          <div>
            <span>{campaign.cta}</span>
            <ArrowRight aria-hidden />
          </div>
        </footer>
      </article>
    </main>
  );
}
