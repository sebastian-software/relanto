/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/only-throw-error, no-nested-ternary -- Route action payloads are asserted into backend input shapes for validation; Response throws are React Router control flow. */
import type { UpdateTokenScopesInput } from "@relanto/backend";

import {
  mailerApi,
  methodNotAllowedHandler,
  readJsonBody,
  requireAdminOrScope,
  withDomainErrorJson,
} from "./api._shared";
import { requireMethod } from "./require-method";

export const loader = methodNotAllowedHandler("PATCH");

export async function action({
  params,
  request,
}: {
  params: { tokenId: string };
  request: Request;
}): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    requireMethod(request, "PATCH");
    const auth = await requireAdminOrScope(request, "manageTokens");

    if (auth.kind === "token" && !mailerApi.canTokenAccessToken(auth.token, params.tokenId)) {
      throw new Response("Token cannot update a token outside its ownership", { status: 403 });
    }

    const payload = await readJsonBody(request);
    const actorId =
      auth.kind === "systemAdmin"
        ? auth.principalId
        : auth.token.kind === "applicationAdmin"
          ? auth.token.applicationAdminId
          : auth.token.applicationId;
    const actorType = auth.kind === "systemAdmin" ? "systemAdmin" : auth.token.kind;

    return Response.json({
      ok: true,
      token: mailerApi.updateTokenScopes(
        actorId,
        actorType,
        params.tokenId,
        payload as UpdateTokenScopesInput,
      ),
    });
  });
}
