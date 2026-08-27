/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/only-throw-error, no-nested-ternary -- Route action payloads are asserted into backend input shapes for validation; Response throws are React Router control flow. */
import type { UpsertSmtpConfigInput } from "@relanto/backend";

import { mailerApi, readJsonBody, requireAdminOrScope, withDomainErrorJson } from "./api._shared";
import { requireMethod } from "./require-method";

export async function loader({
  params,
  request,
}: {
  params: { configId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    const auth = await requireAdminOrScope(request, "manageApplications");

    if (auth.kind === "token" && !mailerApi.canTokenAccessConfig(auth.token, params.configId)) {
      throw new Response("Token cannot read a foreign SMTP config", { status: 403 });
    }

    return Response.json({
      config: mailerApi.getSmtpConfig(params.configId),
      ok: true,
    });
  });
}

export async function action({
  params,
  request,
}: {
  params: { configId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    requireMethod(request, "PUT");
    const auth = await requireAdminOrScope(request, "manageApplications");
    const payload = await readJsonBody(request);

    if (auth.kind === "token") {
      if (auth.token.kind !== "applicationAdmin") {
        throw new Response("Application tokens cannot update SMTP configs", { status: 403 });
      }

      if (!mailerApi.canTokenAccessConfig(auth.token, params.configId)) {
        throw new Response("Application admin token cannot update a foreign SMTP config", {
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
    const config = mailerApi.upsertSmtpConfig(
      actorId,
      actorType,
      payload as UpsertSmtpConfigInput,
      params.configId,
    );

    return Response.json({ config, ok: true });
  });
}
