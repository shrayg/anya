import type { Metadata } from "next";

import { AccountPageContent } from "@/components/account/account-page-content";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Account",
  description: `Manage your ${siteConfig.name} profile, security, and billing.`,
};

export default function AccountPage() {
  return <AccountPageContent />;
}
