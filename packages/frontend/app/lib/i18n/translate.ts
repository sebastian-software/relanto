import type { PalamedesI18n } from "@palamedes/core";

import { getI18n } from "@palamedes/runtime";

export function translate(message: string, values?: Record<string, unknown>): string {
  const i18n = getI18n<PalamedesI18n>();
  return i18n._(message, values, { message });
}
