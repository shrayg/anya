"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { ModuleComingSoon } from "@/components/dashboard/module-coming-soon";
import { ModuleSearchView } from "@/components/dashboard/module-search-view";
import { getSearchModuleBySlug } from "@/lib/search-modules";

export default function ModuleSearchPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const moduleDef = getSearchModuleBySlug(slug);

  useEffect(() => {
    if (slug === "domains") {
      router.replace("/dashboard/search/stealer-logs");
    }
    if (slug === "breachbase") {
      router.replace("/dashboard/search/breaches");
    }
  }, [router, slug]);

  if (slug === "domains" || slug === "breachbase") {
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
          href="/dashboard/search"
        >
          Back to search hub
        </Link>
      </div>
    );
  }

  if (moduleDef.comingSoon) {
    return <ModuleComingSoon moduleDef={moduleDef} />;
  }

  return <ModuleSearchView key={moduleDef.slug} moduleDef={moduleDef} />;
}
