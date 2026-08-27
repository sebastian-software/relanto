/* eslint-disable @typescript-eslint/only-throw-error, no-nested-ternary -- React Router route handlers throw Response objects; small status mapping stays inline. */
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
  params: { tokenId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    requireMethod(request, "POST");
    const auth = await requireAdminOrScope(request, "manageTokens");

    if (auth.kind === "token" && !mailerApi.canTokenAccessToken(auth.token, params.tokenId)) {
      throw new Response("Token cannot rotate a token outside its ownership", { status: 403 });
    }

    const actorId =
      auth.kind === "systemAdmin"
        ? auth.principalId
        : auth.token.kind === "applicationAdmin"
          ? auth.token.applicationAdminId
          : auth.token.applicationId;
    const actorType = auth.kind === "systemAdmin" ? "systemAdmin" : auth.token.kind;

    return Response.json({
      ok: true,
      token: mailerApi.rotateToken(actorId, actorType, params.tokenId),
    });
  });
}
