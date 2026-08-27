/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/strict-boolean-expressions -- Locale action accepts browser FormData values and preserves existing fallback semantics. */
import { redirect } from "react-router";

import type { Route } from "./+types/set-locale";

import { DEFAULT_LOCALE, isLocale } from "../lib/i18n";
import { sanitizeReturnTo, serializeLocaleCookie } from "../lib/i18n/cookie.server";
import { requireMethod } from "./require-method";

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  requireMethod(request, "POST");
  const formData = await request.formData();
  const requestedLocale = String(formData.get("locale") || "");
  const locale = isLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const returnTo = sanitizeReturnTo(String(formData.get("returnTo") || "/"));

  return redirect(returnTo, {
    headers: {
      "Set-Cookie": serializeLocaleCookie(locale),
    },
  });
}
