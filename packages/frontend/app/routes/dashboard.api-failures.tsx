import { listApiFailures } from "@relanto/backend";
import { Link, useLoaderData } from "react-router";

import type { Route } from "./+types/dashboard.api-failures";

import { activateServerI18n } from "../lib/i18n";
import { resolveLocaleFromRequest } from "../lib/i18n/detectLocale.server";
import { buildPageMeta } from "../lib/i18n/meta";
import { t } from "../lib/i18n/tag";
import { requireSystemAdminUser } from "../lib/server/auth.server";
import { ensureRuntimeStarted } from "../lib/server/bootstrap.server";
import { backLink, eyebrow, headerRow, panel, shell, title } from "./dashboard.api-failures.css";
import { type LoaderData, parseFilters } from "./dashboard.api-failures.helpers";
import { FailureFilters, FailureTable } from "./dashboard.api-failures.view";

export function meta({ matches }: Route.MetaArgs): Route.MetaDescriptors {
  return buildPageMeta(matches, "api-failures");
}

export async function loader({ request }: { request: Request }): Promise<LoaderData> {
  ensureRuntimeStarted();
  await requireSystemAdminUser(request);
  const locale = resolveLocaleFromRequest(request);
  await activateServerI18n(locale);

  const url = new URL(request.url);
  const { filter, raw } = parseFilters(url);
  const failures = listApiFailures(filter);

  return {
    failures,
    filters: raw,
    locale,
  };
}

export default function ApiFailuresPanel(): React.JSX.Element {
  const { failures, filters, locale } = useLoaderData<typeof loader>();

  return (
    <main className={shell}>
      <header className={headerRow}>
        <div>
          <p className={eyebrow}>{t`Operations`}</p>
          <h1 className={title}>{t`API failures`}</h1>
        </div>
        <Link className={backLink} to="/">
          {t`Back to dashboard`}
        </Link>
      </header>

      <section className={panel}>
        <FailureFilters filters={filters} />
        <FailureTable failures={failures} locale={locale} />
      </section>
    </main>
  );
}
