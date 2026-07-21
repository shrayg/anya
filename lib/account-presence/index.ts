import { searchHandleSweep } from "@/lib/handle-sweep/search";
import {
  mapHandleSweepSource,
  mapWebProfilesSource,
  type AccountPresenceSearchResult,
  type AccountPresenceSourceId,
} from "@/lib/account-presence/types";
import { searchUsernameAccounts } from "@/lib/username-accounts/search";
import {
  sanitizeUsernameForAccounts,
  USERNAME_ACCOUNTS_INVALID_MESSAGE,
} from "@/lib/username-accounts/username";

export type AccountPresenceSearchInput = {
  query: string;
  /** Default: both sources in parallel. */
  sources?: AccountPresenceSourceId[];
  category?: string | null;
};

const DEFAULT_SOURCES: AccountPresenceSourceId[] = [
  "web-profiles",
  "handle-sweep",
];

export async function searchAccountPresence(
  input: AccountPresenceSearchInput,
): Promise<AccountPresenceSearchResult> {
  const started = Date.now();
  const username = sanitizeUsernameForAccounts(input.query);

  if (!username) {
    throw new Error(USERNAME_ACCOUNTS_INVALID_MESSAGE);
  }

  const wanted = new Set(input.sources?.length ? input.sources : DEFAULT_SOURCES);
  const jobs: Promise<AccountPresenceSearchResult["sources"][number]>[] = [];

  if (wanted.has("web-profiles")) {
    jobs.push(
      searchUsernameAccounts({
        query: username,
        category: input.category,
      }).then(mapWebProfilesSource),
    );
  }

  if (wanted.has("handle-sweep")) {
    jobs.push(searchHandleSweep({ query: username }).then(mapHandleSweepSource));
  }

  const settled = await Promise.allSettled(jobs);
  const sources: AccountPresenceSearchResult["sources"] = [];

  for (const item of settled) {
    if (item.status === "fulfilled") {
      sources.push(item.value);
    }
  }

  if (sources.length === 0) {
    throw new Error("Account presence sources failed to respond.");
  }

  const count = sources.reduce((sum, s) => sum + s.count, 0);
  const checked = sources.reduce((sum, s) => sum + s.checked, 0);

  const result: AccountPresenceSearchResult = {
    query: input.query.trim(),
    username,
    count,
    checked,
    sources,
    durationMs: Date.now() - started,
  };

  if (count === 0) {
    result.warning =
      "No live profiles returned from Web Profiles or Handle Sweep.";
  } else {
    result.warning =
      "Hits are heuristic across parallel Anya sources. Verify profile links manually.";
  }

  return result;
}

export {
  WEB_PROFILES_SOURCE_ID,
  WEB_PROFILES_SOURCE_LABEL,
  HANDLE_SWEEP_SOURCE_LABEL,
  mapHandleSweepSource,
  mapWebProfilesSource,
} from "@/lib/account-presence/types";
export type {
  AccountPresenceHit,
  AccountPresenceSearchResult,
  AccountPresenceSourceBlock,
  AccountPresenceSourceId,
} from "@/lib/account-presence/types";
