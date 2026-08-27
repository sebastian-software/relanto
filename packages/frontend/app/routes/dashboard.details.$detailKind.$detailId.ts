import {
  getApplicationAdminById,
  getApplicationById,
  getSmtpConfigByApplicationId,
  listApplicationAdminTokens,
  listApplications,
  listApplicationTokensByApplication,
} from "@relanto/backend";

import type { Route } from "./+types/dashboard.details.$detailKind.$detailId";

import { requireSystemAdminUser } from "../lib/server/auth.server";
import { ensureRuntimeStarted } from "../lib/server/bootstrap.server";

export type DashboardDetailLoaderData =
  | {
      admin: {
        applications: Array<
          {
            config: ReturnType<typeof getSmtpConfigByApplicationId>;
          } & ReturnType<typeof listApplications>[number]
        >;
        tokens: ReturnType<typeof listApplicationAdminTokens>;
      };
      kind: "admin";
    }
  | {
      application: {
        config: ReturnType<typeof getSmtpConfigByApplicationId>;
        tokens: ReturnType<typeof listApplicationTokensByApplication>;
      };
      kind: "application";
    };

function logDashboardDetailIssue(context: string, error: unknown): void {
  console.error(`[dashboard.details] ${context}`, error);
}

function normalizeDashboardDetailError(error: unknown): Response {
  if (
    error instanceof Error &&
    (error.message === "Application admin not found" || error.message === "Application not found")
  ) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  // A malformed row or any other unexpected failure must not surface as an opaque 500
  // without a server-side log that bubbles up and replaces the whole dashboard. Log it
  // with context and return a controlled response instead of rethrowing a raw error.
  logDashboardDetailIssue("unexpected loader error", error);

  return Response.json({ error: "Failed to load dashboard detail" }, { status: 500 });
}

// Secondary detail data (SMTP config, tokens) is optional for the panel. If a single
// malformed row makes it throw (e.g. an invalid min_tls_version or scopes_json failing
// schema parsing), degrade that piece to a safe fallback and keep rendering the panel
// rather than taking down the entire detail view.
function loadOptionalDetailData<T>(context: string, load: () => T, fallback: T): T {
  try {
    return load();
  } catch (error) {
    logDashboardDetailIssue(context, error);

    return fallback;
  }
}

export async function loader({ params, request }: Route.LoaderArgs): Promise<Response> {
  ensureRuntimeStarted();
  await requireSystemAdminUser(request);

  if (params.detailKind === "admin") {
    try {
      const admin = getApplicationAdminById(params.detailId);
      const applications = listApplications(admin.id).map((application) => ({
        ...application,
        config: loadOptionalDetailData(
          `admin config application=${application.id}`,
          () => getSmtpConfigByApplicationId(application.id),
          null,
        ),
      }));

      return Response.json({
        admin: {
          applications,
          tokens: loadOptionalDetailData(
            `admin tokens admin=${admin.id}`,
            () => listApplicationAdminTokens(admin.id),
            [],
          ),
        },
        kind: "admin",
      } satisfies DashboardDetailLoaderData);
    } catch (error) {
      return normalizeDashboardDetailError(error);
    }
  }

  if (params.detailKind === "application") {
    try {
      const application = getApplicationById(params.detailId);

      return Response.json({
        application: {
          config: loadOptionalDetailData(
            `application config application=${application.id}`,
            () => getSmtpConfigByApplicationId(application.id),
            null,
          ),
          tokens: loadOptionalDetailData(
            `application tokens application=${application.id}`,
            () => listApplicationTokensByApplication(application.id),
            [],
          ),
        },
        kind: "application",
      } satisfies DashboardDetailLoaderData);
    } catch (error) {
      return normalizeDashboardDetailError(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router loaders use thrown Response objects for HTTP status control flow.
  throw new Response("Dashboard detail kind not found", { status: 404 });
}
