import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { readLocaleFromCookie } from "./cookie.server";

export function getPreferredLocale(acceptLanguageHeader: null | string): Locale {
  if (acceptLanguageHeader === null || acceptLanguageHeader.length === 0) {
    return DEFAULT_LOCALE;
  }

  const entries = acceptLanguageHeader
    .split(",")
    .map((entry) => entry.trim())
    .map((entry) => {
      const [rawTag, ...parameters] = entry.split(";");
      const quality = parameters.find((parameter) => parameter.startsWith("q="));
      const q = quality === undefined ? 1 : Number(quality.slice(2));
      return {
        q: Number.isFinite(q) ? q : 0,
        tag: rawTag.toLowerCase(),
      };
    })
    .sort((left, right) => right.q - left.q);

  for (const entry of entries) {
    const baseTag = entry.tag.split("-")[0] ?? "";
    if (isLocale(baseTag)) {
      return baseTag;
    }
  }

  return DEFAULT_LOCALE;
}

export function resolveLocaleFromRequest(request: Request): Locale {
  return (
    readLocaleFromCookie(request.headers.get("cookie")) ??
    getPreferredLocale(request.headers.get("accept-language"))
  );
}
