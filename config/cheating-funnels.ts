import {
  GENDERED_RELATIONSHIP_CAMPAIGNS,
  type RelationshipAudience,
} from "@/config/gendered-relationship-campaigns";

export type CheatingFunnelOption = {
  value: string;
  label: string;
  detail: string;
};

export type CheatingFunnelQuestion = {
  id: string;
  prompt: string;
  supportingCopy: string;
  options: readonly CheatingFunnelOption[];
};

export type CheatingFunnelDefinition = {
  campaignId: string;
  campaignSlug: string;
  audience: RelationshipAudience;
  routeSlug: string;
  hook: string;
  eyebrow: string;
  openingCopy: string;
  lookupHeading: string;
  profileImage: string;
  profileDescriptor: string;
  visualCue: string;
  visualQuestions: readonly [string, string, string];
  subjectPronoun: "he" | "she";
  objectPronoun: "him" | "her";
  possessivePronoun: "his" | "her";
  questions: readonly CheatingFunnelQuestion[];
};

type FunnelSeed = {
  campaignId: string;
  routeSlug: string;
  openingCopy: string;
  lookupHeading: string;
  triggerPrompt: string;
  triggerOptions: readonly CheatingFunnelOption[];
  visualCue: string;
  visualQuestions: readonly [string, string, string];
};

function option(value: string, label: string, detail: string) {
  return { value, label, detail } as const;
}

function sharedQuestions(
  subjectPronoun: "he" | "she",
  possessivePronoun: "his" | "her",
): readonly CheatingFunnelQuestion[] {
  const objectPronoun = subjectPronoun === "he" ? "him" : "her";

  return [
    {
      id: "frequency",
      prompt: `Has this happened more than once?`,
      supportingCopy:
        "A single odd moment and a repeated pattern can feel very different. There is no wrong answer.",
      options: [
        option("once", "This is the first time", "One moment made me pause."),
        option("few", "A few times", "I have noticed it more than once."),
        option("pattern", "It keeps happening", "It feels like a pattern now."),
        option("unsure", "I’m not sure", "I do not want to assume."),
      ],
    },
    {
      id: "duration",
      prompt: "How long has this been weighing on you?",
      supportingCopy:
        "This helps organize the report around the timeline you are trying to understand.",
      options: [
        option("tonight", "Just tonight", "This is new and immediate."),
        option("days", "A few days", "I have been thinking about it recently."),
        option("weeks", "A few weeks", "The uncertainty has been building."),
        option(
          "longer",
          "A month or longer",
          "I have carried this for a while.",
        ),
      ],
    },
    {
      id: "feeling",
      prompt: "How are you feeling right now?",
      supportingCopy:
        "You do not have to minimize how this feels. Naming it helps you slow the moment down.",
      options: [
        option("uneasy", "Uneasy", "Something feels off, but I want facts."),
        option("confused", "Confused", "The details do not seem to add up."),
        option("hurt", "Hurt", "This already feels personal."),
        option(
          "calm",
          "Trying to stay calm",
          "I want to think before I react.",
        ),
      ],
    },
    {
      id: "conversation_status",
      prompt: `Have you asked ${objectPronoun} about what you noticed?`,
      supportingCopy:
        "This helps organize the report around what you already know. You never have to confront anyone to use the search.",
      options: [
        option("not_yet", "Not yet", "I want to check the number first."),
        option(
          "clear_answer",
          "Yes—there was an explanation",
          "I want to verify the public details.",
        ),
        option(
          "changed_answer",
          "Yes—but the story changed",
          "The explanation has not stayed consistent.",
        ),
        option(
          "not_comfortable",
          "I don’t feel comfortable asking",
          "I want to understand privately first.",
        ),
      ],
    },
    {
      id: "clue_location",
      prompt: "Where did you notice the clue?",
      supportingCopy:
        "Choose the closest match. This helps Anya organize the search around where the clue appeared—not what it supposedly means.",
      options: [
        option(
          "calls_texts",
          "In calls or texts",
          "A number, notification, or saved contact stood out.",
        ),
        option(
          "social",
          "On social media",
          "A profile, follow, comment, or account stood out.",
        ),
        option(
          "snapchat",
          "On Snapchat",
          "A username, notification, or suggested account stood out.",
        ),
        option(
          "other_unsure",
          "Somewhere else—or I’m not sure",
          "I still want to check what their details connect to.",
        ),
      ],
    },
    {
      id: "secondary_clue",
      prompt: "What public clue can you add?",
      supportingCopy: `Choose the specific detail you have. If you do not have one, Anya can still begin with ${possessivePronoun} full name and phone number.`,
      options: [
        option(
          "extra_phone",
          "An unfamiliar phone number",
          "An unfamiliar number contacting them.",
        ),
        option(
          "partner_social_username",
          `Their social-media username`,
          `Search ${possessivePronoun} public account connections.`,
        ),
        option(
          "other_social_username",
          "Someone else’s social username",
          "Check an account connected to what you noticed.",
        ),
        option(
          "partner_snapchat_username",
          `Their Snapchat username`,
          `Check ${possessivePronoun} public Snapchat signals.`,
        ),
        option(
          "other_snapchat_username",
          "Someone else’s Snapchat username",
          "Check a Snapchat account connected to what you noticed.",
        ),
        option(
          "no_extra",
          "I don’t have another clue",
          "Start with their name and phone number.",
        ),
      ],
    },
  ];
}

