const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

/** Stable locale formatting to avoid SSR/client hydration mismatches. */
const LOCALE = "en-US";

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(LOCALE, TIME_FORMAT).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(LOCALE, DATE_FORMAT).format(new Date(value));
}
