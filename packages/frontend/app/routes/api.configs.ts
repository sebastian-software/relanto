/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/only-throw-error, no-nested-ternary -- Route action payloads are asserted into backend input shapes for validation; Response throws are React Router control flow. */
import type { UpsertSmtpConfigInput } from "@relanto/backend";

import { mailerApi, readJsonBody, requireAdminOrScope, withDomainErrorJson } from "./api._shared";
import { requireMethod } from "./require-method";

export async function loader({ request }: { request: Request }): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    const auth = await requireAdminOrScope(request, "manageApplications");

    // Ownership is enforced inside the query: application tokens are pinned to their own
    // config (configId), application admin tokens to configs of applications they own
    // (applicationAdminId), and system admins see everything. This avoids the previous N+1
    // per-element ownership filtering (canTokenAccessConfig refetching each config).
    return Response.json({
      configs: mailerApi.listSmtpConfigs({
        applicationAdminId:
          auth.kind === "token" && auth.token.kind === "applicationAdmin"
            ? auth.token.applicationAdminId
            : undefined,
        configId:
          auth.kind === "token" && auth.token.kind === "application"
            ? auth.token.configId
            : undefined,
      }),
      ok: true,
    });
  });
}

export async function action({ request }: { request: Request }): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    requireMethod(request, "POST");
    const auth = await requireAdminOrScope(request, "manageApplications");
    const payload = await readJsonBody(request);

    if (auth.kind === "token") {
      if (auth.token.kind !== "applicationAdmin") {
        throw new Response("Application tokens cannot create SMTP configs", { status: 403 });
      }

      const application = mailerApi.getApplicationById(
        (payload.applicationId as string | undefined) ?? "",
      );
      if (application.applicationAdminId !== auth.token.applicationAdminId) {
        throw new Response("Application admin token cannot manage a foreign application", {
          status: 403,
        });
      }
    }

    const actorId =
      auth.kind === "systemAdmin"
        ? auth.principalId
        : auth.token.kind === "applicationAdmin"
          ? auth.token.applicationAdminId
          : auth.token.applicationId;
    const actorType = auth.kind === "systemAdmin" ? "systemAdmin" : auth.token.kind;
    const config = mailerApi.upsertSmtpConfig(actorId, actorType, payload as UpsertSmtpConfigInput);

    return Response.json({ config, ok: true }, { status: 201 });
  });
}
