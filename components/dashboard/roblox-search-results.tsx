"use client";

import type { DiscordProfile } from "@/lib/discord-profile";
import type { RobloxSearchResult } from "@/lib/roblox-search";

import { useEffect, useMemo, useState } from "react";

import {
  LinkedDiscordProfiles,
  LinkedDiscordProfileSkeleton,
} from "@/components/dashboard/linked-discord-profiles";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import { formatSearchRecords } from "@/lib/search-utils";

type LinkedProfile = { id: string; profile: DiscordProfile };

export function RobloxSearchResults({
  result,
  blurResults = false,
  selectedExportIndex = null,
  onSelectExportIndex,
}: {
  result: RobloxSearchResult;
  blurResults?: boolean;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
}) {
  const records = useMemo(
    () => formatSearchRecords(result.results),
    [result.results],
  );

  const [linkedDiscord, setLinkedDiscord] = useState<LinkedProfile[]>(
    result.linkedDiscord ?? [],
  );
  const [loadingProfiles, setLoadingProfiles] = useState(
    (result.linkedDiscordIds?.length ?? 0) > 0 && !result.linkedDiscord?.length,
  );

  useEffect(() => {
    const ids = result.linkedDiscordIds ?? [];

    if (result.linkedDiscord?.length) {
      setLinkedDiscord(result.linkedDiscord);
      setLoadingProfiles(false);

      return;
    }

    if (ids.length === 0) {
      setLinkedDiscord([]);
      setLoadingProfiles(false);

      return;
    }

    let cancelled = false;

    setLoadingProfiles(true);

    fetch(`/api/osint/discord/profile?ids=${encodeURIComponent(ids.join(","))}`)
      .then((response) => response.json())
      .then((data: { profiles?: LinkedProfile[]; error?: string }) => {
        if (cancelled) return;
        setLinkedDiscord(Array.isArray(data.profiles) ? data.profiles : []);
      })
      .catch(() => {
        if (!cancelled) {
          setLinkedDiscord([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProfiles(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [result.linkedDiscord, result.linkedDiscordIds]);

  return (
    <div>
      {loadingProfiles ? (
        <div className="mb-6 space-y-4">
          <div>
            <p className="font-[family-name:var(--font-bruno-ace-sc)] text-sm tracking-wide text-white">
              Linked Discord profile
            </p>
            <p className="mt-1 text-xs text-zinc-500">Resolving Discord IDs…</p>
          </div>
          {(result.linkedDiscordIds ?? []).map((id) => (
            <LinkedDiscordProfileSkeleton key={id} />
          ))}
        </div>
      ) : (
        <LinkedDiscordProfiles profiles={linkedDiscord} />
      )}
      <SearchResultCards
        blurResults={blurResults}
        records={records}
        selectedExportIndex={selectedExportIndex}
        totalCount={result.count}
        onSelectExportIndex={onSelectExportIndex}
      />
    </div>
  );
}
