export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE_NAME = "__relanto_locale";
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;
export const LOCALE_COOKIE_MAX_AGE =
  SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * DAYS_PER_YEAR;

export function isLocale(value: string): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

export function normalizeLocale(value: null | string | undefined): Locale {
  if (value === null || value === undefined || value.length === 0) {
    return DEFAULT_LOCALE;
  }

  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getLocaleLabel(locale: Locale): string {
  return locale === "de" ? "DE" : "EN";
}
