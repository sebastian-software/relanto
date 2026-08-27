import { deliveryStatusBatchInputSchema } from "@relanto/backend";

import {
  mailerApi,
  methodNotAllowedHandler,
  readJsonBody,
  requireAdminOrScope,
  withDomainErrorJson,
} from "./api._shared";
import { requireMethod } from "./require-method";

export const loader = methodNotAllowedHandler("POST");

export async function action({ request }: { request: Request }): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    requireMethod(request, "POST");
    const auth = await requireAdminOrScope(request, "readStatus");
    const payload = deliveryStatusBatchInputSchema.parse(await readJsonBody(request));
    const statuses =
      auth.kind === "token"
        ? mailerApi.listJobDeliveryStatusesForToken(auth.token, payload.jobIds)
        : mailerApi.listJobDeliveryStatuses(payload.jobIds);

    return Response.json({ ok: true, statuses });
  });
}
