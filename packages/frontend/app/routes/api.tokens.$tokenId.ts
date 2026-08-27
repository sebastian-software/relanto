/* eslint-disable @typescript-eslint/only-throw-error, no-nested-ternary -- React Router route handlers throw Response objects; small status mapping stays inline. */
import { mailerApi, requireAdminOrScope, withDomainErrorJson } from "./api._shared";
import { requireMethod } from "./require-method";

export async function loader({
  params,
  request,
}: {
  params: { tokenId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    const auth = await requireAdminOrScope(request, "manageTokens");

    if (auth.kind === "token" && !mailerApi.canTokenAccessToken(auth.token, params.tokenId)) {
      throw new Response("Token cannot read a token outside its ownership", { status: 403 });
    }

    return Response.json({
      ok: true,
      token: mailerApi.getTokenById(params.tokenId),
    });
  });
}

export async function action({
  params,
  request,
}: {
  params: { tokenId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    requireMethod(request, "DELETE");
    const auth = await requireAdminOrScope(request, "manageTokens");

    if (auth.kind === "token" && !mailerApi.canTokenAccessToken(auth.token, params.tokenId)) {
      throw new Response("Token cannot delete a token outside its ownership", { status: 403 });
    }

    const actorId =
      auth.kind === "systemAdmin"
        ? auth.principalId
        : auth.token.kind === "applicationAdmin"
          ? auth.token.applicationAdminId
          : auth.token.applicationId;
    const actorType = auth.kind === "systemAdmin" ? "systemAdmin" : auth.token.kind;

    mailerApi.deleteToken(actorId, actorType, params.tokenId);

    return Response.json({ ok: true });
  });
}
