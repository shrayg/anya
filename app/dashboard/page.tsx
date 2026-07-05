import { redirect } from "next/navigation";

import { siteConfig } from "@/config/site";

export default function DashboardPage() {
  redirect(siteConfig.defaultWorkspacePath);
}
