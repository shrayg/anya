import { buildInstagramBubbleMap } from "../lib/instagram-bubble-map";
import type { InstagramProfile, InstagramUserSummary } from "../lib/instagram-search";

const profile: InstagramProfile = {
  id: "1",
  username: "target",
  fullName: "Jordan Smith",
  biography: "VT 27 | Arlington, VA",
  followersCount: 4,
  followingCount: 4,
  postsCount: 0,
  isPrivate: false,
  isVerified: false,
};

const users: InstagramUserSummary[] = [
  {
    id: "2",
    username: "alexsmith",
    fullName: "Alex Smith",
    biography: "VT 27",
    isVerified: false,
  },
  {
    id: "3",
    username: "tayvt",
    fullName: "Taylor Morgan",
    biography: "Virginia Tech class of 2027",
    isVerified: false,
  },
  {
    id: "4",
    username: "nova_friend",
    fullName: "Casey Lee",
    biography: "based in Arlington",
    isVerified: false,
  },
];

const map = buildInstagramBubbleMap({
  profile,
  followers: users,
  following: users,
  mutuals: users,
});

console.log(
  JSON.stringify(
    {
      stats: map.stats,
      entities: map.entities.map((entity) => ({
        kind: entity.kind,
        label: entity.label,
        users: entity.usernames,
      })),
      people: map.people.map((person) => ({
        username: person.username,
        relationship: person.relationship,
        confidence: person.confidence,
        reasons: person.confidenceReasons,
        schools: person.schoolSignals,
        years: person.graduationYears,
      })),
    },
    null,
    2,
  ),
);
