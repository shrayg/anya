import type { InstagramActivityGraph } from "@/lib/instagram-activity";
import type { InstagramProfile, InstagramUserSummary } from "@/lib/instagram-search";

export type BubbleEntityKind =
  | "school"
  | "classmate"
  | "family"
  | "organization"
  | "place"
  | "close_friends"
  | "tagged_together"
  | "consistent_commenter"
  | "travel"
  | "following_cluster"
  | "other";

export type BubbleEntity = {
  id: string;
  kind: BubbleEntityKind;
  label: string;
  evidence: string[];
  userIds: string[];
  usernames: string[];
};

export type BubblePerson = {
  id: string;
  username: string;
  fullName: string;
  biography: string;
  profilePicUrl?: string;
  isVerified: boolean;
  isPrivate?: boolean;
  isMutual: boolean;
  relation: "mutual" | "following" | "follower" | "subject";
  relationship: "subject" | "likely_family" | "likely_classmate" | "close_friend" | "friend" | "org_or_place_tie" | "unknown";
  confidence: number;
  confidenceReasons: string[];
  lastName?: string;
  schoolSignals: string[];
  graduationYears: string[];
  entities: string[];
  x: number;
  y: number;
  r: number;
};

export type InstagramBubbleMap = {
  subjectId: string;
  people: BubblePerson[];
  entities: BubbleEntity[];
  insights: string[];
  stats: {
    peopleAnalyzed: number;
    biosLoaded: number;
    mutualCount: number;
    schoolCount: number;
    organizationCount: number;
    placeCount: number;
    likelyFamilyCount: number;
    likelyClassmateCount: number;
    closeFriendCount: number;
    locationCount: number;
    consistentCommenterCount: number;
  };
};

type ParsedSignals = {
  schools: string[];
  organizations: string[];
  places: string[];
  graduationYears: string[];
  lastName?: string;
};

const SCHOOL_ABBREVIATIONS: Record<string, string> = {
  vt: "Virginia Tech",
  vatech: "Virginia Tech",
  "virginia tech": "Virginia Tech",
  uva: "University of Virginia",
  vcu: "Virginia Commonwealth University",
  jmu: "James Madison University",
  gmu: "George Mason University",
  wmu: "Western Michigan University",
  msu: "Michigan State University",
  osu: "Ohio State University",
  penn: "University of Pennsylvania",
  upenn: "University of Pennsylvania",
  nyu: "New York University",
  ucla: "UCLA",
  usc: "University of Southern California",
  fsu: "Florida State University",
  uf: "University of Florida",
  uga: "University of Georgia",
  unc: "University of North Carolina",
  duke: "Duke University",
};

