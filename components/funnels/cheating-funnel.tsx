"use client";

import type { CheatingFunnelDefinition } from "@/config/cheating-funnels";
import type { CheatingReportPayload } from "@/lib/cheating-funnel-report-types";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Link2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./cheating-funnel.module.css";

import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import { SearchUnlockPanel } from "@/components/search-unlock-panel";
import { siteLogoSrc } from "@/config/branding";
import {
  CHEATING_REPORT_MAX_EMAILS,
  CHEATING_REPORT_UNLOCK_PRICE_USD,
} from "@/lib/cheating-funnel-offer";
import { apiFetch } from "@/lib/csrf-client";
import { sanitizePublicError } from "@/lib/public-branding";
import {
  clearSearchResume,
  readSearchResume,
  saveSearchResume,
} from "@/lib/search-resume";
import {
  formatStructuredSearchData,
  type FormattedRecord,
} from "@/lib/search-utils";

type FunnelStage =
  | "intro"
  | "questions"
  | "name"
  | "reassurance"
  | "phone"
  | "email"
  | "secondary"
  | "lookup"
  | "searching"
  | "results";

type FunnelAuth =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "authenticated"; balance: number; recoveryEmail: string };

type UnlockMeta = {
  reasons?: string[];
  creditCost?: number;
  planRequired?: string | null;
  allowCreditUnlock?: boolean;
  resultCount?: number;
};

type PhoneSearchPayload = Record<string, unknown> & {
  count?: number;
  returned?: number;
  totalMatches?: number;
  message?: string;
  error?: string;
  blurResults?: boolean;
  teaser?: boolean;
  premiumSectionsLocked?: boolean;
  vaultId?: string;
  claimToken?: string;
  unlock?: UnlockMeta;
};

type SavedFunnelContext = {
  v: 1;
  campaignId: string;
  answers: Record<string, string>;
  subjectName?: string;
  subjectEmail?: string;
  additionalEmails?: string;
  secondaryClue?: string;
  pendingSearch: boolean;
};

type SecondaryClueType =
  | "extra_phone"
  | "partner_social_username"
  | "other_social_username"
  | "partner_snapchat_username"
  | "other_snapchat_username"
  | "no_extra";

const REASSURANCE_COPY: Record<string, { title: string; body: string }> = {
  uneasy: {
    title: "You can relax. We’ll help you check this step by step.",
    body: "You do not have to figure everything out right now. We’ll help you organize what you noticed and check what public information can verify.",
  },
  confused: {
    title: "You don’t have to figure this out alone.",
    body: "Take a breath. We’ll help you sort through what you noticed and check the number one step at a time.",
  },
  hurt: {
    title: "Take a breath. We’re here to help.",
    body: "You do not need to react or decide anything right now. We’ll help you check what can be verified and keep the information organized.",
  },
  calm: {
    title: "You’re in control. We’ll take it one step at a time.",
    body: "We’ll help you check the public information carefully. You can review what comes back before deciding what it means.",
  },
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function validPhone(value: string) {
  const digits = digitsOnly(value);

  return digits.length >= 10 && digits.length <= 15;
}

function validFullName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ");

  return (
    normalized.length <= 100 &&
    parts.length >= 2 &&
    parts.every((part) => /^[\p{L}\p{M}'’.\-]+$/u.test(part))
  );
}

function formatPhoneInput(value: string) {
  const trimmed = value.replace(/[^\d+()\- .]/g, "").slice(0, 28);

  return trimmed;
}

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").slice(0, 64);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function validEmail(value: string) {
  const normalized = normalizeEmail(value);

  return (
    normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  );
}

function collectSearchEmails(subjectEmail: string, additionalEmails: string) {
  const raw = [subjectEmail, ...additionalEmails.split(/[\n,;]+/)]
    .map(normalizeEmail)
    .filter(Boolean);

  if (
    raw.length > CHEATING_REPORT_MAX_EMAILS ||
    raw.some((email) => !validEmail(email))
  ) {
    return null;
  }

  return [...new Set(raw)];
}

function maskEmail(value: string) {
  const [local = "", domain = ""] = normalizeEmail(value).split("@");

  if (!local || !domain) return "Private email";

  return `${local.slice(0, 1)}${"•".repeat(Math.min(4, Math.max(2, local.length - 1)))}@${domain}`;
}

function secondaryClueType(value: string | undefined): SecondaryClueType {
  if (
    value === "extra_phone" ||
    value === "partner_social_username" ||
    value === "other_social_username" ||
    value === "partner_snapchat_username" ||
    value === "other_snapchat_username" ||
    value === "no_extra"
  ) {
    return value;
  }

  return "no_extra";
}

function validUsername(value: string) {
  const normalized = normalizeUsername(value);

  return normalized.length >= 2 && /^[A-Za-z0-9._-]+$/.test(normalized);
}

function validSecondaryClue(
  type: SecondaryClueType,
  value: string,
  partnerPhone: string,
) {
  if (type === "no_extra") return true;

  if (type === "extra_phone") {
    return validPhone(value) && digitsOnly(value) !== digitsOnly(partnerPhone);
  }

  return validUsername(value);
}

function secondaryCluePresentation(
  type: SecondaryClueType,
  possessivePronoun: string,
) {
  if (type === "extra_phone") {
    return {
      eyebrow: "ADD THE OTHER NUMBER",
      heading: "What is the unfamiliar phone number?",
      copy: "Enter the number that contacted them or appeared in what you noticed. Anya will search it as a separate public clue.",
      label: "Other phone number",
      placeholder: "+1 555 987 6543",
      summaryLabel: "Unfamiliar phone number",
      inputMode: "tel" as const,
      type: "tel" as const,
    };
  }

  const isSnapchat =
    type === "partner_snapchat_username" || type === "other_snapchat_username";
  const isPartner =
    type === "partner_social_username" || type === "partner_snapchat_username";
  const service = isSnapchat ? "Snapchat" : "social-media";

  return {
    eyebrow: "ADD THE ACCOUNT YOU NOTICED",
    heading: `What is ${isPartner ? possessivePronoun : "the other person’s"} ${service} username?`,
    copy: `Enter the public username without a password. Anya will compare public ${service} and identity signals connected to it.`,
    label: `${isSnapchat ? "Snapchat" : "Social-media"} username`,
    placeholder: "@username",
    summaryLabel: `${isPartner ? "Partner’s" : "Other person’s"} ${isSnapchat ? "Snapchat" : "social"} username`,
    inputMode: "text" as const,
    type: "text" as const,
  };
}

function searchPlanHeading(type: SecondaryClueType, possessivePronoun: string) {
  if (type === "extra_phone") {
    return (
      "Compare " +
      possessivePronoun +
      " public signals with the unfamiliar number."
    );
  }

  if (type === "partner_social_username") {
    return (
      "Connect " + possessivePronoun + " phone and public social-media signals."
    );
  }

  if (type === "partner_snapchat_username") {
    return (
      "Connect " + possessivePronoun + " phone and public Snapchat signals."
    );
  }

  if (type === "other_social_username") {
    return (
      "Compare " +
      possessivePronoun +
      " public signals with the other person’s social account."
    );
  }

  if (type === "other_snapchat_username") {
    return (
      "Compare " +
      possessivePronoun +
      " public signals with the other person’s Snapchat."
    );
  }

  return "Check what " + possessivePronoun + " name and phone connect to.";
}

function maskPhone(value: string) {
  const digits = digitsOnly(value);

  if (digits.length < 4) return "Private number";

  return `••• ••• ${digits.slice(-4)}`;
}

function totalFromPayload(
  payload: PhoneSearchPayload,
  records: FormattedRecord[],
) {
  const candidates = [
    payload.totalMatches,
    payload.count,
    payload.returned,
    records.length,
  ].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );

  return Math.max(records.length, ...candidates);
}

