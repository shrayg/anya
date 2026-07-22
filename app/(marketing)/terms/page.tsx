import { LegalPage, LegalSection } from "@/components/legal-page";
import { siteConfig } from "@/config/site";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="July 15, 2026">
      <LegalSection title="Agreement">
        <p>
          These Terms of Service (“Terms”) govern your access to and use of the
          Anya website, applications, APIs, and related services (the
          “Service”) operated by Anya (“we,” “us,” or “our”). By creating an
          account, purchasing a plan, or using the Service, you agree to these
          Terms, our{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href="/privacy"
          >
            Privacy Policy
          </a>
          , and our{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href="/acceptable-use"
          >
            Acceptable Use Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Who the Service is for">
        <p>
          Anya is an open-source intelligence platform intended for
          authorized investigative, cybersecurity, fraud-prevention, compliance,
          journalism, and other lawful professional uses. You must be at least
          18 years old and legally able to enter a contract.
        </p>
        <p>
          The Service aggregates and returns information for research and
          operational awareness. We do not perform unauthorized system access,
          create breaches, or guarantee that any result is complete or correct.
        </p>
      </LegalSection>

      <LegalSection title="Accounts">
        <p>
          You are responsible for your credentials and for all activity under
          your account. Keep your password confidential and notify us promptly
          of suspected unauthorized access. We may suspend, freeze, or terminate
          accounts that appear compromised, abusive, unpaid, or in violation of
          these Terms.
        </p>
      </LegalSection>

      <LegalSection title="Plans, payments, and renewals">
        <p>
          Paid subscriptions, credits, and add-ons are described on our pricing
          pages at checkout. Fees are charged through our payment processors.
          Subscriptions renew automatically for the selected interval unless you
          cancel before the renewal date. Taxes may apply. See our{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href="/refund"
          >
            Refund Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use and FCRA">
        <p>
          You must use the Service only for lawful purposes and in compliance
          with our Acceptable Use Policy. Anya is not a consumer reporting
          agency under the Fair Credit Reporting Act (FCRA). You may not use
          Service results for employment, tenant screening, credit, insurance,
          or any other FCRA-regulated decision.
        </p>
      </LegalSection>

      <LegalSection title="Third-party data and systems">
        <p>
          The Service depends on third-party networks, public sources, and
          infrastructure operators. Those systems have their own terms and may
          change, become unavailable, or contain errors. We do not control them
          and are not responsible for their accuracy, legality, or uptime.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM
          EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR
          IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          TITLE, AND NON-INFRINGEMENT. You are solely responsible for verifying
          information before acting on it.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY ARISING
          OUT OF OR RELATING TO THE SERVICE WILL NOT EXCEED THE AMOUNTS YOU PAID
          TO US FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM, OR
          ONE HUNDRED U.S. DOLLARS (US$100), WHICHEVER IS GREATER. WE ARE NOT
          LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR
          PUNITIVE DAMAGES, OR LOSS OF PROFITS, DATA, OR GOODWILL.
        </p>
      </LegalSection>

      <LegalSection title="Indemnity">
        <p>
          You will defend and indemnify Anya and its operators from claims,
          losses, and expenses (including reasonable attorneys’ fees) arising
          from your use of the Service, your content or queries, or your
          violation of these Terms or applicable law.
        </p>
      </LegalSection>

      <LegalSection title="Changes and termination">
        <p>
          We may modify the Service or these Terms. Material changes will be
          reflected by updating the “Last updated” date. Continued use after
          changes means you accept the revised Terms. We may discontinue
          features or terminate access where required for security, legal, or
          operational reasons.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These Terms are governed by the laws of the State of{" "}
          {siteConfig.governingLawState}, excluding conflict-of-law rules.
          Exclusive venue for disputes lies in the state or federal courts
          located in that state, unless applicable law requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Email{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href={`mailto:${siteConfig.legalContactEmail}`}
          >
            {siteConfig.legalContactEmail}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
