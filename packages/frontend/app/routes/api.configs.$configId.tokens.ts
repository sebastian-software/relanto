/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/only-throw-error, no-nested-ternary -- Route action payloads are asserted into backend input shapes for validation; Response throws are React Router control flow. */
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
    const auth = await requireAdminOrScope(request, "manageTokens");

    if (auth.kind === "token" && !mailerApi.canTokenAccessConfig(auth.token, params.configId)) {
      throw new Response("Token cannot read tokens for a different config", { status: 403 });
    }

    return Response.json({
      ok: true,
      tokens: mailerApi.listTokensByConfig(params.configId),
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
    requireMethod(request, "POST");
    const auth = await requireAdminOrScope(request, "manageTokens");
    const payload = await readJsonBody(request);

    if (auth.kind === "token" && !mailerApi.canTokenAccessConfig(auth.token, params.configId)) {
      throw new Response("Token cannot issue tokens for a different config", { status: 403 });
    }

    const actorId =
      auth.kind === "systemAdmin"
        ? auth.principalId
        : auth.token.kind === "applicationAdmin"
          ? auth.token.applicationAdminId
          : auth.token.applicationId;
    const actorType = auth.kind === "systemAdmin" ? "systemAdmin" : auth.token.kind;
    const token = mailerApi.createToken(actorId, actorType, {
      ...payload,
      configId: params.configId,
    } as Parameters<typeof mailerApi.createToken>[2]);

    return Response.json({ ok: true, token }, { status: 201 });
  });
}
