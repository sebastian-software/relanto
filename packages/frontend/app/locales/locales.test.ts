import { describe, expect, it } from "vitest";

import { messages as de } from "./de.ts";
import { messages as en } from "./en.ts";

/**
 * Guards against locale drift: every message key must exist in both catalogs.
 * A key that is present in one language but missing in the other means users of
 * the other language silently fall back to the source string, which is exactly
 * the class of gap this test is meant to surface.
 */
function difference(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((key) => !rightSet.has(key)).sort();
}

describe("locale catalogs", () => {
  const deKeys = Object.keys(de);
  const enKeys = Object.keys(en);

  it("has no keys missing from the German catalog", () => {
    expect(difference(enKeys, deKeys)).toEqual([]);
  });

  it("has no keys missing from the English catalog", () => {
    expect(difference(deKeys, enKeys)).toEqual([]);
  });

  it("keeps both catalogs exactly in sync", () => {
    expect(new Set(deKeys)).toEqual(new Set(enKeys));
  });

  it("has no empty translations", () => {
    for (const [key, value] of Object.entries(de)) {
      expect(value, `German translation for "${key}" must not be empty`).not.toBe("");
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value, `English translation for "${key}" must not be empty`).not.toBe("");
    }
  });
});
