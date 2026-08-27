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
  params: { configId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    requireMethod(request, "POST");
    const auth = await requireAdminOrScope(request, "validate");

    if (auth.kind === "token" && !mailerApi.canTokenAccessConfig(auth.token, params.configId)) {
      throw new Response("Token cannot validate a different config", { status: 403 });
    }

    return Response.json({
      ok: true,
      result: await mailerApi.validateSmtpConfig(params.configId),
    });
  });
}
