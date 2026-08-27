/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/only-throw-error, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/strict-boolean-expressions -- Send route normalizes untyped HTTP payloads before backend validation and asserts the send input shape; Response throws are React Router control flow. */
import {
  type AuthenticatedToken,
  deliveryModeSchema,
  getSendMaxRequestBodyBytes,
  getSendRateLimitPerMinute,
  getSendRateLimitPerMinuteForConfig,
  processJob,
  type SendMailInput,
} from "@relanto/backend";

import { logApiFailure } from "../lib/server/api-failure-log.server";
import { buildRateLimitResponse, createRateLimiter } from "../lib/server/rate-limit.server";
import { getRequestPath } from "../lib/server/request-path.server";
import {
  mailerApi,
  methodNotAllowedHandler,
  readJsonBody,
  requireAdminOrScope,
  withDomainErrorJson,
} from "./api._shared";
import { requireMethod } from "./require-method";

export const loader = methodNotAllowedHandler("POST");

const RATE_LIMIT_WINDOW_MS = 60_000;

const sendRateLimiter = createRateLimiter({
  limit: getSendRateLimitPerMinute(),
  windowMs: RATE_LIMIT_WINDOW_MS,
});

/**
 * Enforces the per-token send limit. Returns a `429` response when the token
 * has exceeded its quota, otherwise `undefined` so the caller proceeds.
 */
function enforceSendRateLimit(
  request: Request,
  token: Extract<AuthenticatedToken, { kind: "application" }>,
): Response | undefined {
  const limit = getSendRateLimitPerMinuteForConfig(token.configId);
  const rateLimit = sendRateLimiter.check(token.applicationId, limit);

  if (rateLimit.allowed) {
    return undefined;
  }

  logApiFailure({
    applicationId: token.applicationId,
    method: request.method,
    path: getRequestPath(request),
    reasonCategory: "rate_limited",
    reasonMessage: "Rate limit exceeded",
    status: 429,
    tokenId: token.tokenId,
    tokenKind: token.kind,
  });

  return buildRateLimitResponse(rateLimit.retryAfterMs);
}

/**
 * POST /api/send — Accepts a mail request and enqueues or immediately delivers it.
 *
 * **Required scope:** `send` on an application token. System admin sessions are
 * explicitly rejected with HTTP 403 because they cannot own a mail job.
 *
 * **Request body** (JSON, `SendMailInput`): standard mail fields plus an optional
 * `deliveryMode` (`"queued"` | `"direct"`, default `"queued"`). The total body size
 * must not exceed `SEND_MAX_REQUEST_BODY_BYTES`; payloads with oversized attachments
 * return HTTP 413.
 *
 * **Delivery modes:**
 * - `"queued"` — persists the job and returns HTTP 200 immediately.
 * - `"direct"` — persists and delivers synchronously; returns HTTP 200 on success
 *   or HTTP 409 when the delivery attempt fails.
 *
 * **Response body:** `{ jobId, status, acceptedAt, ok }`.
 *
 * **Status codes:**
 * - `200` — job accepted (queued) or sent (direct)
 * - `400` — request body validation failed
 * - `403` — not an application token
 * - `409` — direct delivery attempted but the send failed
 * - `413` — attachment payload exceeds size limit
 * - `429` — per-token send rate limit exceeded
 *
 * @param root0 - Route arguments provided by React Router.
 * @param root0.request - The incoming HTTP request.
 * @returns A JSON response describing the created mail job.
 */
export async function action({ request }: { request: Request }): Promise<Response> {
  return withDomainErrorJson(
    request,
    async () => {
      requireMethod(request, "POST");
      const auth = await requireAdminOrScope(request, "send");

      if (auth.kind === "token" && auth.token.kind === "application") {
        const rateLimited = enforceSendRateLimit(request, auth.token);

        if (rateLimited) {
          return rateLimited;
        }
      }

      const payload = await readJsonBody(request, { maxBytes: getSendMaxRequestBodyBytes() });
      const deliveryMode = deliveryModeSchema.parse(payload.deliveryMode || "queued");

      if (auth.kind !== "token") {
        throw new Response("System admin session cannot enqueue mail directly via API", {
          status: 403,
        });
      }

      const job = mailerApi.enqueueMail(auth.token, payload as SendMailInput, deliveryMode);
      const finalJob = deliveryMode === "direct" ? await processJob(job.id) : job;
      const directSendSucceeded = deliveryMode !== "direct" || finalJob.status === "sent";

      return Response.json(
        {
          acceptedAt: finalJob.acceptedAt,
          jobId: finalJob.id,
          ok: directSendSucceeded,
          status: finalJob.status,
        },
        {
          status: deliveryMode === "direct" && !directSendSucceeded ? 409 : 200,
        },
      );
    },
    {
      // Oversized attachments are surfaced as a `413` rather than the default
      // `400`, preserving the previous send-specific contract.
      validationStatus: (issues) => (issues[0]?.path?.[0] === "attachments" ? 413 : 400),
    },
  );
}
