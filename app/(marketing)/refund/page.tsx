import { LegalPage, LegalSection } from "@/components/legal-page";
import { siteConfig } from "@/config/site";

export default function RefundPage() {
  return (
    <LegalPage title="Refund Policy" updated="July 15, 2026">
      <LegalSection title="Subscriptions">
        <p>
          Paid plans renew automatically for the interval you select until you
          cancel. Cancel before the renewal date to avoid the next charge.
          Except where required by law, we do not refund partial billing periods
          after renewal or after access has been delivered.
        </p>
      </LegalSection>

      <LegalSection title="Credits and pay-per-use">
        <p>
          Credit packs and pay-per-use charges are generally final once
          purchased or consumed. Unused credits are non-refundable except where
          required by law or when we cancel the Service for reasons within our
          control and elect to issue goodwill credit.
        </p>
      </LegalSection>

      <LegalSection title="Payment methods">
        <p>
          Card and other fiat payments are processed by our payment partners.
          Cryptocurrency payments, when enabled, are typically irreversible once
          confirmed on-chain. Double-check amounts and addresses before paying.
        </p>
      </LegalSection>

      <LegalSection title="Chargebacks and abuse">
        <p>
          Friendly fraud and abusive chargebacks may result in permanent account
          termination and collection of amounts owed. Contact support first so we
          can help resolve billing issues.
        </p>
      </LegalSection>

      <LegalSection title="How to cancel or request help">
        <p>
          Manage your plan in dashboard settings where available, or email{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href="mailto:support@anyaint.com"
          >
            support@anyaint.com
          </a>
          {" "}
          / Telegram{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href={siteConfig.links.telegram}
            rel="noreferrer"
            target="_blank"
          >
            @anyaintel
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
