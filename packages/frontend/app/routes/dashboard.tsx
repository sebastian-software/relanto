import {
  getSendRateLimitPerMinute,
  listApplicationAdmins,
  listApplications,
  listJobs,
} from "@relanto/backend";

import type { Route } from "./+types/dashboard";

import { activateServerI18n, type Locale } from "../lib/i18n";
import { resolveLocaleFromRequest } from "../lib/i18n/detectLocale.server";
import { buildPageMeta } from "../lib/i18n/meta";
import { requireSystemAdminUser } from "../lib/server/auth.server";
import { ensureRuntimeStarted } from "../lib/server/bootstrap.server";

export type LoaderData = {
  admins: Array<
    {
      applications: ReturnType<typeof listApplications>;
    } & ReturnType<typeof listApplicationAdmins>[number]
  >;
  jobs: ReturnType<typeof listJobs>;
  locale: Locale;
  smtpConfigDefaults?: {
    sendRateLimitPerMinute: number;
  };
  user: Awaited<ReturnType<typeof requireSystemAdminUser>>;
};

const RECENT_JOBS_LIMIT = 20;

export function meta({ matches }: Route.MetaArgs): Route.MetaDescriptors {
  return buildPageMeta(matches, "dashboard");
}

export async function loader({ request }: Route.LoaderArgs): Promise<LoaderData> {
  ensureRuntimeStarted();
  const user = await requireSystemAdminUser(request);
  const locale = resolveLocaleFromRequest(request);
  await activateServerI18n(locale);
  const admins = listApplicationAdmins().map((admin) => ({
    ...admin,
    applications: listApplications(admin.id),
  }));

  return {
    admins,
    jobs: listJobs().slice(0, RECENT_JOBS_LIMIT),
    locale,
    smtpConfigDefaults: {
      sendRateLimitPerMinute: getSendRateLimitPerMinute(),
    },
    user,
  };
}

export { action } from "./dashboard.action";
export { default } from "./dashboard.view";