function createFunnel(seed: FunnelSeed): CheatingFunnelDefinition {
  const campaign = GENDERED_RELATIONSHIP_CAMPAIGNS.find(
    (entry) => entry.id === seed.campaignId,
  );

  if (!campaign) {
    throw new Error(`Missing relationship campaign ${seed.campaignId}`);
  }

  const isWomenAudience = campaign.audience === "women";
  const subjectPronoun = isWomenAudience ? "he" : "she";
  const objectPronoun = isWomenAudience ? "him" : "her";
  const possessivePronoun = isWomenAudience ? "his" : "her";

  return {
    campaignId: campaign.id,
    campaignSlug: campaign.slug,
    audience: campaign.audience,
    routeSlug: seed.routeSlug,
    hook: campaign.hook,
    eyebrow: campaign.eyebrow,
    openingCopy: seed.openingCopy,
    lookupHeading: seed.lookupHeading,
    profileImage: campaign.profileImage,
    profileDescriptor: campaign.profileDescriptor,
    visualCue: seed.visualCue,
    visualQuestions: seed.visualQuestions,
    subjectPronoun,
    objectPronoun,
    possessivePronoun,
    questions: [
      {
        id: "trigger",
        prompt: seed.triggerPrompt,
        supportingCopy:
          "Choose the moment that is closest to what you noticed. Your answer stays inside this guided report.",
        options: seed.triggerOptions,
      },
      ...sharedQuestions(subjectPronoun, possessivePronoun),
    ],
  };
}

const MIDNIGHT_OPTIONS = [
  option(
    "late_texts",
    "Late-night texts",
    "Messages started arriving after midnight.",
  ),
  option(
    "new_number",
    "A new number",
    "The same unfamiliar number keeps appearing.",
  ),
  option(
    "hidden_screen",
    "The screen gets hidden",
    "The phone is turned away when it lights up.",
  ),
  option(
    "dating_alert",
    "A dating-app notification",
    "I noticed an app or alert I did not expect.",
  ),
] as const;

const SAVED_CONTACT_OPTIONS = [
  option(
    "saved_contact",
    "A contact I do not recognize",
    "The saved name is unfamiliar.",
  ),
  option(
    "name_changed",
    "The saved name changed",
    "The number appears under a different name.",
  ),
  option(
    "photo_mismatch",
    "The photo and name do not match",
    "The contact details seem inconsistent.",
  ),
  option("number_only", "There is no saved name", "Only the number appears."),
] as const;

