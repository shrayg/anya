"use client";

import { ExternalLink } from "lucide-react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import type { UsernameAccountsSearchResult } from "@/lib/username-accounts/types";

const CATEGORY_LABELS: Record<string, string> = {
  coding: "Coding",
  social: "Social",
  professional: "Professional",
  video: "Video",
  gaming: "Gaming",
  music: "Music",
  photography: "Photography",
  art: "Art",
  content: "Content",
  forum: "Forums",
  security: "Security",
  education: "Education",
  books: "Books",
  fitness: "Fitness",
  ecommerce: "Commerce",
  freelance: "Freelance",
  blogging: "Blogging",
  crypto: "Crypto",
  dating: "Dating",
  travel: "Travel",
  links: "Link hubs",
  avatar: "Avatar",
};

function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key;
}

export function UsernameAccountsResults({
  data,
  blurResults = false,
}: {
  data: UsernameAccountsSearchResult;
  blurResults?: boolean;
}) {
  const grouped = new Map<string, typeof data.found>();

  for (const hit of data.found) {
    const key = hit.category || "unknown";
    const list = grouped.get(key) ?? [];

    list.push(hit);
    grouped.set(key, list);
  }

  const categoryKeys = [...grouped.keys()].sort();

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="anya-result-strip">
          <p className="anya-result-label">Username</p>
          <p className="anya-result-value">
            <BlurredValue forceBlur={blurResults} text={data.username} />
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Profiles found</p>
          <p className="anya-result-value">{data.count}</p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Platforms checked</p>
          <p className="anya-result-value">{data.checked}</p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Duration</p>
          <p className="anya-result-value">
            {(data.durationMs / 1000).toFixed(1)}s
          </p>
        </div>
      </div>

      {data.warning ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/90">
          {data.warning}
        </p>
      ) : null}

      {data.count === 0 ? (
        <p className="text-sm text-zinc-500">
          No public profiles returned HTTP 200 for this handle
          {data.categoryFilter ? ` in ${data.categoryFilter}` : ""}.
        </p>
      ) : (
        <div className="space-y-6">
          {categoryKeys.map((category) => {
            const hits = grouped.get(category) ?? [];

            return (
              <section key={category} className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                  {categoryLabel(category)} · {hits.length}
                </h3>
                <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-black/30">
                  {hits.map((hit) => (
                    <li
                      key={`${hit.siteName}-${hit.url}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {hit.siteName}
                        </p>
                        <p className="truncate font-mono text-[11px] text-zinc-500">
                          <BlurredValue
                            forceBlur={blurResults}
                            text={hit.url}
                          />
                        </p>
                      </div>
                      {blurResults ? (
                        <span className="text-xs text-zinc-500">Locked</span>
                      ) : (
                        <a
                          className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                          href={hit.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Open
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
