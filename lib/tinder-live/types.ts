export type TinderLiveGenderFilter = -1 | 0 | 1;

export type TinderLiveSearchInput = {
  /** Passport / meta location (required for useful geo search). */
  lat: number;
  lon: number;
  ageMin?: number;
  ageMax?: number;
  /** Max distance in kilometers (converted to miles by the client). */
  distanceKm?: number;
  /** man = 0, woman = 1, everyone = -1 */
  genderFilter?: TinderLiveGenderFilter;
  /** Only show profiles with a bio (Gold/Platinum recommendation filter). */
  hasBio?: boolean;
  /** Minimum photo count filter (paid recommendation filter). */
  numberOfPhotos?: number;
  locale?: string;
};

export type TinderLivePhoto = {
  id: string;
  url: string;
};

export type TinderLiveProfileCard = {
  userId: string;
  name: string | null;
  age: number | null;
  bio: string | null;
  distanceMi: number | null;
  city: string | null;
  photos: TinderLivePhoto[];
  sNumber: number | null;
};

export type TinderLiveSearchResult = {
  query: string;
  applied: {
    lat: number;
    lon: number;
    ageMin: number | null;
    ageMax: number | null;
    distanceKm: number | null;
    genderFilter: TinderLiveGenderFilter | null;
    hasBio: boolean | null;
    numberOfPhotos: number | null;
    locationUpdated: boolean;
    preferencesUpdated: boolean;
  };
  count: number;
  profiles: TinderLiveProfileCard[];
  warning: string | null;
  sources: string[];
};
