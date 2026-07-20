import { LegalPage, LegalSection } from "@/components/legal-page";

export default function AcceptableUsePage() {
  return (
    <LegalPage title="Acceptable Use Policy" updated="July 15, 2026">
      <LegalSection title="Purpose">
        <p>
          This Acceptable Use Policy (“AUP”) is part of our Terms of Service. It
          describes prohibited uses of Anya.Int. Violations may lead to
          immediate suspension, freeze, or termination without refund, and may
          be reported to authorities where required.
        </p>
      </LegalSection>

      <LegalSection title="You may">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Use the Service for authorized investigations, security research,
            fraud prevention, compliance, journalism, and similar lawful work
          </li>
          <li>
            Search identifiers you are legally allowed to investigate in your
            jurisdiction
          </li>
          <li>Store results in cases for your own authorized workflow</li>
        </ul>
      </LegalSection>

      <LegalSection title="You may not">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Commit, facilitate, or plan any crime, fraud, identity theft,
            harassment, stalking, extortion, or threats
          </li>
          <li>
            Attempt unauthorized access to accounts, networks, devices, or data
            (including credential stuffing, bypassing MFA, or account takeover)
          </li>
          <li>
            Use results for employment, tenant, credit, insurance, or other
            FCRA-regulated decisions
          </li>
          <li>Target minors or create sexual content involving minors</li>
          <li>
            Dox, intimidate, or publish private personal data to harm someone
          </li>
          <li>
            Resell, scrape, or bulk-exfiltrate the Service without written
            permission, or circumvent rate limits and access controls
          </li>
          <li>
            Misrepresent your identity, share accounts, or evade suspension
          </li>
          <li>
            Use the Service in any way that violates applicable law or
            third-party rights
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="High-sensitivity modules">
        <p>
          Some modules return sensitive exposure or credential-adjacent
          intelligence. Those modules exist only for authorized security and
          investigative workflows. Using them to access someone else’s accounts,
          steal funds, or commit fraud is strictly forbidden and will result in
          permanent ban.
        </p>
      </LegalSection>

      <LegalSection title="Enforcement">
        <p>
          We may investigate suspected abuse, preserve logs, freeze accounts,
          and cooperate with lawful requests. We may require additional
          verification for high-risk plans or API access.
        </p>
      </LegalSection>

      <LegalSection title="Reporting">
        <p>
          Report abuse to{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href="mailto:support@anyaint.com"
          >
            support@anyaint.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
