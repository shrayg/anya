"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";

import { ModuleComingSoon } from "@/components/dashboard/module-coming-soon";
import { ModuleSearchView } from "@/components/dashboard/module-search-view";
import {
  CRYPTO_INTEL_UNIFIED_SLUG,
} from "@/lib/crypto-intel/enabled";
import { isLegacyPublicRecordsSlug } from "@/lib/public-records/source-options";
import {
  CRYPTO_INTEL_LEGACY_REDIRECT_SLUGS,
  getCryptoIntelToolIdForLegacySlug,
  getIntentUnifiedRedirect,
  getSearchModuleBySlug,
} from "@/lib/search-modules";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function ModuleSearchPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const moduleDef = getSearchModuleBySlug(slug);
  const intentRedirect = getIntentUnifiedRedirect(slug);
  const isLegacyRedirect =
    slug === "domains" ||
    slug === "breachbase" ||
    isLegacyPublicRecordsSlug(slug) ||
    CRYPTO_INTEL_LEGACY_REDIRECT_SLUGS.has(slug.toLowerCase()) ||
    Boolean(intentRedirect);

  // useLayoutEffect: navigate before paint so folded hubs (e.g. oathnet) never
  // flash ModuleSearchView. Server redirect in next.config + /oathnet/page.tsx
  // is the primary path; this covers soft client navigations.
  useIsoLayoutEffect(() => {
    if (slug === "domains") {
      router.replace("/dashboard/search/stealer-logs");
      return;
    }
    if (slug === "breachbase") {
      router.replace("/dashboard/search/breaches");
      return;
    }
    if (isLegacyPublicRecordsSlug(slug)) {
      router.replace("/dashboard/search/public-records");
      return;
    }
    if (CRYPTO_INTEL_LEGACY_REDIRECT_SLUGS.has(slug.toLowerCase())) {
      const tool = getCryptoIntelToolIdForLegacySlug(slug);
      const qs = tool ? `?tool=${encodeURIComponent(tool)}` : "";

      router.replace(`/dashboard/search/${CRYPTO_INTEL_UNIFIED_SLUG}${qs}`);
      return;
    }
    if (intentRedirect) {
      const qs = intentRedirect.tool
        ? `?tool=${encodeURIComponent(intentRedirect.tool)}`
        : "";

      router.replace(`/dashboard/search/${intentRedirect.slug}${qs}`);
    }
  }, [router, slug, intentRedirect]);

  if (isLegacyRedirect) {
    return null;
  }

  if (!moduleDef) {
    return (
      <div className="module-search px-6 py-16 text-center md:px-8">
        <h1 className="font-[family-name:var(--font-bruno-ace-sc)] text-2xl text-white">
          Module not found
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          No search module matches &quot;{slug}&quot;.
        </p>
        <Link
          className="anya-link-btn mt-6 inline-flex"
          href="/dashboard/search/ai-search"
        >
          Open AI Search
        </Link>
      </div>
    );
  }

  if (moduleDef.comingSoon) {
    return <ModuleComingSoon moduleDef={moduleDef} />;
  }

  return <ModuleSearchView key={moduleDef.slug} moduleDef={moduleDef} />;
}