const SCHOOL_PATTERNS: Array<{ re: RegExp; label?: string }> = [
  { re: /\b(?:university|universidad|universität|université)\b/i },
  { re: /\b(?:college|collegiate)\b/i },
  { re: /\b(?:high\s*school|secondary\s*school|academy)\b/i },
  { re: /\b(?:alumni|alumnus|alum|class\s*of\s*\d{2,4})\b/i },
  { re: /\b(?:student\s+at|studying\s+at|grad(?:uate)?\s+of)\b/i },
  { re: /🎓/ },
  { re: /\bU\s*of\s+[A-Z][A-Za-z.'-]{2,}/ },
  { re: /\b[A-Z][A-Za-z&.\'-]{2,}\s+(?:University|College|Institute|School)\b/ },
];

const ORG_PATTERNS: Array<{ re: RegExp }> = [
  { re: /\b(?:founder|co-?founder|ceo|cto|cfo|coo|director|president)\b/i },
  { re: /\b(?:working\s+at|works?\s+at|employed\s+at|team\s+@)\b/i },
  { re: /\b(?:nonprofit|non-profit|ngo|foundation|church|ministry)\b/i },
  { re: /\b(?:inc\.|llc|ltd\.|corp\.|company|startup)\b/i },
  { re: /🏢|💼/ },
];

const PLACE_PATTERNS: Array<{ re: RegExp }> = [
  { re: /📍\s*([^\n|,/]{2,40})/ },
  { re: /\b(?:based\s+in|living\s+in|lives?\s+in|from|located\s+in)\s+([A-Z][A-Za-z .'-]{2,40})/i },
];

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/^[@#]/, "");
}

function entityId(kind: BubbleEntityKind, label: string): string {
  return `${kind}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`;
}

function extractMentions(bio: string): string[] {
  return Array.from(bio.matchAll(/@([A-Za-z0-9._]{2,30})/g)).map((m) => m[1]);
}

function extractSchoolLabels(bio: string): string[] {
  const labels = new Set<string>();

  for (const pattern of SCHOOL_PATTERNS) {
    const match = bio.match(pattern.re);
    if (!match) continue;

    if (pattern.re.source.includes("University|College")) {
      labels.add(normalizeLabel(match[0]));
      continue;
    }

    const nearby = bio
      .slice(Math.max(0, (match.index ?? 0) - 24), (match.index ?? 0) + match[0].length + 40)
      .replace(/\n/g, " ");
    const named = nearby.match(
      /([A-Z][A-Za-z&.\'-]{2,}(?:\s+[A-Z][A-Za-z&.\'-]{2,}){0,3}\s+(?:University|College|Institute|School|Academy))/,
    );
    if (named?.[1]) {
      labels.add(normalizeLabel(named[1]));
    } else if (match[0].length > 3 && !/🎓|alumni|student|studying|class of/i.test(match[0])) {
      labels.add(normalizeLabel(match[0]));
    } else {
      labels.add("School / education signal");
    }
  }

  return [...labels];
}

function extractOrgLabels(bio: string): string[] {
  const labels = new Set<string>();

  for (const pattern of ORG_PATTERNS) {
    if (!pattern.re.test(bio)) continue;
    const atMatch = bio.match(
      /(?:@|at)\s*([A-Za-z0-9&.'-]{2,}(?:\s+[A-Za-z0-9&.'-]{2,}){0,3})/i,
    );
    if (atMatch?.[1] && atMatch[1].length > 2) {
      labels.add(normalizeLabel(atMatch[1]));
    } else {
      labels.add("Organization / work signal");
    }
  }

  // Mentions are useful org/person links, but keep them short and skip fluff.
  for (const mention of extractMentions(bio).slice(0, 4)) {
    if (mention.length >= 3) labels.add(`@${mention}`);
  }

  return [...labels];
}

function extractPlaceLabels(bio: string): string[] {
  const labels = new Set<string>();

  for (const pattern of PLACE_PATTERNS) {
    const match = bio.match(pattern.re);
    if (!match) continue;
    if (match[1] && match[2]) {
      labels.add(normalizeLabel(`${match[1]}, ${match[2]}`));
    } else if (match[1]) {
      labels.add(normalizeLabel(match[1]));
    } else {
      labels.add(normalizeLabel(match[0]));
    }
  }

  return [...labels];
}

function extractGraduationYears(text: string): string[] {
  const years = new Set<string>();
  for (const match of text.matchAll(/\b(?:class\s*of\s*)?'?(\d{2}|\d{4})\b/gi)) {
    const raw = match[1];
    const numeric = Number(raw);
    const full =
      raw.length === 2
        ? numeric >= 70
          ? 1900 + numeric
          : 2000 + numeric
        : numeric;
    if (full >= 1980 && full <= 2050) {
      years.add(String(full));
    }
  }
  return [...years];
}

function canonicalSchoolLabel(raw: string): string {
  const clean = normalizeLabel(raw);
  const key = clean.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return SCHOOL_ABBREVIATIONS[key] ?? SCHOOL_ABBREVIATIONS[clean.toLowerCase()] ?? clean;
}

function extractSchoolSignals(bio: string): string[] {
  const signals = new Set(extractSchoolLabels(bio).map(canonicalSchoolLabel));

  for (const [abbr, school] of Object.entries(SCHOOL_ABBREVIATIONS)) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(bio)) {
      signals.add(school);
    }
  }

  return [...signals].filter((signal) => signal !== "School / education signal");
}

function inferLastName(fullName: string): string | undefined {
  const parts = fullName
    .replace(/[^\p{L}\s'-]/gu, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return undefined;
  const last = parts[parts.length - 1];
  if (!last || last.length < 3) return undefined;
  return last.toLowerCase();
}

function parseSignals(user: InstagramUserSummary | InstagramProfile): ParsedSignals {
  const text = [user.fullName, user.biography ?? "", "category" in user ? user.category ?? "" : ""]
    .filter(Boolean)
    .join("\n");

  return {
    schools: extractSchoolSignals(text),
    organizations: extractOrgLabels(text),
    places: extractPlaceLabels(text),
    graduationYears: extractGraduationYears(text),
    lastName: inferLastName(user.fullName),
  };
}

function sharedValues(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return left.filter((value) => rightSet.has(value.toLowerCase()));
}

function classifyRelationship(input: {
  user: InstagramUserSummary;
  isMutual: boolean;
  relation: BubblePerson["relation"];
  signals: ParsedSignals;
  subjectSignals: ParsedSignals;
  lastNameCounts: Map<string, number>;
  activityBoost?: { score: number; reasons: string[] };
}): Pick<
  BubblePerson,
  | "relationship"
  | "confidence"
  | "confidenceReasons"
  | "lastName"
  | "schoolSignals"
  | "graduationYears"
> {
  const reasons: string[] = [];
  let confidence = 0.15;
  let relationship: BubblePerson["relationship"] = "unknown";

  const sharedSchools = sharedValues(input.signals.schools, input.subjectSignals.schools);
  const sharedYears = sharedValues(
    input.signals.graduationYears,
    input.subjectSignals.graduationYears,
  );
  const sharedPlaces = sharedValues(input.signals.places, input.subjectSignals.places);
  const sharedOrgs = sharedValues(
    input.signals.organizations,
    input.subjectSignals.organizations,
  );

  if (input.isMutual) {
    confidence += 0.35;
    relationship = "close_friend";
    reasons.push("mutual follow");
  } else if (input.relation === "following") {
    confidence += 0.12;
    relationship = "friend";
    reasons.push("target follows this account");
  }

  if (
    input.signals.lastName &&
    input.subjectSignals.lastName &&
    input.signals.lastName === input.subjectSignals.lastName
  ) {
    confidence += input.isMutual ? 0.35 : 0.25;
    relationship = "likely_family";
    reasons.push(`same last name: ${input.signals.lastName}`);
  } else if (
    input.signals.lastName &&
    (input.lastNameCounts.get(input.signals.lastName) ?? 0) >= 2
  ) {
    confidence += 0.18;
    relationship = relationship === "unknown" ? "likely_family" : relationship;
    reasons.push(`last name appears in multiple connected accounts: ${input.signals.lastName}`);
  }

  if (sharedSchools.length > 0) {
    confidence += sharedYears.length > 0 ? 0.35 : 0.25;
    relationship = relationship === "likely_family" ? relationship : "likely_classmate";
    reasons.push(`shared school: ${sharedSchools.slice(0, 2).join(", ")}`);
  } else if (input.signals.schools.length > 0) {
    confidence += 0.12;
    if (relationship === "unknown" || relationship === "friend") {
      relationship = "likely_classmate";
    }
    reasons.push(`school signal: ${input.signals.schools.slice(0, 2).join(", ")}`);
  }

  if (sharedYears.length > 0) {
    confidence += 0.12;
    reasons.push(`shared graduation year: ${sharedYears.join(", ")}`);
  } else if (input.signals.graduationYears.length > 0) {
    confidence += 0.05;
    reasons.push(`graduation year signal: ${input.signals.graduationYears.join(", ")}`);
  }

  if (sharedOrgs.length > 0 || sharedPlaces.length > 0) {
    confidence += 0.16;
    if (relationship === "unknown" || relationship === "friend") {
      relationship = "org_or_place_tie";
    }
    if (sharedOrgs.length > 0) reasons.push(`shared org: ${sharedOrgs.slice(0, 2).join(", ")}`);
    if (sharedPlaces.length > 0) reasons.push(`shared place: ${sharedPlaces.slice(0, 2).join(", ")}`);
  }

  if (input.activityBoost && input.activityBoost.score > 0) {
    confidence += Math.min(0.4, input.activityBoost.score / 20);
    if (
      relationship === "unknown" ||
      relationship === "friend" ||
      (relationship === "close_friend" && input.activityBoost.score >= 6)
    ) {
      relationship = "close_friend";
    }
    reasons.push(...input.activityBoost.reasons.slice(0, 3));
  }

  return {
    relationship,
    confidence: Math.min(0.98, Number(confidence.toFixed(2))),
    confidenceReasons: reasons.slice(0, 6),
    lastName: input.signals.lastName,
    schoolSignals: input.signals.schools,
    graduationYears: input.signals.graduationYears,
  };
}

function pushEntity(
  map: Map<string, BubbleEntity>,
  kind: BubbleEntityKind,
  label: string,
  user: InstagramUserSummary,
  evidence: string,
) {
  const clean = normalizeLabel(label);
  if (!clean || clean.length < 2) return;
  const id = entityId(kind, clean);
  const existing = map.get(id);
  if (existing) {
    if (!existing.userIds.includes(user.id)) {
      existing.userIds.push(user.id);
      existing.usernames.push(user.username);
    }
    if (!existing.evidence.includes(evidence) && existing.evidence.length < 6) {
      existing.evidence.push(evidence);
    }
    return;
  }

  map.set(id, {
    id,
    kind,
    label: clean,
    evidence: [evidence],
    userIds: [user.id],
    usernames: [user.username],
  });
}

function layoutPeople(
  people: Omit<BubblePerson, "x" | "y" | "r">[],
  entities: BubbleEntity[],
): BubblePerson[] {
  const width = 960;
  const height = 640;
  const cx = width / 2;
  const cy = height / 2;

  const entityCenters = new Map<string, { x: number; y: number }>();
  const entityBuckets = new Map<BubbleEntityKind, BubbleEntity[]>();
  for (const entity of entities) {
    const list = entityBuckets.get(entity.kind) ?? [];
    list.push(entity);
    entityBuckets.set(entity.kind, list);
  }

  const kindAngles: Record<BubbleEntityKind, number> = {
    close_friends: -Math.PI / 2,
    tagged_together: -Math.PI / 2.4,
    consistent_commenter: -Math.PI / 1.7,
    school: -Math.PI / 6,
    organization: Math.PI / 6,
    place: (2 * Math.PI) / 3,
    travel: Math.PI * 0.55,
    following_cluster: Math.PI,
    other: (-2 * Math.PI) / 3,
    classmate: -Math.PI / 5,
    family: Math.PI * 0.85,
  };

  for (const [kind, list] of entityBuckets) {
    const base = kindAngles[kind] ?? 0;
    list.forEach((entity, index) => {
      const spread = (index - (list.length - 1) / 2) * 0.35;
      const angle = base + spread;
      const radius = 170 + Math.min(entity.userIds.length, 12) * 8;
      entityCenters.set(entity.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    });
  }

  return people.map((person, index) => {
    if (person.relation === "subject") {
      return { ...person, x: cx, y: cy, r: 34 };
    }

    const linked = person.entities
      .map((id) => entityCenters.get(id))
      .filter(Boolean) as Array<{ x: number; y: number }>;

    let x: number;
    let y: number;

    if (linked.length > 0) {
      x = linked.reduce((sum, point) => sum + point.x, 0) / linked.length;
      y = linked.reduce((sum, point) => sum + point.y, 0) / linked.length;
      const jitter = ((index % 7) - 3) * 12;
      x += jitter;
      y += ((index % 5) - 2) * 10;
    } else {
      const angle = (index / Math.max(people.length, 1)) * Math.PI * 2;
      const ring = person.isMutual ? 120 : 250;
      x = cx + Math.cos(angle) * ring;
      y = cy + Math.sin(angle) * ring;
    }

    const r = person.isMutual ? 18 : person.relation === "following" ? 14 : 11;
    return {
      ...person,
      x: Math.max(28, Math.min(width - 28, x)),
      y: Math.max(28, Math.min(height - 28, y)),
      r,
    };
  });
}

export function buildInstagramBubbleMap(input: {
  profile: InstagramProfile;
  followers: InstagramUserSummary[];
  following: InstagramUserSummary[];
  mutuals: InstagramUserSummary[];
  activity?: InstagramActivityGraph | null;
}): InstagramBubbleMap {
  const { profile, followers, following, mutuals, activity } = input;
  const mutualIds = new Set(mutuals.map((user) => user.id));
  const followingIds = new Set(following.map((user) => user.id));
  const subjectSignals = parseSignals(profile);

  const activityBoostById = new Map<string, { score: number; reasons: string[] }>();
  if (activity) {
    for (const candidate of activity.closeFriendCandidates) {
      activityBoostById.set(candidate.account.id, {
        score: candidate.score,
        reasons: candidate.reasons,
      });
    }
  }

  const byId = new Map<string, InstagramUserSummary>();
  for (const user of [...followers, ...following, ...mutuals]) {
    byId.set(user.id, { ...byId.get(user.id), ...user });
  }
  if (activity) {
    for (const candidate of activity.closeFriendCandidates) {
      const account = candidate.account;
      if (!byId.has(account.id) && !account.id.startsWith("mention:")) {
        byId.set(account.id, {
          id: account.id,
          username: account.username,
          fullName: account.fullName,
          profilePicUrl: account.profilePicUrl,
          isVerified: account.isVerified,
          isPrivate: account.isPrivate,
        });
      }
    }
    for (const commenter of activity.consistentCommenters) {
      const account = commenter.account;
      if (!byId.has(account.id)) {
        byId.set(account.id, {
          id: account.id,
          username: account.username,
          fullName: account.fullName,
          profilePicUrl: account.profilePicUrl,
          isVerified: account.isVerified,
          isPrivate: account.isPrivate,
        });
      }
    }
  }
  const signalsById = new Map<string, ParsedSignals>();
  const lastNameCounts = new Map<string, number>();
  for (const user of byId.values()) {
    const signals = parseSignals(user);
    signalsById.set(user.id, signals);
    if (signals.lastName) {
      lastNameCounts.set(signals.lastName, (lastNameCounts.get(signals.lastName) ?? 0) + 1);
    }
  }

  const entities = new Map<string, BubbleEntity>();
  const personEntityIds = new Map<string, string[]>();

  const closeFriends = mutuals.slice(0, 80);
  if (closeFriends.length > 0) {
    const entity: BubbleEntity = {
      id: entityId("close_friends", "Close friends / mutuals"),
      kind: "close_friends",
      label: "Close friends / mutuals",
      evidence: ["Appears in both followers and following"],
      userIds: closeFriends.map((user) => user.id),
      usernames: closeFriends.map((user) => user.username),
    };
    entities.set(entity.id, entity);
    for (const user of closeFriends) {
      personEntityIds.set(user.id, [entity.id]);
    }
  }

  if (activity) {
    for (const commenter of activity.consistentCommenters.slice(0, 20)) {
      const user =
        byId.get(commenter.account.id) ??
        ({
          id: commenter.account.id,
          username: commenter.account.username,
          fullName: commenter.account.fullName,
          profilePicUrl: commenter.account.profilePicUrl,
          isVerified: commenter.account.isVerified,
          isPrivate: commenter.account.isPrivate,
        } satisfies InstagramUserSummary);
      pushEntity(
        entities,
        "consistent_commenter",
        "Consistent commenters",
        user,
        `Commented on ${commenter.postCount} posts`,
      );
      const linked = personEntityIds.get(user.id) ?? [];
      linked.push(entityId("consistent_commenter", "Consistent commenters"));
      personEntityIds.set(user.id, [...new Set(linked)]);
    }

    for (const tagged of activity.taggedAccounts.slice(0, 20)) {
      if (tagged.score < 3) continue;
      const user =
        byId.get(tagged.account.id) ??
        ({
          id: tagged.account.id,
          username: tagged.account.username,
          fullName: tagged.account.fullName,
          profilePicUrl: tagged.account.profilePicUrl,
          isVerified: tagged.account.isVerified,
          isPrivate: tagged.account.isPrivate,
        } satisfies InstagramUserSummary);
      pushEntity(
        entities,
        "tagged_together",
        "Tagged together",
        user,
        `Tag/coauthor score ${tagged.score}`,
      );
      const linked = personEntityIds.get(user.id) ?? [];
      linked.push(entityId("tagged_together", "Tagged together"));
      personEntityIds.set(user.id, [...new Set(linked)]);
    }

    for (const visit of activity.locations.slice(0, 15)) {
      const label = visit.location.name;
      const evidence = `${visit.lastSeenIso || "unknown date"} · ${visit.visitCount} post(s)`;
      // Attach travel places to the subject for map clustering.
      pushEntity(
        entities,
        "travel",
        label,
        {
          id: profile.id,
          username: profile.username,
          fullName: profile.fullName,
          isVerified: profile.isVerified,
        },
        evidence,
      );
    }
  }

  for (const user of byId.values()) {
    const signals = signalsById.get(user.id) ?? parseSignals(user);
    const bio = (user.biography ?? "").trim();
    if (!bio) continue;

    const schoolLabels = signals.schools.length ? signals.schools : extractSchoolLabels(bio);
    const orgLabels = signals.organizations;
    const placeLabels = signals.places;
    const linked = personEntityIds.get(user.id) ?? [];

    for (const label of schoolLabels) {
      pushEntity(entities, "school", label, user, bio.slice(0, 120));
      linked.push(entityId("school", label));
      for (const year of signals.graduationYears) {
        const classLabel = `${canonicalSchoolLabel(label)} ${year}`;
        pushEntity(entities, "classmate", classLabel, user, bio.slice(0, 120));
        linked.push(entityId("classmate", classLabel));
      }
    }
    for (const label of orgLabels) {
      pushEntity(entities, "organization", label, user, bio.slice(0, 120));
      linked.push(entityId("organization", label));
    }
    for (const label of placeLabels) {
      pushEntity(entities, "place", label, user, bio.slice(0, 120));
      linked.push(entityId("place", label));
    }
    if (signals.lastName && (lastNameCounts.get(signals.lastName) ?? 0) >= 2) {
      const familyLabel = `${signals.lastName} family-name cluster`;
      pushEntity(entities, "family", familyLabel, user, user.fullName || user.username);
      linked.push(entityId("family", familyLabel));
    }

    personEntityIds.set(user.id, [...new Set(linked)]);
  }

  const peopleBase: Omit<BubblePerson, "x" | "y" | "r">[] = [
    {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      biography: profile.biography,
      profilePicUrl: profile.profilePicUrl,
      isVerified: profile.isVerified,
      isPrivate: profile.isPrivate,
      isMutual: false,
      relation: "subject",
      relationship: "subject",
      confidence: 1,
      confidenceReasons: ["target profile"],
      lastName: subjectSignals.lastName,
      schoolSignals: subjectSignals.schools,
      graduationYears: subjectSignals.graduationYears,
      entities: [],
    },
  ];

  for (const user of byId.values()) {
    if (user.id === profile.id) continue;
    const relation = mutualIds.has(user.id)
      ? "mutual"
      : followingIds.has(user.id)
        ? "following"
        : "follower";
    const signals = signalsById.get(user.id) ?? parseSignals(user);
    const classification = classifyRelationship({
      user,
      isMutual: mutualIds.has(user.id),
      relation,
      signals,
      subjectSignals,
      lastNameCounts,
      activityBoost: activityBoostById.get(user.id),
    });

    peopleBase.push({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      biography: user.biography ?? "",
      profilePicUrl: user.profilePicUrl,
      isVerified: user.isVerified,
      isPrivate: user.isPrivate,
      isMutual: mutualIds.has(user.id),
      relation,
      ...classification,
      entities: personEntityIds.get(user.id) ?? [],
    });
  }

  // Prefer denser map: subject + mutuals + activity-close + people with bios + top following
  const activityCloseIds = new Set(
    (activity?.closeFriendCandidates ?? []).slice(0, 30).map((entry) => entry.account.id),
  );
  const prioritized = [
    peopleBase[0],
    ...peopleBase.filter((p) => p.relation === "mutual"),
    ...peopleBase.filter((p) => activityCloseIds.has(p.id)),
    ...peopleBase.filter(
      (p) => p.relation !== "subject" && p.relation !== "mutual" && Boolean(p.biography),
    ),
    ...peopleBase.filter((p) => p.relation === "following" && !p.biography),
  ];

  const seen = new Set<string>();
  const selected: typeof peopleBase = [];
  for (const person of prioritized) {
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    selected.push(person);
    if (selected.length >= 90) break;
  }

  const entityList = [...entities.values()]
    .sort((a, b) => b.userIds.length - a.userIds.length)
    .slice(0, 40);

  const people = layoutPeople(selected, entityList);
  const biosLoaded = people.filter((p) => p.biography.trim().length > 0).length;

  const insights: string[] = [];
  insights.push(
    `${mutuals.length} mutual accounts (follow each other) — strongest close-friend signal in the pulled lists.`,
  );

  const schools = entityList.filter((e) => e.kind === "school");
  const classmates = entityList.filter((e) => e.kind === "classmate");
  const families = entityList.filter((e) => e.kind === "family");
  const orgs = entityList.filter((e) => e.kind === "organization");
  const places = entityList.filter((e) => e.kind === "place");
  const likelyFamilyCount = people.filter((person) => person.relationship === "likely_family").length;
  const likelyClassmateCount = people.filter((person) => person.relationship === "likely_classmate").length;
  const closeFriendCount = people.filter((person) => person.relationship === "close_friend").length;

  if (schools.length) {
    insights.push(
      `School signals: ${schools
        .slice(0, 4)
        .map((e) => e.label)
        .join(", ")}.`,
    );
  }
  if (classmates.length) {
    insights.push(
      `Classmate cohorts: ${classmates
        .slice(0, 4)
        .map((e) => e.label)
        .join(", ")}.`,
    );
  }
  if (families.length) {
    insights.push(
      `Family-name clusters: ${families
        .slice(0, 4)
        .map((e) => e.label)
        .join(", ")}.`,
    );
  }
  if (orgs.length) {
    insights.push(
      `Organization / work signals: ${orgs
        .slice(0, 4)
        .map((e) => e.label)
        .join(", ")}.`,
    );
  }
  if (places.length) {
    insights.push(
      `Place signals from bios: ${places
        .slice(0, 4)
        .map((e) => e.label)
        .join(", ")}.`,
    );
  }
  if (activity?.locations.length) {
    insights.push(
      `Geotagged visits: ${activity.locations
        .slice(0, 4)
        .map((visit) => `${visit.location.name} (${visit.lastSeenIso.slice(0, 10) || "undated"})`)
        .join(", ")}.`,
    );
  }
  if (activity?.consistentCommenters.length) {
    insights.push(
      `Consistent commenters: ${activity.consistentCommenters
        .slice(0, 4)
        .map((entry) => `@${entry.account.username}`)
        .join(", ")}.`,
    );
  }
  if (activity?.closeFriendCandidates.length) {
    insights.push(
      `Activity-based close-friend candidates: ${activity.closeFriendCandidates
        .slice(0, 4)
        .map((entry) => `@${entry.account.username}`)
        .join(", ")}.`,
    );
  }
  if (biosLoaded < 5) {
    insights.push(
      "Few bios were loaded. Run bubble-map enrichment to pull more profile bios for stronger clustering.",
    );
  }

  return {
    subjectId: profile.id,
    people,
    entities: entityList,
    insights,
    stats: {
      peopleAnalyzed: people.length,
      biosLoaded,
      mutualCount: mutuals.length,
      schoolCount: schools.length,
      organizationCount: orgs.length,
      placeCount: places.length + (activity?.locations.length ?? 0),
      likelyFamilyCount,
      likelyClassmateCount,
      closeFriendCount,
      locationCount: activity?.locations.length ?? 0,
      consistentCommenterCount: activity?.consistentCommenters.length ?? 0,
    },
  };
}