const REPEATED_NAME_OPTIONS = [
  option(
    "notifications",
    "Notifications",
    "The same name appears on the lock screen.",
  ),
  option(
    "recent_calls",
    "Recent calls",
    "The name appears repeatedly in the call history.",
  ),
  option(
    "group_chat",
    "A group chat",
    "The same person keeps coming up in conversation.",
  ),
  option(
    "social_profile",
    "A social profile",
    "I noticed repeated public interactions.",
  ),
] as const;

const SOMEONE_ELSE_OPTIONS = [
  option(
    "more_private",
    "More private with the phone",
    "Phone habits changed recently.",
  ),
  option(
    "less_present",
    "Less present with me",
    "The relationship feels different.",
  ),
  option(
    "details_shift",
    "Details keep changing",
    "Explanations do not feel consistent.",
  ),
  option(
    "instinct",
    "I only have a feeling",
    "I want facts before assuming anything.",
  ),
] as const;

const CALLING_OPTIONS = [
  option(
    "repeat_calls",
    "Repeated calls",
    "The same number calls again and again.",
  ),
  option("late_calls", "Late-night calls", "Calls arrive at unusual hours."),
  option(
    "returned_calls",
    "Calls get returned",
    "The number is called back privately.",
  ),
  option(
    "unfamiliar_area",
    "An unfamiliar area code",
    "I do not recognize where it is from.",
  ),
] as const;

