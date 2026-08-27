/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/only-throw-error, @typescript-eslint/strict-boolean-expressions -- Auth callback bridges external request/session data; Response throws are React Router control flow. */
import { redirect } from "react-router";

import type { Route } from "./+types/auth.callback";

import { buildPageMeta } from "../lib/i18n/meta";
import { t } from "../lib/i18n/tag";
import { createSystemAdminSession } from "../lib/server/auth.server";
import { exchangeAuthorizationCode } from "../lib/server/oidc.server";
import { commitSession, getSession } from "../lib/server/session.server";

// Stable, locale-independent flash key. The login route maps it to a
// translated message so the error is shown in the active language.
const LOGIN_ERROR_KEY = "loginFailed";

export function meta({ matches }: Route.MetaArgs): Route.MetaDescriptors {
  return buildPageMeta(matches, "auth-callback");
}

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  const session = await getSession(request.headers.get("cookie"));
  const codeVerifier = session.get("oidcVerifier");
  const state = session.get("oidcState");
  const nonce = session.get("oidcNonce");

  if (!codeVerifier || !state || !nonce) {
    throw new Response("Missing OIDC state in session", { status: 400 });
  }

  session.unset("oidcVerifier");
  session.unset("oidcState");
  session.unset("oidcNonce");

  try {
    const user = await exchangeAuthorizationCode(request, {
      codeVerifier: String(codeVerifier),
      expectedNonce: String(nonce),
      expectedState: String(state),
    });

    return await createSystemAdminSession(request, user, session);
  } catch {
    session.flash("loginError", LOGIN_ERROR_KEY);

    return redirect("/login", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }
}

export default function AuthCallback(): React.JSX.Element {
  return <p>{t`Signing you in…`}</p>;
}
