import { redirect } from "next/navigation";

/**
 * OathNet is not a browsable hub — tools live in Stealer Logs, Breaches,
 * Discord ID, IP, gaming, Holehe, and GHunt. Hard server redirect so the
 * old chip-wall page can never render (even with a stale client bundle).
 */
export default function OathnetHubRedirectPage() {
  redirect("/dashboard/search/stealer-logs");
}
