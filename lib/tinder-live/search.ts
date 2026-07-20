import { assertTinderLiveReady, getTinderLiveClient } from "@/lib/tinder-live/client";
import type {
  TinderLiveGenderFilter,
  TinderLiveProfileCard,
  TinderLiveSearchInput,
  TinderLiveSearchResult,
} from "@/lib/tinder-live/types";

function clampAge(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;

  return Math.min(100, Math.max(18, Math.round(value)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;

  return value as Record<string, unknown>;
}

function pickPhotoUrl(photo: Record<string, unknown>): string | null {
  if (typeof photo.url === "string" && photo.url) return photo.url;

  const processed = photo.processedFiles;

  if (Array.isArray(processed)) {
    for (const entry of processed) {
      const row = asRecord(entry);

      if (row && typeof row.url === "string" && row.url) return row.url;
    }
  }

  return null;
}

function mapProfile(raw: unknown): TinderLiveProfileCard | null {
  const row = asRecord(raw);

  if (!row) return null;

  const user = asRecord(row.user) ?? row;
  const userId = typeof user._id === "string" ? user._id : null;

  if (!userId) return null;

  const photosRaw = Array.isArray(user.photos) ? user.photos : [];
  const photos = photosRaw
    .map((photo) => {
      const p = asRecord(photo);

      if (!p) return null;
      const id = typeof p.id === "string" ? p.id : "";
      const url = pickPhotoUrl(p);

      if (!id || !url) return null;

      return { id, url };
    })
    .filter(Boolean) as TinderLiveProfileCard["photos"];

  const city =
    asRecord(user.city)?.name && typeof asRecord(user.city)?.name === "string"
      ? String(asRecord(user.city)?.name)
      : null;

  return {
    userId,
    name: typeof user.name === "string" ? user.name : null,
    age: typeof user.age === "number" ? user.age : null,
    bio: typeof user.bio === "string" ? user.bio : null,
    distanceMi:
      typeof row.distance_mi === "number"
        ? row.distance_mi
        : typeof user.distance_mi === "number"
          ? user.distance_mi
          : null,
    city,
    photos,
    sNumber:
      typeof row.s_number === "number"
        ? row.s_number
        : typeof user.s_number === "number"
          ? user.s_number
          : null,
  };
}

/**
 * Parse operator input.
 * Supported forms:
 *   40.7128,-74.0060
 *   lat=40.7128 lon=-74.0060 ageMin=22 ageMax=35 distanceKm=40 gender=1 hasBio=1 photos=3
 */
export function parseTinderLiveQuery(raw: string): TinderLiveSearchInput {
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
      "Invalid coordinates. Use lat,lon like 40.7128,-74.0060 (Passport location).",
    );
  }

  const genderRaw = kv.gender ?? kv.genderfilter;
  let genderFilter: TinderLiveGenderFilter | undefined;

  if (genderRaw != null) {
    const g = Number(genderRaw);

    if (g === -1 || g === 0 || g === 1) genderFilter = g;
  }

  return {
    lat,
    lon,
    ageMin: kv.agemin ? Number(kv.agemin) : undefined,
    ageMax: kv.agemax ? Number(kv.agemax) : undefined,
    distanceKm: kv.distancekm
      ? Number(kv.distancekm)
      : kv.distance
        ? Number(kv.distance)
        : undefined,
    genderFilter,
    hasBio:
      kv.hasbio === "1" || kv.hasbio === "true"
        ? true
        : kv.hasbio === "0" || kv.hasbio === "false"
          ? false
          : undefined,
    numberOfPhotos: kv.photos ? Number(kv.photos) : undefined,
  };
}

export async function runTinderLiveSearch(
  input: TinderLiveSearchInput,
  queryLabel: string,
): Promise<TinderLiveSearchResult> {
  assertTinderLiveReady();
  const api = getTinderLiveClient();

  let locationUpdated = false;
  let preferencesUpdated = false;
  let warning: string | null = null;

  try {
    await api.setLocation({ lat: input.lat, lon: input.lon });
    locationUpdated = true;
  } catch (error) {
    warning =
      error instanceof Error
        ? `Location update failed (${error.message}). Using existing Passport location.`
        : "Location update failed. Using existing Passport location.";
  }

  const ageMin = clampAge(input.ageMin, 18);
  const ageMax = clampAge(input.ageMax, 45);
  const preferencePayload: Record<string, unknown> = {
    ageFilterMin: Math.min(ageMin, ageMax),
    ageFilterMax: Math.max(ageMin, ageMax),
  };

  if (input.distanceKm != null && Number.isFinite(input.distanceKm)) {
    preferencePayload.distanceFilterKm = Math.max(
      1,
      Math.round(input.distanceKm),
    );
  }

  if (input.genderFilter === -1 || input.genderFilter === 0 || input.genderFilter === 1) {
    preferencePayload.genderFilter = input.genderFilter;
  }

  if (typeof input.hasBio === "boolean") {
    preferencePayload.hasBio = input.hasBio;
  }

  if (input.numberOfPhotos != null && Number.isFinite(input.numberOfPhotos)) {
    preferencePayload.numberOfPhotos = Math.max(
      1,
      Math.round(input.numberOfPhotos),
    );
  }

  try {
    await api.updateProfilePreferences(preferencePayload as never);
    preferencesUpdated = true;
  } catch (error) {
    const paidHint =
      "Recommendation filters (bio/photos/interests) need Tinder Gold/Platinum.";
    const message =
      error instanceof Error ? error.message : "Preference update failed";

    warning = warning
      ? `${warning} Preference update failed (${message}). ${paidHint}`
      : `Preference update failed (${message}). ${paidHint}`;
  }

  const search = await api.search();
  const payload = asRecord(search.data);
  const data = asRecord(payload?.data);
  const results = Array.isArray(data?.results) ? data.results : [];
  const profiles = results
    .map(mapProfile)
    .filter(Boolean) as TinderLiveProfileCard[];

  return {
    query: queryLabel,
    applied: {
      lat: input.lat,
      lon: input.lon,
      ageMin: preferencePayload.ageFilterMin as number,
      ageMax: preferencePayload.ageFilterMax as number,
      distanceKm:
        typeof preferencePayload.distanceFilterKm === "number"
          ? (preferencePayload.distanceFilterKm as number)
          : null,
      genderFilter:
        preferencePayload.genderFilter === -1 ||
        preferencePayload.genderFilter === 0 ||
        preferencePayload.genderFilter === 1
          ? (preferencePayload.genderFilter as TinderLiveGenderFilter)
          : null,
      hasBio:
        typeof preferencePayload.hasBio === "boolean"
          ? (preferencePayload.hasBio as boolean)
          : null,
      numberOfPhotos:
        typeof preferencePayload.numberOfPhotos === "number"
          ? (preferencePayload.numberOfPhotos as number)
          : null,
      locationUpdated,
      preferencesUpdated,
    },
    count: profiles.length,
    profiles,
    warning,
    sources: ["Tinder Live (operator session)"],
  };
}
