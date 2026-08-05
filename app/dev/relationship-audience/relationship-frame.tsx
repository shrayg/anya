import type { CSSProperties } from "react";
import type { RelationshipCampaign } from "@/config/gendered-relationship-campaigns";

import Image from "next/image";
import {
  ArrowRight,
  Check,
  Heart,
  Link2,
  Phone,
  Search,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";
import { SiInstagram } from "react-icons/si";

import base from "../campaign-preview/page.module.css";

import styles from "./relationship-frame.module.css";

type RelationshipFrameProps = {
  campaign: RelationshipCampaign;
  format?: "4x5" | "square";
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

export function RelationshipFrame({
  campaign,
  format = "4x5",
}: RelationshipFrameProps) {
  const [hookLead, hookPayoff] = splitHook(campaign.hook);
  const frameStyle = {
    "--campaign-accent": "#f0a8c8",
  } as CSSProperties;
  const square = format === "square";
  const phoneEnding = campaign.audience === "women" ? "••47" : "••36";

  return (
    <main className={base.page}>
      <article
        aria-label={`${campaign.hook} relationship campaign ad`}
        className={`${base.frame} ${square ? base.square : ""} ${
          square ? styles.squareFormat : ""
        }`}
        data-campaign={campaign.slug}
        data-format={format}
        style={frameStyle}
      >
        <div aria-hidden className={base.grid} />
        <div aria-hidden className={base.glowTop} />
        <div aria-hidden className={base.glowBottom} />

        <header className={base.brandBar}>
          <div className={base.wordmarkWrap}>
            <Image
              priority
              alt="Anya logo"
              className={base.brandLogo}
              height={38}
              src="/images/anya-logo.png"
              width={38}
            />
            <span className={base.wordmark}>ANYA</span>
          </div>
          <span className={base.brandMeta}>
            FOR {campaign.audience.toUpperCase()} / {campaign.id}
          </span>
        </header>

        <section className={base.heroCopy}>
          <p className={base.eyebrow}>{campaign.eyebrow}</p>
          <h1>
            {hookLead}
            {hookPayoff ? <span>{hookPayoff}</span> : null}
          </h1>
        </section>

        <section className={base.productShell}>
          <div className={base.productChrome}>
            <div className={base.productIdentity}>
              <span className={base.productDot} />
              <span>ANYA / PHONE + PUBLIC PROFILES</span>
            </div>
            <div className={base.demoFlag}>
              <ShieldCheck aria-hidden />
              FICTIONAL DEMO
            </div>
          </div>

          <div className={base.searchBlock}>
            <div className={base.inputLabel}>
              <span>01 / INPUT</span>
              <span>{campaign.inputLabel}</span>
            </div>
            <div className={base.searchBar}>
              <Search aria-hidden />
              <Phone aria-hidden className={base.atSign} />
              <span className={base.query}>{campaign.inputValue}</span>
              <span className={base.searchAction}>
                Search
                <ArrowRight aria-hidden />
              </span>
            </div>
          </div>

          <div className={base.signalRail}>
            {campaign.stats.map((stat) => (
              <div key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
            <div className={base.completeStat}>
              <Check aria-hidden />
              <span>PROFILE FOUND</span>
            </div>
          </div>

          <div className={base.resultsHead}>
            <div>
              <p>02 / CONNECTED RESULTS</p>
              <h2>{campaign.resultTitle}</h2>
            </div>
            <span className={base.resultsCount}>4 SIGNALS</span>
          </div>

          <div className={styles.profileResultGrid}>
            <article className={styles.primaryProfile}>
              <div className={styles.portraitWrap}>
                <Image
                  priority
                  alt={`Fictional profile portrait for ${campaign.profileName}`}
                  className={styles.portrait}
                  height={320}
                  src={campaign.profileImage}
                  width={320}
                />
                <span className={styles.matchBadge}>
                  <Check aria-hidden />
                  PROFILE MATCH
                </span>
              </div>
              <div className={styles.profileCopy}>
                <span className={styles.profileLabel}>PUBLIC IDENTITY</span>
                <h3>{campaign.profileName}</h3>
                <p>
                  {campaign.profileHandle}
                  <span>AGE {campaign.profileAge}</span>
                </p>
                <small>{campaign.profileDescriptor}</small>
                <div className={styles.profileTags}>
                  <span>PUBLIC PROFILE</span>
                  <span>DATING SURFACE</span>
                </div>
                <div className={styles.profileStatus}>
                  <span />
                  IDENTITY SIGNAL FOUND
                </div>
              </div>
            </article>

            <div className={styles.signalStack}>
              <article>
                <span className={`${styles.sideIcon} ${styles.instagram}`}>
                  <SiInstagram aria-hidden />
                </span>
                <div>
                  <span>Instagram</span>
                  <strong>{campaign.profileHandle}</strong>
                  <small>Public profile match</small>
                </div>
              </article>
              <article>
                <span className={`${styles.sideIcon} ${styles.dating}`}>
                  <Heart aria-hidden />
                </span>
                <div>
                  <span>Dating surface</span>
                  <strong>Profile present</strong>
                  <small>Public identity signal</small>
                </div>
              </article>
              <article>
                <span className={`${styles.sideIcon} ${styles.phone}`}>
                  <Phone aria-hidden />
                </span>
                <div>
                  <span>Contact association</span>
                  <strong>Ending {phoneEnding}</strong>
                  <small>Masked fictional number</small>
                </div>
              </article>
            </div>
          </div>

          <div className={base.connectionBand}>
            <span className={base.connectionIcon}>
              <Link2 aria-hidden />
            </span>
            <div>
              <span>CROSS-SOURCE CONTEXT</span>
              <strong>{campaign.payoff}</strong>
            </div>
            <UserRoundSearch aria-hidden className={base.connectionFigure} />
          </div>
        </section>

        <footer className={base.footer}>
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
