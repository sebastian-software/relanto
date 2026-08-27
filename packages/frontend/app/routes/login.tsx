/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/strict-boolean-expressions -- Login route bridges untyped action data and preserves empty-string form semantics. */
import { Form, useLoaderData } from "react-router";

import type { Route } from "./+types/login";

import { buildPageMeta } from "../lib/i18n/meta";
import { t } from "../lib/i18n/tag";
import { buildLoginUrl } from "../lib/server/oidc.server";
import { commitSession, getSession } from "../lib/server/session.server";
import { card, errorText, eyebrow, lead, page, pitch, submit, title } from "./login.css";
import { requireMethod } from "./require-method";

// Maps the locale-independent flash key set by the auth callback to a
// translated, user-facing message.
function getLoginErrorMessage(key: string): string {
  switch (key) {
    case "loginFailed":
      return t`Pocket ID sign-in failed. Please try again.`;
    default:
      return t`Something went wrong. Please try again.`;
  }
}

export function meta({ matches }: Route.MetaArgs): Route.MetaDescriptors {
  return buildPageMeta(matches, "login");
}

export async function loader({
  request,
}: Route.LoaderArgs): Promise<{ issuerConfigured: boolean; loginError?: string } | Response> {
  const session = await getSession(request.headers.get("cookie"));
  const flashedLoginError = session.get("loginError");
  const loginError = typeof flashedLoginError === "string" ? flashedLoginError : undefined;

  const loaderData = {
    issuerConfigured: Boolean(
      process.env.POCKET_ID_ISSUER &&
      process.env.POCKET_ID_CLIENT_ID &&
      (process.env.POCKET_ID_REDIRECT_URI || process.env.NODE_ENV === "development"),
    ),
    loginError,
  };

  if (!loginError) {
    return loaderData;
  }

  return Response.json(loaderData, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  requireMethod(request, "POST");
  const login = await buildLoginUrl(request);
  const session = await getSession(request.headers.get("cookie"));

  session.set("oidcVerifier", login.codeVerifier);
  session.set("oidcState", login.state);
  session.set("oidcNonce", login.nonce);

  return new Response(null, {
    headers: {
      Location: login.redirectTo,
      "Set-Cookie": await commitSession(session),
    },
    status: 302,
  });
}

export default function Login(): React.JSX.Element {
  const { issuerConfigured, loginError } = useLoaderData<typeof loader>();

  return (
    <main className={page}>
      <section className={card}>
        <p className={eyebrow}>{t`Relanto Mailer`}</p>
        <h1 className={title}>{t`Sign in with Pocket ID.`}</h1>
        <p className={pitch}>{t`Self-hosted email delivery for your applications.`}</p>
        <p className={lead}>
          {t`Only users in the Pocket ID group superadmin can access the administration interface.`}
        </p>
        {loginError ? <p className={errorText}>{getLoginErrorMessage(loginError)}</p> : null}
        <Form method="post">
          <button className={submit} disabled={!issuerConfigured} type="submit">
            {t`Continue with Pocket ID`}
          </button>
        </Form>
        {!issuerConfigured && (
          <p className={errorText}>
            {t`Missing Pocket ID configuration. Set POCKET_ID_ISSUER, POCKET_ID_CLIENT_ID and outside local development POCKET_ID_REDIRECT_URI.`}
          </p>
        )}
      </section>
    </main>
  );
}
