"use client";

import { ExternalLink } from "lucide-react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import {
  ResultCard,
  ResultCardList,
  ResultStatStrip,
  type ResultCardFieldDef,
} from "@/components/dashboard/result-card";
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
  const flatHits = categoryKeys.flatMap((category) => {
    const hits = grouped.get(category) ?? [];

    return hits.map((hit) => ({ category, hit }));
  });

  return (
    <div className="anya-result-stack">
      <div className="grid gap-2 sm:grid-cols-4">
        <ResultStatStrip
          label="Username"
          value={<BlurredValue forceBlur={blurResults} text={data.username} />}
        />
        <ResultStatStrip label="Profiles found" value={data.count} />
        <ResultStatStrip label="Platforms checked" value={data.checked} />
        <ResultStatStrip
          label="Duration"
          value={`${(data.durationMs / 1000).toFixed(1)}s`}
        />
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
            const categoryStart = flatHits.findIndex(
              (entry) => entry.category === category,
            );

            return (
              <section key={category} className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                  {categoryLabel(category)} · {hits.length}
                </h3>
                <ResultCardList>
                  {hits.map((hit, i) => {
                    const fields: ResultCardFieldDef[] = [
                      {
                        key: "url",
                        label: "Profile URL",
                        value: hit.url,
                        highlight: true,
                        block: true,
                      },
                    ];

                    return (
                      <ResultCard
                        key={`${hit.siteName}-${hit.url}`}
                        blurResults={blurResults}
                        copyText={hit.url}
                        fields={fields}
                        listIndex={categoryStart + i}
                        subtitle={hit.url}
                        title={hit.siteName}
                        footer={
                          blurResults ? (
                            <p className="px-3 pb-3 text-xs text-zinc-500">
                              Locked
                            </p>
                          ) : (
                            <div className="px-3 pb-3">
                              <a
                                className="inline-flex items-center gap-1 text-xs text-anya-accent hover:underline"
                                href={hit.url}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                Open
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          )
                        }
                      />
                    );
                  })}
                </ResultCardList>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
