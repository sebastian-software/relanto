import type { MetaDescriptor } from "react-router";

import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/** Seiten-ID für die statische Label-Map. */
export type RouteMetaPage = "api-failures" | "auth-callback" | "dashboard" | "login";

type PageLabels = {
  description?: string;
  title: string;
};

/**
 * Statische Titel- und Description-Map für alle UI-Routen.
 *
 * Strategie-Begründung: `meta` ist eine synchrone Funktion, `loadMessages()`
 * ist jedoch async. `translate()` greift auf den aktiven i18n-Kontext über
 * `getI18n()` zurück, der client-seitig (vor `syncClientI18n`) nicht
 * zuverlässig gesetzt ist. Eine statische Map ist deterministisch, ohne
 * Seiteneffekte und sowohl server- als auch client-seitig korrekt.
 */
const PAGE_LABELS: Record<Locale, Record<RouteMetaPage, PageLabels>> = {
  de: {
    "api-failures": {
      title: "API-Fehler — Relanto",
    },
    "auth-callback": {
      title: "Wird angemeldet … — Relanto",
    },
    dashboard: {
      title: "Verwaltung — Relanto",
    },
    login: {
      description: "Melde dich mit Pocket ID an, um die Relanto-Mailer-Verwaltung zu nutzen.",
      title: "Anmeldung — Relanto",
    },
  },
  en: {
    "api-failures": {
      title: "API Failures — Relanto",
    },
    "auth-callback": {
      title: "Signing in … — Relanto",
    },
    dashboard: {
      title: "Administration — Relanto",
    },
    login: {
      description: "Sign in with Pocket ID to manage Relanto mailer administration.",
      title: "Sign In — Relanto",
    },
  },
};

/**
 * Liest die aktive Locale aus dem Root-Match-Eintrag heraus.
 * @param matches - Die Route-Matches aus MetaArgs.
 * @returns Die aktive Locale oder DEFAULT_LOCALE als Fallback.
 */
export function getLocaleFromMatches(
  matches: ReadonlyArray<{ id: string; loaderData?: unknown } | undefined>,
): Locale {
  const rootMatch = matches.find((m) => m?.id === "root");
  const loaderData = rootMatch?.loaderData;

  if (typeof loaderData === "object" && loaderData !== null) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- loaderData comes from the root loader's return value which is typed as unknown here; the isLocale guard ensures runtime safety.
    const localeValue = (loaderData as Record<string, unknown>).locale;
    if (typeof localeValue === "string" && isLocale(localeValue)) {
      return localeValue;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Erzeugt den vollständigen meta-Descriptor-Array für eine UI-Route.
 * Enthält title, og:title, og:site_name, og:type, og:image und –
 * nur für die Login-Route – description.
 * @param matches - Die Route-Matches aus MetaArgs.
 * @param page - Die Seiten-ID für die Label-Map.
 * @returns Array mit meta-Deskriptoren für die Seite.
 */
export function buildPageMeta(
  matches: ReadonlyArray<{ id: string; loaderData?: unknown } | undefined>,
  page: RouteMetaPage,
): MetaDescriptor[] {
  const locale = getLocaleFromMatches(matches);
  const labels = PAGE_LABELS[locale][page];

  const descriptors: MetaDescriptor[] = [
    { title: labels.title },
    { content: labels.title, property: "og:title" },
    { content: "Relanto", property: "og:site_name" },
    { content: "website", property: "og:type" },
    { content: "/favicon.svg", property: "og:image" },
  ];

  if (labels.description !== undefined) {
    descriptors.push({ content: labels.description, name: "description" });
  }

  return descriptors;
}
