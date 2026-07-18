import type { Metadata } from "next";

import { StatusPageContent } from "@/components/status-page-content";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Status",
  description: `${siteConfig.name} platform status — live health for website, auth, search, and billing.`,
};

export default function StatusPage() {
  return <StatusPageContent />;
}