/** Front-loaded curve: early steps jump more; bar stays hidden until >= 50. */
const QUESTION_PROGRESS: Record<string, number> = {
  trigger: 18,
  frequency: 32,
  duration: 52,
  feeling: 60,
  conversation_status: 72,
  clue_location: 88,
  secondary_clue: 91,
};

function progressForStage(
  stage: FunnelStage,
  questionId: string | undefined,
): number {
  if (stage === "intro") return 0;
  if (stage === "questions") {
    return questionId ? (QUESTION_PROGRESS[questionId] ?? 52) : 18;
  }
  if (stage === "name") return 44;
  if (stage === "reassurance") return 66;
  if (stage === "phone") return 78;
  if (stage === "email") return 84;
  if (stage === "secondary") return 94;
  if (stage === "lookup") return 97;
  if (stage === "searching") return 99;

  return 100;
}

export function CheatingFunnel({
  funnel,
}: {
  funnel: CheatingFunnelDefinition;
}) {
  const [stage, setStage] = useState<FunnelStage>("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [subjectName, setSubjectName] = useState("");
  const [phone, setPhone] = useState("");
  const [subjectEmail, setSubjectEmail] = useState("");
  const [additionalEmails, setAdditionalEmails] = useState("");
  const [secondaryClue, setSecondaryClue] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<FormattedRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [resultMessage, setResultMessage] = useState("");
  const [blurResults, setBlurResults] = useState(false);
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [unlockedVaultId, setUnlockedVaultId] = useState<string | null>(null);
  const [unlock, setUnlock] = useState<UnlockMeta | null>(null);
  const [auth, setAuth] = useState<FunnelAuth>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const resumeHandledRef = useRef(false);
  const contextKey = `anya:cheating-funnel:${funnel.campaignId}`;
  const returnTo = `/go/cheating/${funnel.audience}/${funnel.routeSlug}`;
  const currentQuestion = funnel.questions[questionIndex];
  const currentAnswer = currentQuestion
    ? answers[currentQuestion.id]
    : undefined;
  const progress = progressForStage(stage, currentQuestion?.id);
  const selectedSecondaryType = secondaryClueType(answers.secondary_clue);
  const secondaryPresentation = secondaryCluePresentation(
    selectedSecondaryType,
    funnel.possessivePronoun,
  );
  const secondarySummary =
    selectedSecondaryType === "no_extra"
      ? ""
      : selectedSecondaryType === "extra_phone"
        ? maskPhone(secondaryClue)
        : `@${normalizeUsername(secondaryClue)}`;
  const lookupHeading = searchPlanHeading(
    selectedSecondaryType,
    funnel.possessivePronoun,
  );
  const searchEmails = useMemo(
    () => collectSearchEmails(subjectEmail, additionalEmails) ?? [],
    [additionalEmails, subjectEmail],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [questionIndex, stage]);

  const persistContext = useCallback(
    (
      nextAnswers: Record<string, string>,
      pendingSearch: boolean,
      nextSubjectName = subjectName,
      nextSecondaryClue = secondaryClue,
      nextSubjectEmail = subjectEmail,
      nextAdditionalEmails = additionalEmails,
    ) => {
      try {
        const payload: SavedFunnelContext = {
          v: 1,
          campaignId: funnel.campaignId,
          answers: nextAnswers,
          subjectName: nextSubjectName.trim(),
          subjectEmail: normalizeEmail(nextSubjectEmail),
          additionalEmails: nextAdditionalEmails.trim(),
          secondaryClue: nextSecondaryClue.trim(),
          pendingSearch,
        };

        sessionStorage.setItem(contextKey, JSON.stringify(payload));
      } catch {
        // Private browsing and storage limits should not block the funnel.
      }
    },
    [
      additionalEmails,
      contextKey,
      funnel.campaignId,
      secondaryClue,
      subjectEmail,
      subjectName,
    ],
  );

  const applySearchPayload = useCallback((raw: unknown) => {
    const payload = (raw ?? {}) as PhoneSearchPayload;
    const nextRecords = formatStructuredSearchData(payload);

    setRecords(nextRecords);
    setTotalCount(totalFromPayload(payload, nextRecords));
    setResultMessage(
      typeof payload.message === "string" ? payload.message : "",
    );
    setBlurResults(Boolean(payload.blurResults || payload.teaser));
    setVaultId(typeof payload.vaultId === "string" ? payload.vaultId : null);
    setClaimToken(
      typeof payload.claimToken === "string" ? payload.claimToken : null,
    );
    setUnlock(payload.unlock ?? null);
    setStage("results");
    setError("");
  }, []);

  const performSearch = useCallback(
    async (
      phoneValue: string,
      opts?: {
        resumed?: boolean;
        fullName?: string;
        emails?: string[];
        secondaryType?: SecondaryClueType;
        secondaryValue?: string;
      },
    ) => {
      const fullName = (opts?.fullName ?? subjectName)
        .trim()
        .replace(/\s+/g, " ");
      const clueType =
        opts?.secondaryType ?? secondaryClueType(answers.secondary_clue);
      const clueValue = opts?.secondaryValue ?? secondaryClue;
      const emailValues =
        opts?.emails ?? collectSearchEmails(subjectEmail, additionalEmails);

      if (!validFullName(fullName)) {
        setError("Enter a first and last name for the public search.");
        setStage("name");

        return;
      }

      if (!validPhone(phoneValue)) {
        setError("Enter your partner’s phone number with 10 to 15 digits.");
        setStage("lookup");

        return;
      }

      if (!emailValues) {
        setError(
          `Enter valid email addresses, with no more than ${CHEATING_REPORT_MAX_EMAILS} total.`,
        );
        setStage("email");

        return;
      }

      if (!validSecondaryClue(clueType, clueValue, phoneValue)) {
        setError(
          clueType === "extra_phone"
            ? "Enter a different phone number with 10 to 15 digits."
            : "Enter a valid public username.",
        );
        setStage("secondary");

        return;
      }

      setError("");
      setResultMessage("");
      setStage("searching");

      try {
        const response = await apiFetch("/api/funnels/cheating/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phoneValue,
            fullName,
            emails: emailValues,
            secondaryType: clueType,
            secondaryValue:
              clueType === "no_extra"
                ? ""
                : clueType === "extra_phone"
                  ? clueValue
                  : normalizeUsername(clueValue),
          }),
        });
        const data = (await response
          .json()
          .catch(() => ({}))) as PhoneSearchPayload;

        if (!response.ok) {
          setError(
            sanitizePublicError(
              data.error,
              "The search could not be completed. Please try again.",
            ),
          );
          setStage("lookup");

          return;
        }

        setPhone(phoneValue);
        applySearchPayload(data);
        persistContext(answers, true, fullName, clueValue);

        if (data.vaultId && data.claimToken) {
          saveSearchResume({
            vaultId: data.vaultId,
            claimToken: data.claimToken,
            mode: "phone",
            query: phoneValue,
            moduleSlug: "phone",
            blurReason: auth.status === "guest" ? "guest" : "free",
          });
        } else if (!opts?.resumed) {
          clearSearchResume();
        }
      } catch {
        setError("The search could not be completed. Please try again.");
        setStage("lookup");
      }
    },
    [
      answers,
      applySearchPayload,
      auth.status,
      persistContext,
      additionalEmails,
      secondaryClue,
      subjectEmail,
      subjectName,
    ],
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(contextKey);

      if (raw) {
        const saved = JSON.parse(raw) as SavedFunnelContext;

        if (
          saved?.v === 1 &&
          saved.campaignId === funnel.campaignId &&
          saved.answers &&
          typeof saved.answers === "object"
        ) {
          setAnswers(saved.answers);
          if (typeof saved.subjectName === "string") {
            setSubjectName(saved.subjectName);
          }
          if (typeof saved.subjectEmail === "string") {
            setSubjectEmail(saved.subjectEmail);
          }
          if (typeof saved.additionalEmails === "string") {
            setAdditionalEmails(saved.additionalEmails);
          }
          if (typeof saved.secondaryClue === "string") {
            setSecondaryClue(saved.secondaryClue);
          }
        }
      }
    } catch {
      // Ignore invalid or unavailable session storage.
    }
  }, [contextKey, funnel.campaignId]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data?.authenticated) {
          setAuth({ status: "guest" });

          return;
        }

        setAuth({
          status: "authenticated",
          balance:
            typeof data.user?.balance === "number" ? data.user.balance : 0,
          recoveryEmail:
            typeof data.user?.recoveryEmail === "string"
              ? data.user.recoveryEmail
              : "",
        });
        if (typeof data.user?.recoveryEmail === "string") {
          setEmail(data.user.recoveryEmail);
        }
      })
      .catch(() => setAuth({ status: "guest" }));
  }, []);

  useEffect(() => {
    if (auth.status === "loading" || resumeHandledRef.current) return;

    let cancelled = false;

    let saved: SavedFunnelContext | null = null;

    try {
      const raw = sessionStorage.getItem(contextKey);

      saved = raw ? (JSON.parse(raw) as SavedFunnelContext) : null;
    } catch {
      saved = null;
    }

    if (
      saved?.v !== 1 ||
      saved.campaignId !== funnel.campaignId ||
      !saved.pendingSearch
    ) {
      resumeHandledRef.current = true;

      return;
    }

    const resume = readSearchResume();

    if (!resume || resume.moduleSlug !== "phone" || !resume.query) {
      resumeHandledRef.current = true;

      return;
    }

    resumeHandledRef.current = true;
    setPhone(resume.query);

    if (auth.status !== "authenticated") {
      setStage("lookup");

      return;
    }

    setStage("searching");

    void (async () => {
      const billingState = new URLSearchParams(window.location.search).get(
        "billing",
      );
      const returnedFromCheckout =
        billingState === "pending" || billingState === "success";
      const maxAttempts = returnedFromCheckout ? 20 : 1;

      // Never preferCreditUnlock on resume. Paid unlocks claim the vault via
      // webhook; credit unlocks only happen when the user clicks the button.
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) return;

        try {
          const metaRes = await fetch(
            `/api/search/vault/${encodeURIComponent(resume.vaultId)}/meta`,
            { cache: "no-store", credentials: "include" },
          );
          const meta = await metaRes.json().catch(() => ({}));

          if (metaRes.ok && meta.claimed) {
            const claimRes = await apiFetch("/api/search/vault/claim", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                vaultId: resume.vaultId,
                claimToken: resume.claimToken,
                preferCreditUnlock: false,
              }),
            });
            const claimData = await claimRes.json().catch(() => ({}));

            if (claimRes.ok && claimData.payload) {
              applySearchPayload(claimData.payload);
              setBlurResults(false);
              setUnlockedVaultId(resume.vaultId);
              setVaultId(null);
              setClaimToken(null);
              setUnlock(null);
              clearSearchResume();

              return;
            }
          } else if (!returnedFromCheckout) {
            break;
          }
        } catch {
          if (!returnedFromCheckout) break;
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }

      if (cancelled) return;

      if (returnedFromCheckout) {
        setError(
          "Your payment is still being confirmed. Your report is safe—check again in a moment.",
        );
        setStage("results");
        setBlurResults(true);
        setVaultId(resume.vaultId);
        setClaimToken(resume.claimToken);

        return;
      }

      await performSearch(resume.query!, {
        resumed: true,
        fullName: saved.subjectName,
        emails:
          collectSearchEmails(
            saved.subjectEmail ?? "",
            saved.additionalEmails ?? "",
          ) ?? [],
        secondaryType: secondaryClueType(saved.answers.secondary_clue),
        secondaryValue: saved.secondaryClue,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applySearchPayload,
    auth.status,
    contextKey,
    funnel.campaignId,
    performSearch,
  ]);

  const answerCurrentQuestion = (value: string) => {
    if (!currentQuestion) return;

    const nextAnswers = { ...answers, [currentQuestion.id]: value };

    if (currentQuestion.id === "secondary_clue" && value !== currentAnswer) {
      setSecondaryClue("");
    }
    setAnswers(nextAnswers);
    persistContext(
      nextAnswers,
      false,
      subjectName,
      currentQuestion.id === "secondary_clue" && value !== currentAnswer
        ? ""
        : secondaryClue,
    );
  };

  const advanceQuestion = () => {
    if (!currentQuestion || !currentAnswer) return;

    if (currentQuestion.id === "frequency") {
      setStage("name");

      return;
    }

    if (currentQuestion.id === "feeling") {
      setStage("reassurance");

      return;
    }

    if (currentQuestion.id === "conversation_status") {
      setStage("phone");

      return;
    }

    if (questionIndex >= funnel.questions.length - 1) {
      setError("");
      setStage(
        secondaryClueType(currentAnswer) === "no_extra"
          ? "lookup"
          : "secondary",
      );

      return;
    }

    setQuestionIndex((index) => index + 1);
  };

  const goBack = () => {
    setError("");

    if (stage === "questions") {
      if (questionIndex === 0) {
        setStage("intro");
      } else if (currentQuestion?.id === "duration") {
        setStage("name");
      } else if (currentQuestion?.id === "conversation_status") {
        setStage("reassurance");
      } else if (currentQuestion?.id === "clue_location") {
        setStage("email");
      } else {
        setQuestionIndex((index) => index - 1);
      }

      return;
    }

    if (stage === "name") {
      const frequencyIndex = funnel.questions.findIndex(
        (question) => question.id === "frequency",
      );

      setQuestionIndex(Math.max(0, frequencyIndex));
      setStage("questions");

      return;
    }

    if (stage === "reassurance") {
      const feelingIndex = funnel.questions.findIndex(
        (question) => question.id === "feeling",
      );

      setQuestionIndex(Math.max(0, feelingIndex));
      setStage("questions");

      return;
    }

    if (stage === "phone") {
      const conversationIndex = funnel.questions.findIndex(
        (question) => question.id === "conversation_status",
      );

      setQuestionIndex(Math.max(0, conversationIndex));
      setStage("questions");

      return;
    }

    if (stage === "email") {
      setStage("phone");

      return;
    }

    if (stage === "secondary") {
      setQuestionIndex(funnel.questions.length - 1);
      setStage("questions");

      return;
    }

    if (stage === "lookup") {
      setQuestionIndex(funnel.questions.length - 1);
      setStage(
        selectedSecondaryType === "no_extra" ? "questions" : "secondary",
      );
    }
  };

  const continueAfterName = () => {
    const nextName = subjectName.trim().replace(/\s+/g, " ");

    if (!validFullName(nextName)) {
      setError("Enter a first and last name for the public search.");

      return;
    }

    const frequencyIndex = funnel.questions.findIndex(
      (question) => question.id === "frequency",
    );

    setSubjectName(nextName);
    setError("");
    persistContext(answers, false, nextName);
    setQuestionIndex(Math.min(funnel.questions.length - 1, frequencyIndex + 1));
    setStage("questions");
  };

  const continueAfterReassurance = () => {
    const feelingIndex = funnel.questions.findIndex(
      (question) => question.id === "feeling",
    );

    setQuestionIndex(Math.min(funnel.questions.length - 1, feelingIndex + 1));
    setStage("questions");
  };

  const continueAfterPhone = () => {
    if (!validPhone(phone)) return;

    setError("");
    setStage("email");
  };

  const continueAfterEmail = () => {
    const nextEmails = collectSearchEmails(subjectEmail, additionalEmails);

    if (!nextEmails) {
      setError(
        `Enter valid email addresses, with no more than ${CHEATING_REPORT_MAX_EMAILS} total.`,
      );

      return;
    }

    const conversationIndex = funnel.questions.findIndex(
      (question) => question.id === "conversation_status",
    );

    setQuestionIndex(
      Math.min(funnel.questions.length - 1, conversationIndex + 1),
    );
    setSubjectEmail(normalizeEmail(subjectEmail));
    setAdditionalEmails(
      nextEmails
        .filter((email) => email !== normalizeEmail(subjectEmail))
        .join("\n"),
    );
    setError("");
    persistContext(
      answers,
      false,
      subjectName,
      secondaryClue,
      subjectEmail,
      nextEmails
        .filter((email) => email !== normalizeEmail(subjectEmail))
        .join("\n"),
    );
    setStage("questions");
  };

  const continueAfterSecondary = () => {
    if (!validSecondaryClue(selectedSecondaryType, secondaryClue, phone)) {
      setError(
        selectedSecondaryType === "extra_phone"
          ? digitsOnly(secondaryClue) === digitsOnly(phone)
            ? "Use the unfamiliar number here, not your partner’s number again."
            : "Enter a phone number with 10 to 15 digits."
          : "Enter a valid public username using letters, numbers, dots, dashes, or underscores.",
      );

      return;
    }

    const nextClue =
      selectedSecondaryType === "extra_phone"
        ? secondaryClue
        : normalizeUsername(secondaryClue);

    setSecondaryClue(nextClue);
    setError("");
    persistContext(answers, false, subjectName, nextClue);
    setStage("lookup");
  };

  const selectedAnswers = useMemo(
    () =>
      funnel.questions.flatMap((question) => {
        const value = answers[question.id];
        const selected = question.options.find(
          (entry) => entry.value === value,
        );

        return selected
          ? [{ question: question.prompt, answer: selected.label }]
          : [];
      }),
    [answers, funnel.questions],
  );

  const reportPayload = useMemo<CheatingReportPayload>(
    () => ({
      campaignId: funnel.campaignId,
      audience: funnel.audience,
      hook: funnel.hook,
      searchedPhone: maskPhone(phone),
      generatedAt: new Date().toISOString(),
      answers: subjectName
        ? [
            {
              question: "Person in this private check",
              answer: subjectName,
            },
            ...(searchEmails.length > 0
              ? [
                  {
                    question: "Email addresses included in the search",
                    answer: searchEmails.map(maskEmail).join(", "),
                  },
                ]
              : []),
            ...(secondarySummary
              ? [
                  {
                    question: secondaryPresentation.summaryLabel,
                    answer: secondarySummary,
                  },
                ]
              : []),
            ...selectedAnswers,
          ]
        : selectedAnswers,
      records: records.map((record) => ({
        title: record.title,
        subtitle: record.subtitle,
        badge: record.badge,
        fields: record.fields.map((field) => ({
          label: field.label,
          value: field.value,
          group: field.group,
        })),
      })),
      totalCount,
      vaultId: unlockedVaultId ?? undefined,
    }),
    [
      funnel.audience,
      funnel.campaignId,
      funnel.hook,
      phone,
      records,
      searchEmails,
      secondaryPresentation.summaryLabel,
      secondarySummary,
      selectedAnswers,
      subjectName,
      totalCount,
      unlockedVaultId,
    ],
  );

  const canExport =
    stage === "results" && !blurResults && auth.status === "authenticated";

  const downloadPdf = async () => {
    if (!canExport) return;

    setPdfBusy(true);
    setError("");

    try {
      const response = await apiFetch("/api/funnels/cheating/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        setError(
          typeof data.error === "string"
            ? data.error
            : "The PDF could not be generated.",
        );

        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `anya-public-connection-${funnel.campaignId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("The PDF could not be generated.");
    } finally {
      setPdfBusy(false);
    }
  };

  const emailReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canExport) return;

    setEmailBusy(true);
    setEmailStatus("");

    try {
      const response = await apiFetch("/api/funnels/cheating/report/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, report: reportPayload }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setEmailStatus(
          typeof data.error === "string"
            ? data.error
            : "The report could not be emailed.",
        );

        return;
      }

      setEmailStatus("Sent. Check your inbox for the private PDF report.");
    } catch {
      setEmailStatus(
        "The report could not be emailed. Download the PDF instead.",
      );
    } finally {
      setEmailBusy(false);
    }
  };

  const handleUnlocked = (payload: unknown) => {
    const priorVaultId = vaultId;

    applySearchPayload(payload);
    setBlurResults(false);
    if (priorVaultId) setUnlockedVaultId(priorVaultId);
    setVaultId(null);
    setClaimToken(null);
    setUnlock(null);
    clearSearchResume();
    persistContext(answers, false);
  };

  const reassurance =
    REASSURANCE_COPY[answers.feeling] ?? REASSURANCE_COPY.calm!;

  return (
    <main className={styles.page}>
      <div aria-hidden className={styles.ambient} />
      <header className={styles.header}>
        <div className={styles.brand}>
          <Image
            priority
            alt="Anya"
            className={styles.logo}
            height={40}
            src={siteLogoSrc}
            width={40}
          />
          <div>
            <strong>Anya</strong>
            <span>Private clarity check</span>
          </div>
        </div>
        <div className={styles.privateBadge}>
          <LockKeyhole aria-hidden />
          Your answers stay private
        </div>
      </header>

      {progress >= 50 ? (
        <div aria-label="Funnel progress" className={styles.progressShell}>
          <div className={styles.progressMeta}>
            <span>{funnel.campaignId}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressValue}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      <section aria-live="polite" className={styles.shell}>
        {stage === "intro" ? (
          <div className={`${styles.panel} ${styles.introPanel}`}>
            <div className={styles.copyColumn}>
              <p className={styles.eyebrow}>{funnel.eyebrow}</p>
              <h1>{funnel.hook}</h1>
              <p className={styles.lead}>{funnel.openingCopy}</p>
              <div className={styles.truthNote}>
                <ShieldCheck aria-hidden />
                <p>
                  Anya uses its own proprietary advanced search technology to
                  surface and connect public identity, profile, and source
                  signals. It does not access a phone, private messages, or live
                  conversations.
                </p>
              </div>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => setStage("questions")}
              >
                Start my private check
                <ArrowRight aria-hidden />
              </button>
              <p className={styles.microcopy}>
                About 2 minutes before the public-source search.
              </p>
            </div>

            <div aria-hidden className={styles.storyVisual}>
              <div className={styles.portraitAura} />
              <div className={styles.portraitFrame}>
                <Image
                  fill
                  priority
                  alt=""
                  className={styles.portraitImage}
                  sizes="(max-width: 820px) 88vw, 42vw"
                  src={funnel.profileImage}
                />
                <div className={styles.portraitTone} />
              </div>

              <div className={styles.scenarioSignal}>
                <MessageCircle />
                <span>
                  <small>Fictional scenario</small>
                  <strong>{funnel.visualCue}</strong>
                </span>
              </div>

              <div className={styles.questionStack}>
                {funnel.visualQuestions.map((question, index) => (
                  <p key={question}>
                    <span>0{index + 1}</span>
                    {question}
                  </p>
                ))}
              </div>

              <div className={styles.visualFooter}>
                <span>Public signals only</span>
                <span>Names · profiles · sources</span>
              </div>
            </div>
          </div>
        ) : null}

        {stage === "questions" && currentQuestion ? (
          <div className={`${styles.panel} ${styles.questionPanel}`}>
            <button
              className={styles.backButton}
              type="button"
              onClick={goBack}
            >
              <ArrowLeft aria-hidden />
              Back
            </button>
            <div className={styles.questionCount}>
              Question {questionIndex + 1} of {funnel.questions.length}
            </div>
            <h2>{currentQuestion.prompt}</h2>
            <p className={styles.questionSupport}>
              {currentQuestion.supportingCopy}
            </p>
            <div className={styles.optionGrid}>
              {currentQuestion.options.map((entry) => {
                const selected = currentAnswer === entry.value;

                return (
                  <button
                    key={entry.value}
                    aria-pressed={selected}
                    className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                    type="button"
                    onClick={() => answerCurrentQuestion(entry.value)}
                  >
                    <span className={styles.optionCheck}>
                      {selected ? <Check aria-hidden /> : null}
                    </span>
                    <span>
                      <strong>{entry.label}</strong>
                      <small>{entry.detail}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              className={styles.primaryButton}
              disabled={!currentAnswer}
              type="button"
              onClick={advanceQuestion}
            >
              Continue
              <ArrowRight aria-hidden />
            </button>
          </div>
        ) : null}

        {stage === "name" ? (
          <div className={`${styles.panel} ${styles.infoPanel}`}>
            <button
              className={styles.backButton}
              type="button"
              onClick={goBack}
            >
              <ArrowLeft aria-hidden />
              Back
            </button>
            <div className={styles.infoCount}>Core detail 1 of 3</div>
            <p className={styles.eyebrow}>ADD A SECOND SEARCH SIGNAL</p>
            <h2>What is {funnel.possessivePronoun} full name?</h2>
            <p className={styles.questionSupport}>
              Enter the full name you know. Anya will search it together with
              the phone number to find stronger public matches.
            </p>
            <form
              className={styles.phoneForm}
              onSubmit={(event) => {
                event.preventDefault();
                continueAfterName();
              }}
            >
              <label
                className={styles.fieldLabel}
                htmlFor="funnel-subject-name"
              >
                Full name
              </label>
              <div className={styles.phoneInputWrap}>
                <UserRoundSearch aria-hidden />
                <input
                  autoComplete="off"
                  id="funnel-subject-name"
                  maxLength={100}
                  placeholder={
                    funnel.subjectPronoun === "he"
                      ? "e.g. Daniel Carter"
                      : "e.g. Sarah Mitchell"
                  }
                  type="text"
                  value={subjectName}
                  onChange={(event) => {
                    setSubjectName(event.target.value);
                    setError("");
                  }}
                />
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button
                className={styles.primaryButton}
                disabled={!validFullName(subjectName)}
                type="submit"
              >
                Continue
                <ArrowRight aria-hidden />
              </button>
            </form>
            <p className={styles.limitNote}>
              The full name stays inside your private Anya search and report.
            </p>
          </div>
        ) : null}

        {stage === "reassurance" ? (
          <div className={`${styles.panel} ${styles.reassurancePanel}`}>
            <button
              className={styles.backButton}
              type="button"
              onClick={goBack}
            >
              <ArrowLeft aria-hidden />
              Back
            </button>
            <p className={styles.eyebrow}>TAKE A BREATH</p>
            <h2>{reassurance.title}</h2>
            <p>{reassurance.body}</p>
            <div className={styles.reassuranceQuote}>
              “You can slow down. We’ll help you check what can actually be
              verified.”
            </div>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={continueAfterReassurance}
            >
              Keep going
              <ArrowRight aria-hidden />
            </button>
          </div>
        ) : null}

        {stage === "phone" ? (
          <div className={`${styles.panel} ${styles.infoPanel}`}>
            <button
              className={styles.backButton}
              type="button"
              onClick={goBack}
            >
              <ArrowLeft aria-hidden />
              Back
            </button>
            <div className={styles.infoCount}>Core detail 2 of 3</div>
            <p className={styles.eyebrow}>ADD THEIR PHONE NUMBER</p>
            <h2>What is {funnel.possessivePronoun} phone number?</h2>
            <p className={styles.questionSupport}>
              Enter your partner’s own phone number. Anya will search it with
              the full name you provided, then add any optional clue you share.
            </p>
            <form
              className={styles.phoneForm}
              onSubmit={(event) => {
                event.preventDefault();
                continueAfterPhone();
              }}
            >
              <label
                className={styles.fieldLabel}
                htmlFor="cheating-funnel-phone"
              >
                Partner’s phone number
              </label>
              <div className={styles.phoneInputWrap}>
                <Phone aria-hidden />
                <input
                  autoComplete="tel"
                  id="cheating-funnel-phone"
                  inputMode="tel"
                  placeholder="+1 555 123 4567"
                  type="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(formatPhoneInput(event.target.value));
                    setError("");
                  }}
                />
              </div>
              <button
                className={styles.primaryButton}
                disabled={!validPhone(phone)}
                type="submit"
              >
                Continue
                <ArrowRight aria-hidden />
              </button>
            </form>
            <p className={styles.limitNote}>
              The number stays inside Anya. It is never added to the ad URL or
              Meta campaign parameters.
            </p>
          </div>
        ) : null}

        {stage === "email" ? (
          <div className={`${styles.panel} ${styles.infoPanel}`}>
            <button
              className={styles.backButton}
              type="button"
              onClick={goBack}
            >
              <ArrowLeft aria-hidden />
              Back
            </button>
            <div className={styles.infoCount}>Core detail 3 of 3</div>
            <p className={styles.eyebrow}>ADD KNOWN EMAILS</p>
            <h2>What email addresses should Anya check?</h2>
            <p className={styles.questionSupport}>
              Add {funnel.possessivePronoun} known email and any other email
              connected to what you noticed. You can leave these blank if you do
              not know them.
            </p>
            <form
              className={styles.phoneForm}
              onSubmit={(event) => {
                event.preventDefault();
                continueAfterEmail();
              }}
            >
              <label className={styles.fieldLabel} htmlFor="partner-email">
                Their primary email
              </label>
              <div className={styles.phoneInputWrap}>
                <Mail aria-hidden />
                <input
                  autoComplete="off"
                  id="partner-email"
                  inputMode="email"
                  maxLength={254}
                  placeholder="name@example.com"
                  type="email"
                  value={subjectEmail}
                  onChange={(event) => {
                    setSubjectEmail(event.target.value.slice(0, 254));
                    setError("");
                  }}
                />
              </div>

              <label className={styles.fieldLabel} htmlFor="additional-emails">
                Other emails to search · optional
              </label>
              <div className={styles.emailTextareaWrap}>
                <Mail aria-hidden />
                <textarea
                  id="additional-emails"
                  placeholder={"another@example.com\none.more@example.com"}
                  rows={3}
                  value={additionalEmails}
                  onChange={(event) => {
                    setAdditionalEmails(event.target.value.slice(0, 1300));
                    setError("");
                  }}
                />
              </div>
              <p className={styles.fieldHelp}>
                Up to {CHEATING_REPORT_MAX_EMAILS} total · one per line
              </p>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button className={styles.primaryButton} type="submit">
                Continue
                <ArrowRight aria-hidden />
              </button>
            </form>
            <p className={styles.limitNote}>
              Emails stay inside the private search and are never added to ad
              URLs or Meta campaign parameters.
            </p>
          </div>
        ) : null}

        {stage === "secondary" && selectedSecondaryType !== "no_extra" ? (
          <div className={`${styles.panel} ${styles.infoPanel}`}>
            <button
              className={styles.backButton}
              type="button"
              onClick={goBack}
            >
              <ArrowLeft aria-hidden />
              Back
            </button>
            <div className={styles.infoCount}>Optional additional clue</div>
            <p className={styles.eyebrow}>{secondaryPresentation.eyebrow}</p>
            <h2>{secondaryPresentation.heading}</h2>
            <p className={styles.questionSupport}>
              {secondaryPresentation.copy}
            </p>
            <form
              className={styles.phoneForm}
              onSubmit={(event) => {
                event.preventDefault();
                continueAfterSecondary();
              }}
            >
              <label
                className={styles.fieldLabel}
                htmlFor="cheating-funnel-secondary"
              >
                {secondaryPresentation.label}
              </label>
              <div className={styles.phoneInputWrap}>
                {selectedSecondaryType === "extra_phone" ? (
                  <Phone aria-hidden />
                ) : (
                  <UserRoundSearch aria-hidden />
                )}
                <input
                  autoComplete="off"
                  id="cheating-funnel-secondary"
                  inputMode={secondaryPresentation.inputMode}
                  maxLength={64}
                  placeholder={secondaryPresentation.placeholder}
                  type={secondaryPresentation.type}
                  value={secondaryClue}
                  onChange={(event) => {
                    setSecondaryClue(
                      selectedSecondaryType === "extra_phone"
                        ? formatPhoneInput(event.target.value)
                        : event.target.value.slice(0, 64),
                    );
                    setError("");
                  }}
                />
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button
                className={styles.primaryButton}
                disabled={
                  !validSecondaryClue(
                    selectedSecondaryType,
                    secondaryClue,
                    phone,
                  )
                }
                type="submit"
              >
                Add this clue
                <ArrowRight aria-hidden />
              </button>
            </form>
            <p className={styles.limitNote}>
              This clue stays inside the private Anya search. Never enter a
              password or private account credential.
            </p>
          </div>
        ) : null}

        {stage === "lookup" ? (
          <div className={`${styles.panel} ${styles.lookupPanel}`}>
            <button
              className={styles.backButton}
              type="button"
              onClick={goBack}
            >
              <ArrowLeft aria-hidden />
              Back
            </button>
            <p className={styles.eyebrow}>YOUR SEARCH PLAN IS READY</p>
            <h2>{lookupHeading}</h2>
            <p className={styles.questionSupport}>
              Your partner’s full name, phone number, and any known emails
              anchor this search.
              {secondarySummary
                ? " The additional clue will be searched and merged into the same private report."
                : " Anya will merge every completed public-source check into one private report."}{" "}
              None of these details are added to the ad URL or Meta campaign
              parameters.
            </p>

            <div className={styles.searchSubjectCard}>
              <span>
                <small>PARTNER SEARCH</small>
                <strong>
                  {subjectName || `The person you’re checking`} ·{" "}
                  {maskPhone(phone)}
                </strong>
              </span>
              <CheckCircle2 aria-hidden />
            </div>

            {searchEmails.length > 0 ? (
              <div className={styles.searchSubjectCard}>
                <span>
                  <small>
                    {searchEmails.length === 1
                      ? "EMAIL TO SEARCH"
                      : `${searchEmails.length} EMAILS TO SEARCH`}
                  </small>
                  <strong>{searchEmails.map(maskEmail).join(" · ")}</strong>
                </span>
                <CheckCircle2 aria-hidden />
              </div>
            ) : null}

            {secondarySummary ? (
              <div className={styles.searchSubjectCard}>
                <span>
                  <small>{secondaryPresentation.summaryLabel}</small>
                  <strong>{secondarySummary}</strong>
                </span>
                <CheckCircle2 aria-hidden />
              </div>
            ) : null}

            <div className={styles.planGrid}>
              <div>
                <UserRoundSearch aria-hidden />
                <span>
                  <strong>Identity signals</strong>
                  <small>Names and public identifiers</small>
                </span>
              </div>
              <div>
                <Link2 aria-hidden />
                <span>
                  <strong>Connected profiles</strong>
                  <small>Public handles and accounts</small>
                </span>
              </div>
              <div>
                <FileText aria-hidden />
                <span>
                  <strong>Source trail</strong>
                  <small>Records you can review</small>
                </span>
              </div>
            </div>

            <form
              className={styles.phoneForm}
              onSubmit={(event) => {
                event.preventDefault();
                persistContext(answers, true);
                void performSearch(phone);
              }}
            >
              <label className={styles.consentRow}>
                <input
                  checked={consent}
                  type="checkbox"
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  I am checking an adult for a lawful personal purpose and will
                  use public information responsibly.
                </span>
              </label>
              {error ? <p className={styles.error}>{error}</p> : null}
              <button
                className={styles.primaryButton}
                disabled={
                  !validPhone(phone) ||
                  !validSecondaryClue(
                    selectedSecondaryType,
                    secondaryClue,
                    phone,
                  ) ||
                  !consent
                }
                type="submit"
              >
                Run my private search
                <Search aria-hidden />
              </button>
            </form>

            <p className={styles.limitNote}>
              Public data only. No private-message or device access. Results may
              be incomplete and do not prove a relationship.
            </p>
          </div>
        ) : null}

        {stage === "searching" ? (
          <div className={`${styles.panel} ${styles.searchingPanel}`}>
            <div aria-hidden className={styles.scanner}>
              <Search />
              <span />
            </div>
            <p className={styles.eyebrow}>CHECKING PUBLIC SOURCES</p>
            <h2>Building your source trail…</h2>
            <p>
              Anya is checking public identity signals connected to{" "}
              {subjectName} and the number ending in{" "}
              {digitsOnly(phone).slice(-4)}
              {searchEmails.length > 0
                ? `, ${searchEmails.length} email${searchEmails.length === 1 ? "" : "s"}`
                : ""}
              {secondarySummary
                ? ", plus the additional clue you provided"
                : ""}
              .
            </p>
            <div className={styles.searchChecklist}>
              <span>
                <CheckCircle2 aria-hidden /> Full-name identity records
              </span>
              <span>
                <CheckCircle2 aria-hidden /> Phone and email-linked signals
              </span>
              <span>
                <CheckCircle2 aria-hidden />{" "}
                {secondarySummary
                  ? "Additional clue connections"
                  : "Source references"}
              </span>
            </div>
            {error ? (
              <div className={styles.paymentPendingNotice}>
                <p>{error}</p>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Check payment again
                  <ArrowRight aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {stage === "results" ? (
          <div
            className={`${styles.panel} ${styles.resultsPanel} ${blurResults ? styles.resultsPanelLocked : ""}`}
          >
            <div className={styles.resultsHeader}>
              <div>
                <p className={styles.eyebrow}>YOUR PUBLIC-SOURCE REPORT</p>
                <h1>
                  {blurResults
                    ? "Your private report is ready."
                    : totalCount > 0
                      ? `${totalCount.toLocaleString()} public signal${totalCount === 1 ? "" : "s"} found.`
                      : "No public matches found."}
                </h1>
                <p>
                  {blurResults
                    ? `The search for ${subjectName} is complete. Everything it returned is organized and ready to review.`
                    : `Full results for ${subjectName} are available below.`}
                </p>
              </div>
              {!blurResults ? (
                <div className={styles.resultStatus}>
                  <ShieldCheck aria-hidden />
                  Full report ready
                </div>
              ) : null}
            </div>

            {!blurResults ? (
              <div className={styles.contextSummary}>
                <div>
                  <span>SEARCHED</span>
                  <strong>Name · phone · email · public accounts</strong>
                </div>
                <div>
                  <span>REPORT</span>
                  <strong>{totalCount.toLocaleString()} public signals</strong>
                </div>
              </div>
            ) : null}

            {!blurResults ? (
              <div className={styles.resultBoundary}>
                <ShieldCheck aria-hidden />
                <p>
                  <strong>Public-source results:</strong> these records can show
                  public identity and account connections. They cannot show
                  private messages or prove cheating.
                </p>
              </div>
            ) : null}

            {blurResults && vaultId && claimToken ? (
              <div className={styles.paidReportCard}>
                <div className={styles.paidReportIntro}>
                  <LockKeyhole aria-hidden />
                  <div>
                    <h2>We have your results.</h2>
                    <p>
                      Unlock the complete report, PDF download, and private
                      email delivery for one payment.
                    </p>
                  </div>
                </div>
                <SearchUnlockPanel
                  balance={auth.status === "authenticated" ? auth.balance : 0}
                  claimToken={claimToken}
                  funnelOfferPrice={CHEATING_REPORT_UNLOCK_PRICE_USD}
                  isGuest={auth.status !== "authenticated"}
                  returnTo={returnTo}
                  unlock={unlock}
                  vaultId={vaultId}
                  onUnlocked={handleUnlocked}
                />
                <p className={styles.paidReportBoundary}>
                  The report contains the public-source results returned by the
                  search. Results may be incomplete and do not include private
                  messages.
                </p>
              </div>
            ) : records.length > 0 ? (
              <div className={styles.resultCards}>
                <SearchResultCards
                  dense
                  balance={auth.status === "authenticated" ? auth.balance : 0}
                  blurNoticeIsGuest={auth.status !== "authenticated"}
                  blurResults={blurResults}
                  claimToken={claimToken}
                  defaultExpanded="first"
                  moduleSlug="phone"
                  pageSize={10}
                  records={records}
                  totalCount={totalCount}
                  unlock={unlock}
                  unlockReturnTo={returnTo}
                  vaultId={vaultId}
                  onUnlocked={handleUnlocked}
                />
              </div>
            ) : (
              <div className={styles.emptyResult}>
                <Search aria-hidden />
                <h3>No public-source records were returned.</h3>
                <p>
                  {resultMessage ||
                    "An empty search does not confirm or rule out any private conversation or relationship."}
                </p>
              </div>
            )}

            {!blurResults ? (
              <div className={styles.exportSection}>
                <div className={styles.exportHeading}>
                  <div className={styles.exportIcon}>
                    <FileText aria-hidden />
                  </div>
                  <div>
                    <h2>Keep a private copy</h2>
                    <p>
                      Download the full report or have the PDF sent to your
                      email.
                    </p>
                  </div>
                </div>

                {canExport ? (
                  <div className={styles.exportActions}>
                    <button
                      className={styles.secondaryButton}
                      disabled={pdfBusy}
                      type="button"
                      onClick={() => void downloadPdf()}
                    >
                      <Download aria-hidden />
                      {pdfBusy ? "Preparing PDF…" : "Download PDF"}
                    </button>

                    <form className={styles.emailForm} onSubmit={emailReport}>
                      <div className={styles.emailInputWrap}>
                        <Mail aria-hidden />
                        <input
                          required
                          aria-label="Email address for report delivery"
                          autoComplete="email"
                          placeholder="you@example.com"
                          type="email"
                          value={email}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            setEmailStatus("");
                          }}
                        />
                      </div>
                      <button
                        className={styles.primaryButton}
                        disabled={emailBusy}
                        type="submit"
                      >
                        <Mail aria-hidden />
                        {emailBusy ? "Sending…" : "Email my report"}
                      </button>
                    </form>
                  </div>
                ) : null}

                {emailStatus ? (
                  <p className={styles.emailStatus}>{emailStatus}</p>
                ) : null}
                {error ? <p className={styles.error}>{error}</p> : null}
              </div>
            ) : null}

            {!blurResults ? (
              <div className={styles.finalSupport}>
                <Sparkles aria-hidden />
                <div>
                  <strong>
                    Whatever the report shows, you do not have to decide today.
                  </strong>
                  <p>
                    Separate what is verified from what is assumed. If a
                    conversation would put you at risk, prioritize your safety
                    and talk with someone you trust.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <footer className={styles.footer}>
        <span>Public data. One careful review.</span>
        <span>Private messages are never accessed.</span>
      </footer>
    </main>
  );
}
