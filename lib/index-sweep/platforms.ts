/**

 * Platforms where quoted identifier + site: operator can surface indexed pages.

 * Closed apps (Snapchat, Hinge, Tinder, etc.) are intentionally excluded —

 * search engines cannot crawl their profile databases.

 */



export type IndexSweepPlatform = {

  id: string;

  label: string;

  /** Host for site: operator (no protocol). */

  site: string;

  /** email | phone | both */

  supports: "email" | "phone" | "both";

  /** How useful this surface usually is for exact matches. */

  reliability: "high" | "medium" | "low";

  note: string;

};



/**

 * Public / crawlable surfaces for Index Sweep.

 * Phone uses the same list with strict quoted format variants.

 */

export const INDEX_SWEEP_PLATFORMS: IndexSweepPlatform[] = [

  {

    id: "linkedin",

    label: "LinkedIn",

    site: "linkedin.com",

    supports: "both",

    reliability: "high",

    note: "Best surface for Contact Info email/phone when public and indexed. Phone format variants matter.",

  },

  {

    id: "github",

    label: "GitHub",

    site: "github.com",

    supports: "both",

    reliability: "high",

    note: "Emails in profiles/commits/gists; phones appear less often but are searchable when present.",

  },

  {

    id: "xing",

    label: "Xing",

    site: "xing.com",

    supports: "both",

    reliability: "medium",

    note: "European professional network; similar public-profile indexing pattern.",

  },

  {

    id: "gitlab",

    label: "GitLab",

    site: "gitlab.com",

    supports: "both",

    reliability: "medium",

    note: "Public commits and profiles can expose emails; phones are rarer.",

  },

  {

    id: "aboutme",

    label: "About.me",

    site: "about.me",

    supports: "both",

    reliability: "medium",

    note: "Personal landing pages sometimes list contact email or phone publicly.",

  },

  {

    id: "researchgate",

    label: "ResearchGate",

    site: "researchgate.net",

    supports: "both",

    reliability: "medium",

    note: "Academic profiles may list institutional emails or contact numbers.",

  },

  {

    id: "academia",

    label: "Academia.edu",

    site: "academia.edu",

    supports: "both",

    reliability: "medium",

    note: "Scholar profiles; visibility depends on public settings.",

  },

  {

    id: "keybase",

    label: "Keybase",

    site: "keybase.io",

    supports: "both",

    reliability: "medium",

    note: "Public identity proofs can include emails; phones uncommon.",

  },

  {

    id: "medium",

    label: "Medium",

    site: "medium.com",

    supports: "both",

    reliability: "low",

    note: "Occasional author bios; lower hit rate than LinkedIn/GitHub.",

  },

  {

    id: "behance",

    label: "Behance",

    site: "behance.net",

    supports: "both",

    reliability: "low",

    note: "Creative portfolios sometimes include contact details.",

  },

  {

    id: "crunchbase",

    label: "Crunchbase",

    site: "crunchbase.com",

    supports: "both",

    reliability: "low",

    note: "Company/people pages; often paywalled but snippets can match.",

  },

  {

    id: "wellfound",

    label: "Wellfound",

    site: "wellfound.com",

    supports: "both",

    reliability: "low",

    note: "Startup profiles (formerly AngelList) may expose contact text.",

  },

  {

    id: "facebook",

    label: "Facebook",

    site: "facebook.com",

    supports: "both",

    reliability: "low",

    note: "Most profiles are login-walled; public pages/directories sometimes still match.",

  },

  {

    id: "instagram",

    label: "Instagram",

    site: "instagram.com",

    supports: "both",

    reliability: "medium",

    note: "Quoted site: hits are rare for email; unquoted email often surfaces the matching @handle. Phone indexing is uncommon.",

  },

  {

    id: "wordpress",

    label: "WordPress.com",

    site: "wordpress.com",

    supports: "both",

    reliability: "low",

    note: "Public blogs and author pages.",

  },

  {

    id: "gravatar",

    label: "Gravatar",

    site: "gravatar.com",

    supports: "both",

    reliability: "low",

    note: "Profile pages are hash-based; exact identifier text is uncommon but possible on linked bios.",

  },

];



/** Explicitly unsupported for this technique (document in UI notes). */

export const INDEX_SWEEP_UNSUPPORTED = [

  {

    label: "Snapchat",

    reason: "App-walled; Google cannot index profiles. Discovery is contact-sync based.",

  },

  {

    label: "Hinge",

    reason: "No public indexed profiles; use Email Presence / pause-account controls instead.",

  },

  {

    label: "Tinder",

    reason: "Closed ecosystem; not crawlable via site: operators.",

  },

  {

    label: "Bumble",

    reason: "Closed dating app; not indexed by search engines.",

  },

  {

    label: "TikTok",

    reason: "App-first; profile pages are not a reliable email/phone index surface.",

  },

] as const;



export function platformsForQueryType(

  kind: "email" | "phone",

): IndexSweepPlatform[] {

  return INDEX_SWEEP_PLATFORMS.filter(

    (p) => p.supports === "both" || p.supports === kind,

  );

}

