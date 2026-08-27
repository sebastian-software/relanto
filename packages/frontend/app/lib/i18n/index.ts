import { type CatalogMessages, createI18n, type PalamedesI18n } from "@palamedes/core";
import { setClientI18n, setServerI18nGetter } from "@palamedes/runtime";

import { DEFAULT_LOCALE, type Locale } from "./config";

export {
  DEFAULT_LOCALE,
  getLocaleLabel,
  isLocale,
  type Locale,
  LOCALES,
  normalizeLocale,
} from "./config";

export async function loadMessages(locale: Locale): Promise<CatalogMessages> {
  switch (locale) {
    case "de": {
      const catalogModule = await import("../../locales/de.ts");
      return catalogModule.messages;
    }
    case "en": {
      const catalogModule = await import("../../locales/en.ts");
      return catalogModule.messages;
    }
  }
}

function createRelantoI18n(): PalamedesI18n {
  return createI18n();
}

export async function activateServerI18n(locale: Locale): Promise<PalamedesI18n> {
  const messages = await loadMessages(locale);
  const i18n = createRelantoI18n();
  i18n.load(locale, messages);
  i18n.activate(locale);
  setServerI18nGetter(() => i18n);
  return i18n;
}

const clientI18n = createRelantoI18n();

export async function syncClientI18n(locale: Locale): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }

  const messages = await loadMessages(locale);
  clientI18n.load(locale, messages);
  clientI18n.activate(locale);
  setClientI18n(clientI18n);
}

export function getClientBootstrapLocale(value: string | undefined): Locale {
  return value === "de" ? "de" : DEFAULT_LOCALE;
}
