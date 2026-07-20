import { LegalPage, LegalSection } from "@/components/legal-page";
import { siteConfig } from "@/config/site";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 15, 2026">
      <LegalSection title="Overview">
        <p>
          This Privacy Policy explains how Anya.Int (“we,” “us,” or “our”)
          collects, uses, and shares information when you use anyaint.com and
          related services (the “Service”).
        </p>
        <p>
          Anya.Int provides investigative intelligence tools. It is not a
          consumer reporting agency. Do not use outputs for FCRA-regulated
          decisions. See our Terms of Service.
        </p>
      </LegalSection>

      <LegalSection title="Notice at collection">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-zinc-100">What we collect:</strong> account
            username; authentication data; search queries you submit; result
            summaries we store to provide history and cases; billing and
            transaction records from our payment processors; and technical data
            such as IP address, device/browser info, and security logs.
          </li>
          <li>
            <strong className="text-zinc-100">Why:</strong> to operate the
            Service, process payments, prevent abuse/fraud, provide support, and
            meet legal obligations.
          </li>
          <li>
            <strong className="text-zinc-100">Sale / share:</strong> we do not
            sell personal information for money. See{" "}
            <a
              className="text-zinc-100 underline-offset-4 hover:underline"
              href="/do-not-sell"
            >
              Do Not Sell or Share
            </a>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use information">
        <p>We use information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Create and secure accounts, and deliver plan entitlements</li>
          <li>
            Run the lookups you request and show results in your workspace
          </li>
          <li>Bill subscriptions and credit purchases</li>
          <li>
            Detect abuse, enforce our Acceptable Use Policy, and protect the
            Service
          </li>
          <li>Send service messages (security, billing, support)</li>
          <li>Comply with law and lawful requests</li>
        </ul>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>
          We use carefully selected service providers for hosting, payments,
          email/messaging needed to run the Service, and operational
          notifications to our support staff. Those providers process data only
          to perform services for us.
        </p>
        <p>
          Operational notification channels (for example, internal alerts about
          support tickets or successful payments) are used so our team can help
          you. They are not used to sell or rent your personal information, and
          we do not send your search results to advertisers.
        </p>
        <p>
          To fulfill certain lookups, the Service may query specialized
          intelligence and public-data infrastructure under our contracts with
          those operators. We do not publicly catalog proprietary suppliers,
          endpoints, or internal tooling. Those relationships are confidential
          business information.
        </p>
      </LegalSection>

      <LegalSection title="Search subjects">
        <p>
          When you search for an identifier (such as an email, phone, username,
          IP, or domain), that identifier is processed to return available
          signals. You are responsible for having a lawful basis to run that
          search in your jurisdiction.
        </p>
      </LegalSection>

      <LegalSection title="Retention">
        <p>
          We keep account and billing records while your account is active and
          for a reasonable period afterward for security, accounting, and legal
          purposes. Search history and case materials are retained to provide
          product features until you delete them or ask us to delete your
          account, subject to backups and legal holds.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          We use industry-standard safeguards including encrypted transport
          (TLS), access controls, and hashed passwords. No method of
          transmission or storage is perfectly secure.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p>
          Depending on where you live, you may have rights to access, delete,
          correct, or opt out of certain processing. To make a request, email{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href={`mailto:${siteConfig.privacyContactEmail}`}
          >
            {siteConfig.privacyContactEmail}
          </a>
          . We may need to verify your identity. We will not discriminate
          against you for exercising privacy rights.
        </p>
        <p>
          California residents can also use our{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href="/do-not-sell"
          >
            Do Not Sell or Share
          </a>{" "}
          page.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          The Service is not directed to anyone under 18. We do not knowingly
          collect personal information from children.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update this policy. The “Last updated” date will change when we
          do. Continued use after an update means you accept the revised policy.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Privacy requests:{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href={`mailto:${siteConfig.privacyContactEmail}`}
          >
            {siteConfig.privacyContactEmail}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
