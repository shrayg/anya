import type {
  FocusEvent,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type SearchInputShield = InputHTMLAttributes<HTMLInputElement> & {
  "data-1p-ignore"?: boolean | string;
  "data-lpignore"?: string;
  "data-bwignore"?: boolean | string;
  "data-form-type"?: string;
  "data-op-ignore"?: boolean | string;
};

type SearchTextareaShield = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  "data-1p-ignore"?: boolean | string;
  "data-lpignore"?: string;
  "data-bwignore"?: boolean | string;
  "data-form-type"?: string;
  "data-op-ignore"?: boolean | string;
};

/**
 * Chromium + password managers often ignore autocomplete="off" when placeholders
 * mention email/username. Use these attrs on OSINT/search fields only — never on
 * real auth password inputs.
 */
export const SEARCH_AUTOFILL_SHIELD: SearchInputShield = {
  autoComplete: "one-time-code",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  inputMode: "search",
  role: "searchbox",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
  "data-op-ignore": true,
};

export const TEXTAREA_AUTOFILL_SHIELD: SearchTextareaShield = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
  "data-op-ignore": true,
};

/** Hidden decoys so managers dump credentials here instead of the real query box. */
export function AutofillDecoyFields() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
      tabIndex={-1}
    >
      <input
        readOnly
        autoComplete="username"
        name="username"
        tabIndex={-1}
        type="text"
      />
      <input
        readOnly
        autoComplete="current-password"
        name="password"
        tabIndex={-1}
        type="password"
      />
    </div>
  );
}

export function unlockAutofillShield(
  event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  event.currentTarget.removeAttribute("readonly");
}
