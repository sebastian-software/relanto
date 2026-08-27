import "./assets/relanto-tokens.css";
import {
  Form,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";

import { activateServerI18n, getLocaleLabel, type Locale } from "./lib/i18n";
import { resolveLocaleFromRequest } from "./lib/i18n/detectLocale.server";
import { t } from "./lib/i18n/tag";
import { getOptionalSystemAdminUser } from "./lib/server/auth.server";
import { ensureRuntimeStarted } from "./lib/server/bootstrap.server";
import { getBuildLabel, getCopyrightLabel } from "./lib/server/build-metadata.server";
import { getOperatorAssets, type OperatorAssets } from "./lib/server/operator-assets.server";
import {
  appEyebrow,
  appFooter,
  appFooterCopyright,
  appFooterMeta,
  appFooterPlate,
  appHeader,
  appHeaderActions,
  appIdentity,
  appUserName,
  errorCard,
  errorDetails,
  errorLayout,
  errorTitle,
  ghostButton,
  globalThemeClass,
  localeButton,
  localeButtonActive,
  localeSwitcher,
} from "./root.css";

const NOT_FOUND_STATUS = 404;
const fallbackLoaderData: Awaited<ReturnType<typeof loader>> = {
  buildLabel: "dev",
  copyrightLabel: "Copyright 2026 Sebastian Software GmbH",
  locale: "en",
  operatorAssets: {
    enabled: false,
    faviconHref: "/favicon.svg",
    logoHref: null,
    stylesheetHref: null,
  },
  user: null,
};

export async function loader({ request }: Route.LoaderArgs): Promise<{
  buildLabel: string;
  copyrightLabel: string;
  locale: Locale;
  operatorAssets: OperatorAssets;
  user: Awaited<ReturnType<typeof getOptionalSystemAdminUser>>;
}> {
  ensureRuntimeStarted();
  const locale = resolveLocaleFromRequest(request);
  await activateServerI18n(locale);

  return {
    buildLabel: getBuildLabel(),
    copyrightLabel: getCopyrightLabel(),
    locale,
    operatorAssets: getOperatorAssets(),
    user: await getOptionalSystemAdminUser(request),
  };
}

export function Layout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const loaderData = useRouteLoaderData<typeof loader>("root");
  const { buildLabel, copyrightLabel, locale, operatorAssets, user } =
    loaderData ?? fallbackLoaderData;
  const location = useLocation();

  return (
    <html className={globalThemeClass} lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <Meta />
        <Links />
        {operatorAssets.stylesheetHref ? (
          <link href={operatorAssets.stylesheetHref} rel="stylesheet" />
        ) : null}
        <link href={operatorAssets.faviconHref} rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <header className={appHeader}>
          <div className={appIdentity}>
            <p className={appEyebrow}>{user ? t`System Admin Session` : t`Relanto Mailer`}</p>
            <p className={appUserName}>
              {user ? user.label : t`Self-hosted email delivery for your applications.`}
            </p>
          </div>
          <div className={appHeaderActions}>
            <Form action="/set-locale" className={localeSwitcher} method="post" reloadDocument>
              <input
                name="returnTo"
                type="hidden"
                value={`${location.pathname}${location.search}${location.hash}`}
              />
              {(["en", "de"] as const).map((entry) => {
                const isActive = entry === locale;

                return (
                  <button
                    aria-current={isActive ? "true" : undefined}
                    aria-pressed={isActive}
                    className={isActive ? localeButtonActive : localeButton}
                    key={entry}
                    name="locale"
                    type="submit"
                    value={entry}
                  >
                    {getLocaleLabel(entry)}
                  </button>
                );
              })}
            </Form>
            {user ? (
              <Form action="/logout" method="post">
                <button className={ghostButton} type="submit">
                  {t`Logout`}
                </button>
              </Form>
            ) : null}
          </div>
        </header>
        {children}
        <footer className={appFooter}>
          <div className={appFooterPlate}>
            <p className={appFooterCopyright}>{copyrightLabel}</p>
            <p className={appFooterMeta}>{buildLabel}</p>
          </div>
        </footer>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__PALAMEDES_LOCALE__=${JSON.stringify(locale)};`,
          }}
        />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App(): React.JSX.Element {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps): React.JSX.Element {
  let message = t`Something went wrong`;
  let details = t`The page could not be loaded right now. Please go back or try again in a moment.`;

  if (isRouteErrorResponse(error)) {
    message = error.status === NOT_FOUND_STATUS ? "404" : t`Something went wrong`;
    details =
      error.status === NOT_FOUND_STATUS
        ? t`The requested page could not be found.`
        : t`The requested page could not be loaded right now. Please try again.`;
  } else if (error instanceof Error) {
    details = t`The requested page could not be loaded right now. Please try again.`;
  }

  return (
    <main className={errorLayout}>
      <section className={errorCard}>
        <h1 className={errorTitle}>{message}</h1>
        <p className={errorDetails}>{details}</p>
      </section>
    </main>
  );
}
