import type {
  FocusEvent,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Chromium + password managers often ignore autocomplete="off" when placeholders
 * mention email/username. Use these attrs on OSINT/search fields only — never on
 * real auth password inputs.
 */
export const SEARCH_AUTOFILL_SHIELD = {
  autoComplete: "one-time-code",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false as const,
  inputMode: "search" as const,
  role: "searchbox",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
  "data-op-ignore": true,
} satisfies InputHTMLAttributes<HTMLInputElement>;

export const TEXTAREA_AUTOFILL_SHIELD = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false as const,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
  "data-op-ignore": true,
} satisfies TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Hidden decoys so managers dump credentials here instead of the real query box. */
export function AutofillDecoyFields() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
      tabIndex={-1}
    >
      <input
        autoComplete="username"
        name="username"
        readOnly
        tabIndex={-1}
        type="text"
      />
      <input
        autoComplete="current-password"
        name="password"
        readOnly
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
