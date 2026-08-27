/* eslint-disable @typescript-eslint/only-throw-error, no-nested-ternary -- React Router route handlers throw Response objects; status mapping is kept inline with the small response shape. */
import { mailerApi, requireAdminOrScope, withDomainErrorJson } from "./api._shared";
import { requireMethod } from "./require-method";

export async function loader({
  params,
  request,
}: {
  params: { jobId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    const auth = await requireAdminOrScope(request, "readStatus");

    if (auth.kind === "token" && !mailerApi.canTokenAccessJob(auth.token, params.jobId)) {
      throw new Response("Token cannot read a job outside its ownership", { status: 403 });
    }

    return Response.json({
      job: mailerApi.getJobStatusView(params.jobId),
      ok: true,
    });
  });
}

export async function action({
  params,
  request,
}: {
  params: { jobId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    requireMethod(request, "DELETE");
    const auth = await requireAdminOrScope(request, "manageApplications");

    if (auth.kind === "token" && !mailerApi.canTokenAccessJob(auth.token, params.jobId)) {
      throw new Response("Token cannot delete a job outside its ownership", { status: 403 });
    }
    const actorId =
      auth.kind === "systemAdmin"
        ? auth.principalId
        : auth.token.kind === "applicationAdmin"
          ? auth.token.applicationAdminId
          : auth.token.applicationId;
    const actorType = auth.kind === "systemAdmin" ? "systemAdmin" : auth.token.kind;

    mailerApi.deleteJob(actorId, actorType, params.jobId);

    return Response.json({ ok: true });
  });
}
