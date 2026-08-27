/* eslint-disable @typescript-eslint/only-throw-error -- React Router route handlers intentionally throw Response objects for HTTP control flow. */
import {
  mailerApi,
  methodNotAllowedHandler,
  requireAdminOrScope,
  withDomainErrorJson,
} from "./api._shared";
import { requireMethod } from "./require-method";

export const loader = methodNotAllowedHandler("POST");

export async function action({
  params,
  request,
}: {
  params: { jobId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    requireMethod(request, "POST");
    const auth = await requireAdminOrScope(request, "manageApplications");

    if (auth.kind === "token") {
      if (
        auth.token.kind !== "applicationAdmin" ||
        !mailerApi.canTokenAccessJob(auth.token, params.jobId)
      ) {
        throw new Response("Token cannot retry this job", { status: 403 });
      }

      return Response.json({
        job: mailerApi.retryJob(auth.token.applicationAdminId, auth.token.kind, params.jobId),
        ok: true,
      });
    }

    return Response.json({
      job: mailerApi.retryJob(auth.principalId, "systemAdmin", params.jobId),
      ok: true,
    });
  });
}
