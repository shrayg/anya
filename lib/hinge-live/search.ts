import { assertHingeLiveReady, hingeLiveFetch } from "@/lib/hinge-live/client";
import type {
  HingeLiveAnswer,
  HingeLiveGenderPreference,
  HingeLivePhoto,
  HingeLiveProfileCard,
  HingeLiveSearchInput,
  HingeLiveSearchResult,
} from "@/lib/hinge-live/types";

function clampAge(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;

  return Math.min(100, Math.max(18, Math.round(value)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function kmToMiles(km: number): number {
  return Math.max(1, Math.round(km * 0.621371));
}

/**
 * Parse operator input.
 * Supported forms:
 *   40.7128,-74.0060
 *   lat=40.7128 lon=-74.0060 ageMin=22 ageMax=35 distanceMi=25 gender=1 q=alex
 */
export function parseHingeLiveQuery(raw: string): HingeLiveSearchInput {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error("Provide coordinates as lat,lon (example: 40.7128,-74.0060).");
  }

  const kv: Record<string, string> = {};
  const tokens = trimmed.split(/[\s&]+/).filter(Boolean);

  for (const token of tokens) {
    const eq = token.indexOf("=");

    if (eq > 0) {
      kv[token.slice(0, eq).toLowerCase()] = token.slice(eq + 1);
    }
  }

  let lat: number | null = null;
  let lon: number | null = null;

  if (kv.lat && kv.lon) {
    lat = Number(kv.lat);
    lon = Number(kv.lon);
  } else {
    const pair = trimmed.match(
      /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/,
    );

    if (pair) {
      lat = Number(pair[1]);
      lon = Number(pair[2]);
    }
  }

  if (
    lat == null ||
    lon == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    throw new Error(
      "Invalid coordinates. Use lat,lon like 40.7128,-74.0060 (operator account location).",
    );
  }

  const genderRaw = kv.gender ?? kv.genderpreference;
  let genderPreference: HingeLiveGenderPreference | undefined;

  if (genderRaw != null) {
    const g = Number(genderRaw);

    if (g === 0 || g === 1) genderPreference = g;
  }

  let distanceMi: number | undefined;

  if (kv.distancemi || kv.distance) {
    distanceMi = Number(kv.distancemi ?? kv.distance);
  } else if (kv.distancekm) {
    distanceMi = kmToMiles(Number(kv.distancekm));
  }

  const pagesRaw = kv.pages ? Number(kv.pages) : undefined;

  return {
    lat,
    lon,
    locationName: kv.name || kv.location || kv.city || undefined,
    ageMin: kv.agemin ? Number(kv.agemin) : undefined,
    ageMax: kv.agemax ? Number(kv.agemax) : undefined,
    distanceMi,
    genderPreference,
    keyword: kv.q || kv.keyword || kv.filter || undefined,
    activeToday: kv.activetoday === "1" || kv.activetoday === "true",
    newHere: kv.newhere === "1" || kv.newhere === "true",
    pages:
      pagesRaw != null && Number.isFinite(pagesRaw)
        ? Math.min(3, Math.max(1, Math.round(pagesRaw)))
        : undefined,
  };
}

async function resolvePlayerId(): Promise<string> {
  const fromEnv = process.env.HINGE_PLAYER_ID?.trim();

  if (fromEnv) return fromEnv;

  const { data } = await hingeLiveFetch<unknown>("/user/v3");
  const row = asRecord(data);
  const userId = asString(row?.userId);

  if (!userId) {
    throw new Error(
      "Could not resolve Hinge playerId. Set HINGE_PLAYER_ID or refresh session credentials.",
    );
  }

  return userId;
}

type RecSubject = {
  subjectId: string;
  viewToken: string | null;
};

function collectSubjects(recPayload: unknown): {
  subjects: RecSubject[];
  viewToken: string | null;
} {
  const root = asRecord(recPayload);
  const feeds = Array.isArray(root?.feeds) ? root.feeds : [];
  const subjects: RecSubject[] = [];
  let viewToken: string | null = null;

  for (const feed of feeds) {
    const feedRow = asRecord(feed);

    if (!feedRow) continue;

    const token = asString(feedRow.viewToken);

    if (token && !viewToken) viewToken = token;

    const rows = Array.isArray(feedRow.subjects) ? feedRow.subjects : [];

    for (const entry of rows) {
      const subject = asRecord(entry);
      const subjectId = asString(subject?.subjectId);

      if (!subjectId) continue;
      subjects.push({ subjectId, viewToken: token });
    }

    const preview = asRecord(feedRow.preview);
    const previewSubjects = Array.isArray(preview?.subjects)
      ? preview.subjects
      : [];

    for (const entry of previewSubjects) {
      const subject = asRecord(entry);
      const subjectId = asString(subject?.subjectId);

      if (!subjectId) continue;
      subjects.push({ subjectId, viewToken: token });
    }
  }

  return { subjects, viewToken };
}

function mapProfileRow(raw: unknown): {
  userId: string;
  card: Partial<HingeLiveProfileCard>;
} | null {
  const row = asRecord(raw);

  if (!row) return null;
  const userId = asString(row.userId);

  if (!userId) return null;

  const profile = asRecord(row.profile) ?? row;
  const location = asRecord(profile.location);
  const educationsRaw = profile.educations;
  const educations = Array.isArray(educationsRaw)
    ? educationsRaw.filter((v): v is string => typeof v === "string")
    : [];

  return {
    userId,
    card: {
      userId,
      firstName: asString(profile.firstName),
      age: asNumber(profile.age),
      location: asString(location?.name),
      hometown: asString(profile.hometown),
      jobTitle: asString(profile.jobTitle) ?? asString(profile.works),
      educations,
      heightCm: asNumber(profile.height),
      selfieVerified:
        typeof profile.selfieVerified === "boolean"
          ? profile.selfieVerified
          : null,
    },
  };
}

function mapContentRow(raw: unknown): {
  userId: string;
  photos: HingeLivePhoto[];
  answers: HingeLiveAnswer[];
} | null {
  const row = asRecord(raw);

  if (!row) return null;
  const userId = asString(row.userId);

  if (!userId) return null;

  const content = asRecord(row.content) ?? row;
  const photosRaw = Array.isArray(content.photos) ? content.photos : [];
  const photos: HingeLivePhoto[] = [];

  for (const photo of photosRaw) {
    const p = asRecord(photo);

    if (!p) continue;
    const url = asString(p.url);
    const id = asString(p.contentId) || asString(p.cdnId) || url;

    if (!url || !id) continue;
    photos.push({
      id,
      url,
      caption: asString(p.caption),
    });
  }

  const answersRaw = Array.isArray(content.answers) ? content.answers : [];
  const answers: HingeLiveAnswer[] = answersRaw.map((answer) => {
    const a = asRecord(answer);

    return {
      questionId: asString(a?.questionId),
      response: asString(a?.response),
    };
  });

  return { userId, photos, answers };
}

function matchesKeyword(card: HingeLiveProfileCard, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();

  if (!needle) return true;

  const haystack = [
    card.firstName,
    card.location,
    card.hometown,
    card.jobTitle,
    ...card.educations,
    ...card.answers.map((a) => a.response),
    ...card.photos.map((p) => p.caption),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  return haystack.includes(needle);
}

function defaultDealbreakers(genderKey: string) {
  return {
    genderedHeight: { [genderKey]: false },
    maxDistance: true,
    familyPlans: false,
    drugs: false,
    ethnicities: false,
    children: false,
    educationAttained: false,
    drinking: false,
    priorityOrder: [] as unknown[],
    relationshipTypes: false,
    genderedAge: { [genderKey]: true },
    marijuana: false,
    religions: false,
    politics: false,
    selfieVerified: false,
    smoking: false,
    datingIntentions: false,
  };
}

export async function runHingeLiveSearch(
  input: HingeLiveSearchInput,
  queryLabel: string,
): Promise<HingeLiveSearchResult> {
  assertHingeLiveReady();

  let locationUpdated = false;
  let preferencesUpdated = false;
  let warning: string | null = null;

  const locationBody = {
    profile: {
      location: {
        latitude: input.lat,
        longitude: input.lon,
        countryShort: "US",
        source: "manual",
        ...(input.locationName
          ? { name: input.locationName, locality: input.locationName }
          : {}),
      },
    },
  };

  try {
    await hingeLiveFetch("/user/v3", {
      method: "PATCH",
      body: locationBody,
    });
    locationUpdated = true;
  } catch (error) {
    warning =
      error instanceof Error
        ? `Location update failed (${error.message}). Using existing account location.`
        : "Location update failed. Using existing account location.";
  }

  const ageMin = clampAge(input.ageMin, 18);
  const ageMax = clampAge(input.ageMax, 35);
  const genderPreference = input.genderPreference ?? 1;
  const genderKey = String(genderPreference);
  const distanceMi =
    input.distanceMi != null && Number.isFinite(input.distanceMi)
      ? Math.max(1, Math.round(input.distanceMi))
      : 25;

  const preferencePayload = [
    {
      genderedAgeRanges: {
        [genderKey]: {
          min: Math.min(ageMin, ageMax),
          max: Math.max(ageMin, ageMax),
        },
      },
      genderedHeightRanges: {
        [genderKey]: { min: 92, max: 214 },
      },
      genderPreferences: [genderPreference],
      maxDistance: distanceMi,
      dealbreakers: defaultDealbreakers(genderKey),
      familyPlans: [-1],
      drugs: [-1],
      ethnicities: [-1],
      children: [-1],
      educationAttained: [-1],
      drinking: [-1],
      relationshipTypes: [-1],
      marijuana: [-1],
      religions: [-1],
      politics: [-1],
      smoking: [-1],
      datingIntentions: [-1],
    },
  ];

  try {
    await hingeLiveFetch("/preference/v2/selected", {
      method: "PATCH",
      body: preferencePayload,
    });
    preferencesUpdated = true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Preference update failed";

    warning = warning
      ? `${warning} Preference update failed (${message}).`
      : `Preference update failed (${message}).`;
  }

  const playerId = await resolvePlayerId();
  const pages = input.pages ?? 1;
  const subjectMap = new Map<string, string | null>();
  let primaryViewToken: string | null = null;

  for (let page = 0; page < pages; page += 1) {
    const { status, data } = await hingeLiveFetch<unknown>("/rec/v2", {
      method: "POST",
      body: {
        filterCircleMembers: false,
        playerId,
        activeToday: Boolean(input.activeToday),
        newHere: Boolean(input.newHere),
      },
    });

    if (status === 304 && page === 0) {
      warning = warning
        ? `${warning} Recommendations returned 304 (cached/empty).`
        : "Recommendations returned 304 (cached/empty). Try changing location or prefs.";
    }

    const collected = collectSubjects(data);

    if (collected.viewToken && !primaryViewToken) {
      primaryViewToken = collected.viewToken;
    }

    for (const subject of collected.subjects) {
      if (!subjectMap.has(subject.subjectId)) {
        subjectMap.set(subject.subjectId, subject.viewToken);
      }
    }
  }

  const subjectIds = [...subjectMap.keys()];
  const profilesById = new Map<string, HingeLiveProfileCard>();

  for (const id of subjectIds) {
    profilesById.set(id, {
      userId: id,
      firstName: null,
      age: null,
      location: null,
      hometown: null,
      jobTitle: null,
      educations: [],
      heightCm: null,
      selfieVerified: null,
      answers: [],
      photos: [],
    });
  }

  const hydrateChunk = async (ids: string[]) => {
    if (!ids.length) return;

    const body = {
      ids,
      ...(primaryViewToken ? { viewToken: primaryViewToken } : {}),
    };

    try {
      const { data: userData } = await hingeLiveFetch<unknown>(
        "/user/v3/public",
        { method: "POST", body },
      );
      const users = Array.isArray(userData) ? userData : [];

      for (const entry of users) {
        const mapped = mapProfileRow(entry);

        if (!mapped) continue;
        const existing = profilesById.get(mapped.userId) ?? {
          userId: mapped.userId,
          firstName: null,
          age: null,
          location: null,
          hometown: null,
          jobTitle: null,
          educations: [],
          heightCm: null,
          selfieVerified: null,
          answers: [],
          photos: [],
        };

        profilesById.set(mapped.userId, { ...existing, ...mapped.card });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "user hydrate failed";

      warning = warning
        ? `${warning} Profile hydrate failed (${message}).`
        : `Profile hydrate failed (${message}).`;
    }

    try {
      const { data: contentData } = await hingeLiveFetch<unknown>(
        "/content/v2/public",
        { method: "POST", body },
      );
      const contents = Array.isArray(contentData) ? contentData : [];

      for (const entry of contents) {
        const mapped = mapContentRow(entry);

        if (!mapped) continue;
        const existing = profilesById.get(mapped.userId) ?? {
          userId: mapped.userId,
          firstName: null,
          age: null,
          location: null,
          hometown: null,
          jobTitle: null,
          educations: [],
          heightCm: null,
          selfieVerified: null,
          answers: [],
          photos: [],
        };

        profilesById.set(mapped.userId, {
          ...existing,
          photos: mapped.photos,
          answers: mapped.answers,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "content hydrate failed";

      warning = warning
        ? `${warning} Content hydrate failed (${message}).`
        : `Content hydrate failed (${message}).`;
    }
  };

  // Batch hydrate (Charles used ~26 ids per call)
  const chunkSize = 26;

  for (let i = 0; i < subjectIds.length; i += chunkSize) {
    await hydrateChunk(subjectIds.slice(i, i + chunkSize));
  }

  let profiles = [...profilesById.values()];

  if (input.keyword?.trim()) {
    profiles = profiles.filter((card) => matchesKeyword(card, input.keyword!));
  }

  // Prefer cards that at least hydrated a name or photo
  profiles.sort((a, b) => {
    const score = (p: HingeLiveProfileCard) =>
      (p.firstName ? 2 : 0) + (p.photos.length ? 1 : 0) + (p.answers.length ? 1 : 0);

    return score(b) - score(a);
  });

  return {
    query: queryLabel,
    applied: {
      lat: input.lat,
      lon: input.lon,
      locationName: input.locationName ?? null,
      ageMin,
      ageMax,
      distanceMi,
      genderPreference,
      keyword: input.keyword?.trim() || null,
      activeToday: Boolean(input.activeToday),
      newHere: Boolean(input.newHere),
      pages,
      locationUpdated,
      preferencesUpdated,
    },
    count: profiles.length,
    subjectCount: subjectIds.length,
    profiles,
    warning,
    sources: [
      "Hinge Live (operator session)",
      "residential proxy",
    ],
  };
}
