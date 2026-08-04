import Image from "next/image";
import {
  ArrowRight,
  AtSign,
  Check,
  Link2,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";

import styles from "./page.module.css";

const signals = [
  {
    label: "Public profiles",
    value: "4 surfaces",
    detail: "Connected accounts",
    icon: AtSign,
  },
  {
    label: "Contact context",
    value: "3 signals",
    detail: "Public-source matches",
    icon: Phone,
  },
  {
    label: "Exposure records",
    value: "2 sources",
    detail: "Reviewable context",
    icon: ShieldCheck,
  },
] as const;

type FacebookCoverPageProps = {
  searchParams: Promise<{ format?: string }>;
};

export default async function FacebookCoverPage({
  searchParams,
}: FacebookCoverPageProps) {
  const query = await searchParams;
  const uploadFormat = query.format === "upload";

  return (
    <main className={styles.page}>
      <article
        aria-label="Anya Facebook Page cover"
        className={`${styles.cover} ${uploadFormat ? styles.upload : ""}`}
        data-format={uploadFormat ? "upload" : "desktop"}
      >
        <div aria-hidden className={styles.grid} />
        <div aria-hidden className={styles.orbit} />
        <div aria-hidden className={styles.profileClearance} />

        <header className={styles.brandBar}>
          <div className={styles.brand}>
            <Image
              priority
              alt="Anya logo"
              className={styles.logo}
              height={50}
              src="/images/anya-logo.png"
              width={50}
            />
            <span>ANYA</span>
          </div>
          <span className={styles.systemLabel}>
            IDENTITY INTELLIGENCE / PUBLIC-SOURCE CONTEXT
          </span>
        </header>

        <div className={styles.composition}>
          <section className={styles.message}>
            <p className={styles.eyebrow}>START WITH WHAT YOU KNOW</p>
            <h1>
              Look people up.
              <span>Connect the trail.</span>
            </h1>
            <p className={styles.subline}>Public data. One search.</p>
            <div className={styles.searchModes}>
              <Search aria-hidden />
              <span>EMAIL</span>
              <i />
              <span>PHONE</span>
              <i />
              <span>USERNAME</span>
              <ArrowRight aria-hidden />
            </div>
          </section>

          <section className={styles.productPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelIdentity}>
                <i />
                ANYA / CONNECTED RESULTS
              </span>
              <span className={styles.demoFlag}>
                <ShieldCheck aria-hidden />
                FICTIONAL DEMO
              </span>
            </div>

            <div className={styles.inputLabel}>
              <span>01 / STARTING SIGNAL</span>
              <span>EMAIL ADDRESS</span>
            </div>
            <div className={styles.searchBar}>
              <Mail aria-hidden />
              <span>alex.river@example.com</span>
              <strong>
                Search
                <ArrowRight aria-hidden />
              </strong>
            </div>

            <div className={styles.proofRail}>
              <div>
                <span>CONNECTED SIGNALS</span>
                <strong>9</strong>
              </div>
              <div>
                <span>PUBLIC SURFACES</span>
                <strong>4</strong>
              </div>
              <div className={styles.complete}>
                <Check aria-hidden />
                <span>SEARCH COMPLETE</span>
              </div>
            </div>

            <div className={styles.resultsHeader}>
              <div>
                <span>02 / CONNECTED RESULTS</span>
                <strong>See what connects.</strong>
              </div>
              <span>3 SIGNAL GROUPS</span>
            </div>

            <div className={styles.signalGrid}>
              {signals.map(({ label, value, detail, icon: Icon }) => (
                <article key={label}>
                  <span className={styles.signalIcon}>
                    <Icon aria-hidden />
                  </span>
                  <div>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{detail}</small>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.contextBand}>
              <Link2 aria-hidden />
              <span>ONE CLUE</span>
              <i />
              <strong>A clearer picture.</strong>
              <UserRoundSearch aria-hidden />
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