export const CHEATING_FUNNELS: readonly CheatingFunnelDefinition[] = [
  createFunnel({
    campaignId: "HER-01",
    routeSlug: "who-is-he-texting-after-midnight",
    openingCopy:
      "When a number keeps appearing late at night, start with what can actually be verified.",
    lookupHeading: "Check the number that keeps appearing after midnight.",
    triggerPrompt: "What changed around his late-night phone use?",
    triggerOptions: MIDNIGHT_OPTIONS,
    visualCue: "Unknown contact · 12:47 AM",
    visualQuestions: [
      "Could he be cheating?",
      "Or is there a simple explanation?",
      "What does the number actually connect to?",
    ],
  }),
  createFunnel({
    campaignId: "HER-02",
    routeSlug: "who-is-she-in-his-phone",
    openingCopy:
      "A saved contact name is only a label. Public identity signals can help you check whether it fits.",
    lookupHeading: "Check the number behind the saved contact.",
    triggerPrompt: "What made the contact in his phone stand out?",
    triggerOptions: SAVED_CONTACT_OPTIONS,
    visualCue: "Saved contact · identity hidden",
    visualQuestions: [
      "Does the saved name match?",
      "Could he be hiding someone?",
      "Who is really behind the number?",
    ],
  }),
  createFunnel({
    campaignId: "HER-03",
    routeSlug: "why-her-name-keeps-showing-up",
    openingCopy:
      "If the same name keeps appearing, slow the pattern down and verify the number behind it.",
    lookupHeading: "Check the number connected to the repeated name.",
    triggerPrompt: "Where does her name keep showing up?",
    triggerOptions: REPEATED_NAME_OPTIONS,
    visualCue: "Same name · 8 recent alerts",
    visualQuestions: [
      "Is she only a friend?",
      "Why does her name keep appearing?",
      "Which public profiles connect?",
    ],
  }),
  createFunnel({
    campaignId: "HER-04",
    routeSlug: "is-he-talking-to-someone-else",
    openingCopy:
      "A feeling is not proof, but wanting clarity before you react is a grounded choice.",
    lookupHeading: "Start with the number you do not recognize.",
    triggerPrompt: "What first made you feel something had changed?",
    triggerOptions: SOMEONE_ELSE_OPTIONS,
    visualCue: "Unfamiliar number · active recently",
    visualQuestions: [
      "Could he be cheating?",
      "Has something in the relationship changed?",
      "What can the number actually verify?",
    ],
  }),
  createFunnel({
    campaignId: "HER-05",
    routeSlug: "who-keeps-calling-him-back",
    openingCopy:
      "Repeated calls can feel impossible to ignore. The number is the clearest place to begin.",
    lookupHeading: "Check the unfamiliar number in his call history.",
    triggerPrompt: "What stood out about the calls to his phone?",
    triggerOptions: CALLING_OPTIONS,
    visualCue: "Repeat caller · 6 calls this week",
    visualQuestions: [
      "Why do they keep calling him?",
      "Could he be hiding a relationship?",
      "Who is behind the number?",
    ],
  }),
  createFunnel({
    campaignId: "HIM-01",
    routeSlug: "who-is-she-texting-after-midnight",
    openingCopy:
      "When a number keeps appearing late at night, start with what can actually be verified.",
    lookupHeading: "Check the number that keeps appearing after midnight.",
    triggerPrompt: "What changed around her late-night phone use?",
    triggerOptions: MIDNIGHT_OPTIONS,
    visualCue: "Unknown contact · 12:47 AM",
    visualQuestions: [
      "Could she be cheating?",
      "Or is there a simple explanation?",
      "What does the number actually connect to?",
    ],
  }),
  createFunnel({
    campaignId: "HIM-02",
    routeSlug: "who-is-he-in-her-phone",
    openingCopy:
      "A saved contact name is only a label. Public identity signals can help you check whether it fits.",
    lookupHeading: "Check the number behind the saved contact.",
    triggerPrompt: "What made the contact in her phone stand out?",
    triggerOptions: SAVED_CONTACT_OPTIONS,
    visualCue: "Saved contact · identity hidden",
    visualQuestions: [
      "Does the saved name match?",
      "Could she be hiding someone?",
      "Who is really behind the number?",
    ],
  }),
  createFunnel({
    campaignId: "HIM-03",
    routeSlug: "why-his-name-keeps-showing-up",
    openingCopy:
      "If the same name keeps appearing, slow the pattern down and verify the number behind it.",
    lookupHeading: "Check the number connected to the repeated name.",
    triggerPrompt: "Where does his name keep showing up?",
    triggerOptions: REPEATED_NAME_OPTIONS,
    visualCue: "Same name · 8 recent alerts",
    visualQuestions: [
      "Is he only a friend?",
      "Why does his name keep appearing?",
      "Which public profiles connect?",
    ],
  }),
  createFunnel({
    campaignId: "HIM-04",
    routeSlug: "is-she-talking-to-someone-else",
    openingCopy:
      "A feeling is not proof, but wanting clarity before you react is a grounded choice.",
    lookupHeading: "Start with the number you do not recognize.",
    triggerPrompt: "What first made you feel something had changed?",
    triggerOptions: SOMEONE_ELSE_OPTIONS,
    visualCue: "Unfamiliar number · active recently",
    visualQuestions: [
      "Could she be cheating?",
      "Has something in the relationship changed?",
      "What can the number actually verify?",
    ],
  }),
  createFunnel({
    campaignId: "HIM-05",
    routeSlug: "who-keeps-calling-her-back",
    openingCopy:
      "Repeated calls can feel impossible to ignore. The number is the clearest place to begin.",
    lookupHeading: "Check the unfamiliar number in her call history.",
    triggerPrompt: "What stood out about the calls to her phone?",
    triggerOptions: CALLING_OPTIONS,
    visualCue: "Repeat caller · 6 calls this week",
    visualQuestions: [
      "Why do they keep calling her?",
      "Could she be hiding a relationship?",
      "Who is behind the number?",
    ],
  }),
] as const;

export function getCheatingFunnel(
  audience: string | null | undefined,
  routeSlug: string | null | undefined,
) {
  if (!audience || !routeSlug) return null;

  return (
    CHEATING_FUNNELS.find(
      (funnel) =>
        funnel.audience === audience && funnel.routeSlug === routeSlug,
    ) ?? null
  );
}
