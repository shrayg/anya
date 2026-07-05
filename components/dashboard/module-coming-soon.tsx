"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

import type { SearchModuleDef } from "@/lib/search-modules";
import { siteConfig } from "@/config/site";

export function ModuleComingSoon({ moduleDef }: { moduleDef: SearchModuleDef }) {
  return (
    <div className="module-search px-6 py-6 md:px-8 md:py-8">
      <Link
        className="module-search-back mb-6 inline-flex items-center gap-2"
        href={siteConfig.defaultWorkspacePath}
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <header className="module-search-hero mb-10">
        <span className="module-search-section">{moduleDef.section}</span>
        <h1 className="module-search-title font-[family-name:var(--font-bruno-ace-sc)]">
          {moduleDef.name}
        </h1>
        <p className="module-search-tagline">{moduleDef.tagline}</p>
      </header>

      <div className="module-coming-soon">
        <div className="module-coming-soon-icon">
          <Sparkles className="size-6" />
        </div>
        <span className="module-coming-soon-badge">Coming soon</span>
        <p className="module-coming-soon-text">
          {siteConfig.name} is training this module. Check back soon — or try{" "}
          <Link className="text-anya-accent underline hover:text-anya-accent-hover" href="/dashboard/search/ai-search">
            AI Search
          </Link>{" "}
          and{" "}
          <Link className="text-anya-accent underline hover:text-anya-accent-hover" href="/dashboard/search/ai-deep-scan">
            AI Deep Scan
          </Link>{" "}
          in the meantime.
        </p>
      </div>
    </div>
  );
}
