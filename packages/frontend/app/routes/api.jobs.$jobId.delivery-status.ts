import {
  mailerApi,
  methodNotAllowedHandler,
  requireAdminOrScope,
  withDomainErrorJson,
} from "./api._shared";

export async function loader({
  params,
  request,
}: {
  params: { jobId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    const auth = await requireAdminOrScope(request, "readStatus");
    const status =
      auth.kind === "token"
        ? mailerApi.getJobDeliveryStatusForToken(auth.token, params.jobId)
        : mailerApi.getJobDeliveryStatus(params.jobId);

    return Response.json({ ok: true, status });
  });
}

export const action = methodNotAllowedHandler("GET");
