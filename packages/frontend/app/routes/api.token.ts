/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/strict-boolean-expressions -- Token route bridges untyped JSON payloads into backend validation while preserving existing empty-string semantics. */
import {
  getTokenMaxRequestBodyBytes,
  getTokenRateLimitPerMinute,
  issueClientAccessToken,
  type IssueClientAccessTokenInput,
} from "@relanto/backend";

import { logApiFailure } from "../lib/server/api-failure-log.server";
import {
  buildRateLimitResponse,
  createRateLimiter,
  getClientIp,
} from "../lib/server/rate-limit.server";
import { getRequestPath } from "../lib/server/request-path.server";
import { methodNotAllowedHandler, readJsonBody, withDomainErrorJson } from "./api._shared";
import { requireMethod } from "./require-method";

export const loader = methodNotAllowedHandler("POST");

const RATE_LIMIT_WINDOW_MS = 60_000;

const tokenRateLimiter = createRateLimiter({
  limit: getTokenRateLimitPerMinute(),
  windowMs: RATE_LIMIT_WINDOW_MS,
});

function readStringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (!(key in value)) {
    return undefined;
  }

  const candidate: unknown = Reflect.get(value, key);

  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}

function extractClientIdFromPayload(payload: unknown): string | undefined {
  return readStringProperty(payload, "clientId") ?? readStringProperty(payload, "client_id");
}

export async function action({ request }: { request: Request }): Promise<Response> {
  let payload: unknown;

  return withDomainErrorJson(
    request,
    async () => {
      requireMethod(request, "POST");

      const rateLimit = tokenRateLimiter.check(getClientIp(request));

      if (!rateLimit.allowed) {
        logApiFailure({
          method: request.method,
          path: getRequestPath(request),
          reasonCategory: "rate_limited",
          reasonMessage: "Rate limit exceeded",
          status: 429,
        });

        return buildRateLimitResponse(rateLimit.retryAfterMs);
      }

      payload = await readJsonBody(request, { maxBytes: getTokenMaxRequestBodyBytes() });
      const issued = issueClientAccessToken(payload as IssueClientAccessTokenInput);

      return Response.json(issued);
    },
    {
      // Invalid or revoked client credentials are an authentication failure, not
      // a generic server error, so they map to `401` before the `500` fallback.
      onUnmappedError(error) {
        if (error instanceof Error && error.message === "Invalid or revoked client credentials") {
          logApiFailure({
            clientId: extractClientIdFromPayload(payload),
            method: request.method,
            path: getRequestPath(request),
            reasonCategory: "auth_invalid",
            reasonMessage: error.message,
            status: 401,
          });

          return Response.json({ error: error.message, ok: false }, { status: 401 });
        }

        return undefined;
      },
    },
  );
}
