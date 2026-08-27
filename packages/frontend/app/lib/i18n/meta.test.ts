import { describe, expect, it } from "vitest";

import { buildPageMeta, getLocaleFromMatches } from "./meta";

function makeMatches(locale: string): Array<{ id: string; loaderData: { locale: string } }> {
  return [
    { id: "root", loaderData: { locale } },
    { id: "routes/some-route", loaderData: { locale } },
  ];
}

describe("getLocaleFromMatches", () => {
  it("extracts the locale from the root match entry", () => {
    expect(getLocaleFromMatches(makeMatches("de"))).toBe("de");
    expect(getLocaleFromMatches(makeMatches("en"))).toBe("en");
  });

  it("falls back to DEFAULT_LOCALE when the root match is missing", () => {
    expect(getLocaleFromMatches([{ id: "routes/login", loaderData: { locale: "de" } }])).toBe("en");
  });

  it("falls back to DEFAULT_LOCALE when locale is not set on the root match", () => {
    expect(getLocaleFromMatches([{ id: "root", loaderData: {} }])).toBe("en");
  });

  it("handles undefined entries in the matches array gracefully", () => {
    expect(getLocaleFromMatches([undefined, { id: "root", loaderData: { locale: "de" } }])).toBe(
      "de",
    );
  });
});

describe("buildPageMeta – login", () => {
  it("returns the German page title for de", () => {
    const result = buildPageMeta(makeMatches("de"), "login");
    expect(result).toContainEqual({ title: "Anmeldung — Relanto" });
  });

  it("returns the English page title for en", () => {
    const result = buildPageMeta(makeMatches("en"), "login");
    expect(result).toContainEqual({ title: "Sign In — Relanto" });
  });

  it("includes og:title matching the German page title", () => {
    const result = buildPageMeta(makeMatches("de"), "login");
    expect(result).toContainEqual({ content: "Anmeldung — Relanto", property: "og:title" });
  });

  it("includes og:title matching the English page title", () => {
    const result = buildPageMeta(makeMatches("en"), "login");
    expect(result).toContainEqual({ content: "Sign In — Relanto", property: "og:title" });
  });

  it("includes og:site_name Relanto", () => {
    const result = buildPageMeta(makeMatches("en"), "login");
    expect(result).toContainEqual({ content: "Relanto", property: "og:site_name" });
  });

  it("includes og:type website", () => {
    const result = buildPageMeta(makeMatches("en"), "login");
    expect(result).toContainEqual({ content: "website", property: "og:type" });
  });

  it("includes og:image /favicon.svg", () => {
    const result = buildPageMeta(makeMatches("en"), "login");
    expect(result).toContainEqual({ content: "/favicon.svg", property: "og:image" });
  });

  it("includes the German description", () => {
    const result = buildPageMeta(makeMatches("de"), "login");
    expect(result).toContainEqual({
      content: "Melde dich mit Pocket ID an, um die Relanto-Mailer-Verwaltung zu nutzen.",
      name: "description",
    });
  });

  it("includes the English description", () => {
    const result = buildPageMeta(makeMatches("en"), "login");
    expect(result).toContainEqual({
      content: "Sign in with Pocket ID to manage Relanto mailer administration.",
      name: "description",
    });
  });
});

describe("buildPageMeta – dashboard", () => {
  it("returns the German page title for de", () => {
    const result = buildPageMeta(makeMatches("de"), "dashboard");
    expect(result).toContainEqual({ title: "Verwaltung — Relanto" });
  });

  it("returns the English page title for en", () => {
    const result = buildPageMeta(makeMatches("en"), "dashboard");
    expect(result).toContainEqual({ title: "Administration — Relanto" });
  });

  it("includes og:site_name Relanto", () => {
    const result = buildPageMeta(makeMatches("en"), "dashboard");
    expect(result).toContainEqual({ content: "Relanto", property: "og:site_name" });
  });

  it("includes og:image /favicon.svg", () => {
    const result = buildPageMeta(makeMatches("de"), "dashboard");
    expect(result).toContainEqual({ content: "/favicon.svg", property: "og:image" });
  });

  it("does not include a description tag", () => {
    const result = buildPageMeta(makeMatches("en"), "dashboard");
    expect(result).not.toContainEqual(expect.objectContaining({ name: "description" }));
  });
});

describe("buildPageMeta – api-failures", () => {
  it("returns the German page title for de", () => {
    const result = buildPageMeta(makeMatches("de"), "api-failures");
    expect(result).toContainEqual({ title: "API-Fehler — Relanto" });
  });

  it("returns the English page title for en", () => {
    const result = buildPageMeta(makeMatches("en"), "api-failures");
    expect(result).toContainEqual({ title: "API Failures — Relanto" });
  });

  it("includes og:site_name Relanto", () => {
    const result = buildPageMeta(makeMatches("en"), "api-failures");
    expect(result).toContainEqual({ content: "Relanto", property: "og:site_name" });
  });

  it("includes og:image /favicon.svg", () => {
    const result = buildPageMeta(makeMatches("de"), "api-failures");
    expect(result).toContainEqual({ content: "/favicon.svg", property: "og:image" });
  });
});

describe("buildPageMeta – auth-callback", () => {
  it("returns the German page title for de", () => {
    const result = buildPageMeta(makeMatches("de"), "auth-callback");
    expect(result).toContainEqual({ title: "Wird angemeldet … — Relanto" });
  });

  it("returns the English page title for en", () => {
    const result = buildPageMeta(makeMatches("en"), "auth-callback");
    expect(result).toContainEqual({ title: "Signing in … — Relanto" });
  });

  it("includes og:image /favicon.svg", () => {
    const result = buildPageMeta(makeMatches("en"), "auth-callback");
    expect(result).toContainEqual({ content: "/favicon.svg", property: "og:image" });
  });

  it("includes og:site_name Relanto", () => {
    const result = buildPageMeta(makeMatches("de"), "auth-callback");
    expect(result).toContainEqual({ content: "Relanto", property: "og:site_name" });
  });
});
