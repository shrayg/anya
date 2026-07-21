export type HingeLiveGenderPreference = 0 | 1;

export type HingeLiveSearchInput = {
  lat: number;
  lon: number;
  /** Optional place label written into PATCH /user/v3 location.name */
  locationName?: string;
  ageMin?: number;
  ageMax?: number;
  /** Max distance in miles (Hinge preference field). */
  distanceMi?: number;
  /** Preferred gender id for prefs (0 men / 1 women) — matches Charles gendered* keys. */
  genderPreference?: HingeLiveGenderPreference;
  /** Local filter against firstName + prompt answers after hydrate. */
  keyword?: string;
  activeToday?: boolean;
  newHere?: boolean;
  /** Extra /rec/v2 pulls after the first (capped). */
  pages?: number;
};

export type HingeLivePhoto = {
  id: string;
  url: string;
  caption: string | null;
};

export type HingeLiveAnswer = {
  questionId: string | null;
  response: string | null;
};

export type HingeLiveProfileCard = {
  userId: string;
  firstName: string | null;
  age: number | null;
  location: string | null;
  hometown: string | null;
  jobTitle: string | null;
  educations: string[];
  heightCm: number | null;
  selfieVerified: boolean | null;
  answers: HingeLiveAnswer[];
  photos: HingeLivePhoto[];
};

export type HingeLiveSearchResult = {
  query: string;
  applied: {
    lat: number;
    lon: number;
    locationName: string | null;
    ageMin: number | null;
    ageMax: number | null;
    distanceMi: number | null;
    genderPreference: HingeLiveGenderPreference | null;
    keyword: string | null;
    activeToday: boolean;
    newHere: boolean;
    pages: number;
    locationUpdated: boolean;
    preferencesUpdated: boolean;
  };
  count: number;
  subjectCount: number;
  profiles: HingeLiveProfileCard[];
  warning: string | null;
  sources: string[];
};
