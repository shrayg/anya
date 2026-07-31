import { redirect } from "next/navigation";

import { siteConfig } from "@/config/site";

/** Former Pick-a-Module catalog hub — modules live in the sidebar. */
export default function SearchHubPage() {
  redirect(siteConfig.defaultWorkspacePath);
}
