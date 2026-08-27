import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
} from "./config";

export function readLocaleFromCookie(cookieHeader: null | string): Locale | null {
  if (cookieHeader === null || cookieHeader.length === 0) {
    return null;
  }

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE_NAME}=`));

  if (cookie === undefined) {
    return null;
  }

  const value = decodeURIComponent(cookie.slice(LOCALE_COOKIE_NAME.length + 1));
  return isLocale(value) ? value : null;
}

export function serializeLocaleCookie(locale: Locale): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

export function sanitizeReturnTo(returnTo: null | string): string {
  if (
    returnTo === null ||
    returnTo.length === 0 ||
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//")
  ) {
    return "/";
  }

  return returnTo;
}

export { DEFAULT_LOCALE };
