/* eslint-disable @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/strict-boolean-expressions, compat/compat -- API filters preserve existing empty-string semantics and run on the server runtime, not the browser matrix. */
import {
  mailerApi,
  methodNotAllowedHandler,
  requireAdminOrScope,
  withDomainErrorJson,
} from "./api._shared";

type AdminOrScopeAuth = Awaited<ReturnType<typeof requireAdminOrScope>>;

/**
 * Builds the job list filters from the authenticated principal and query string.
 *
 * Ownership is enforced inside the query rather than by re-checking each returned row:
 * application tokens are pinned to their own applicationId, application admin tokens to
 * applications they own (applicationAdminId), and system admins see everything. This avoids
 * the previous N+1 per-element ownership filtering (canTokenAccessJob re-fetched every job
 * and its application).
 */
function readJobFilters(auth: AdminOrScopeAuth, url: URL) {
  const query = (name: string): string | undefined => url.searchParams.get(name) || undefined;
  const token = auth.kind === "token" ? auth.token : undefined;

  return {
    applicationAdminId: token?.kind === "applicationAdmin" ? token.applicationAdminId : undefined,
    applicationId: token?.kind === "application" ? token.applicationId : query("applicationId"),
    configId: query("configId"),
    createdAfter: query("createdAfter"),
    createdBefore: query("createdBefore"),
    messageId: query("messageId"),
    status: query("status"),
  };
}

export async function loader({ request }: { request: Request }): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    const auth = await requireAdminOrScope(request, "readStatus");
    const jobs = mailerApi.listJobStatusViews(readJobFilters(auth, new URL(request.url)));

    return Response.json({ jobs, ok: true });
  });
}

export const action = methodNotAllowedHandler("GET");
