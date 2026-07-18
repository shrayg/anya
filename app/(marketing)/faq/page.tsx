import { LegalPage, LegalSection } from "@/components/legal-page";
import { siteConfig } from "@/config/site";

export default function FaqPage() {
  return (
    <LegalPage title="FAQ" updated="July 15, 2026">
      <LegalSection title="What is Anya.Int?">
        <p>
          Anya.Int is an OSINT workspace for investigators and security
          professionals. It helps you run lookups across identity, network,
          platform, financial metadata, and exposure intelligence modules, then
          file findings into cases.
        </p>
      </LegalSection>

      <LegalSection title="Who should use it?">
        <p>
          Adults with a lawful purpose—such as fraud investigation, defensive
          security, compliance, or authorized research. It is not a consumer
          background-check product and must not be used for FCRA-regulated
          decisions.
        </p>
      </LegalSection>

      <LegalSection title="Where does data come from?">
        <p>
          Results are compiled from a mix of public sources and specialized
          intelligence infrastructure operated under our commercial
          relationships. We do not publish an inventory of suppliers or internal
          tooling.
        </p>
      </LegalSection>

      <LegalSection title="How do payments work?">
        <p>
          Plans and credits are billed through our checkout providers. After
          payment confirms, entitlements are applied to your account. Crypto
          payments, when available, depend on network confirmation. See{" "}
          <a className="text-zinc-100 underline-offset-4 hover:underline" href="/refund">
            Refund Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Can I delete my account?">
        <p>
          Email{" "}
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href={`mailto:${siteConfig.links.supportEmail}`}
          >
            {siteConfig.links.supportEmail}
          </a>{" "}
          from your registered contact channel and request deletion. We will
          remove account data subject to legal retention needs.
        </p>
      </LegalSection>

      <LegalSection title="How do I get help?">
        <p>
          Visit the{" "}
          <a className="text-zinc-100 underline-offset-4 hover:underline" href="/support">
            Support
          </a>{" "}
          page for email, Telegram, and ticket options. Logged-in users can also
          open tickets from the dashboard support area (
          <a
            className="text-zinc-100 underline-offset-4 hover:underline"
            href="/dashboard/support"
          >
            /dashboard/support
          </a>
          ). Direct email: {siteConfig.links.supportEmail}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
