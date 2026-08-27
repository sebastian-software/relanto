/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/only-throw-error, @typescript-eslint/strict-boolean-expressions, max-lines -- Shared React Router API helpers throw Response objects for HTTP control flow, normalize optional headers, and assert a runtime-verified JSON object shape. */
import {
  canTokenAccessConfig,
  canTokenAccessJob,
  canTokenAccessToken,
  createApplication,
  createApplicationToken,
  createToken,
  deleteJob,
  deleteToken,
  enqueueMail,
  getApplicationById,
  getJob,
  getJobDeliveryStatus,
  getJobDeliveryStatusForToken,
  getJobStatusView,
  getMaxRequestBodyBytes,
  getSmtpConfig,
  getTokenById,
  listApplications,
  listJobDeliveryStatuses,
  listJobDeliveryStatusesForToken,
  listJobs,
  listJobStatusViews,
  listSmtpConfigs,
  listTokensByConfig,
  lockSmtpConfig,
  pauseJob,
  resumeJob,
  retryJob,
  revokeToken,
  rotateToken,
  type TokenScope,
  unlockSmtpConfig,
  updateTokenScopes,
  upsertSmtpConfig,
  validateSmtpConfig,
} from "@relanto/backend";

import {
  isResponseAlreadyLogged,
  logApiFailure,
  readThrownResponseBody,
} from "../lib/server/api-failure-log.server";
import { requireApiAccess, requireSystemAdminUser } from "../lib/server/auth.server";
import { getRequestPath } from "../lib/server/request-path.server";
import { requireMethod } from "./require-method";

const DOMAIN_ERROR_STATUS_BY_MESSAGE = new Map<string, number>([
  ["Application admin not found", 404],
  ["Application admin tokens cannot read application SMTP configs directly", 400],
  ["Application admin tokens cannot send mail directly", 400],
  ["Application not found", 404],
  ["Application requires an SMTP config before tokens can be issued", 409],
  ["Application tokens cannot include management scopes", 400],
  ["Job not found", 404],
  ["Only failed or uncertain jobs can be retried manually", 409],
  ["Only paused jobs can be resumed", 409],
  ["Only pending jobs can be paused", 409],
  ["Processing jobs cannot be deleted", 409],
  ["Sent jobs cannot be deleted", 409],
  ["SMTP config application cannot be changed", 409],
  ["SMTP config is locked", 423],
  ["SMTP config not found", 404],
  ["Token cannot read a job outside its ownership", 403],
  ["Token not found", 404],
]);

export async function requireAdminOrScope(request: Request, scope?: TokenScope) {
  return requireApiAccess(request, scope);
}

const BODY_TOO_LARGE_MESSAGE = "Request body exceeds the maximum allowed size";

/**
 * Options accepted by {@link readJsonBody}.
 */
export type ReadJsonBodyOptions = {
  /**
   * Maximum accepted body size in bytes. Bodies larger than this are rejected
   * with a `413` before their contents are buffered. Defaults to
   * {@link getMaxRequestBodyBytes}.
   */
  maxBytes?: number;
};

function concatChunksToText(chunks: Uint8Array[], total: number): string {
  const merged = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

/* eslint-disable no-await-in-loop -- Streaming a request body is inherently sequential: each chunk must be read and size-checked before the next can be requested. */
/**
 * Drains a body reader into chunks while enforcing a hard byte ceiling, so an
 * unbounded body is never fully buffered in memory.
 *
 * @param reader - Reader over the request body stream.
 * @param maxBytes - Maximum number of body bytes to accept.
 * @returns The collected chunks and their combined byte length.
 * @throws {Response} `413` once the accumulated size exceeds `maxBytes`.
 */
async function collectBoundedChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxBytes: number,
): Promise<{ chunks: Uint8Array[]; total: number }> {
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (let result = await reader.read(); !result.done; result = await reader.read()) {
    total += result.value.byteLength;

    if (total > maxBytes) {
      await reader.cancel();
      throw new Response(BODY_TOO_LARGE_MESSAGE, { status: 413 });
    }

    chunks.push(result.value);
  }

  return { chunks, total };
}
/* eslint-enable no-await-in-loop */

/**
 * Reads the request body as text while enforcing a hard byte ceiling.
 *
 * Beyond the `Content-Length` pre-check performed by the caller, this streams
 * the body and aborts as soon as the accumulated size exceeds `maxBytes`. This
 * closes the gap for requests that omit or spoof `Content-Length` (e.g. chunked
 * transfer encoding), so an attacker cannot force us to buffer an unbounded
 * body in memory.
 *
 * @param request - The incoming API request.
 * @param maxBytes - Maximum number of body bytes to accept.
 * @returns The decoded request body text.
 * @throws {Response} `413` when the streamed body exceeds `maxBytes`.
 */
async function readBodyTextWithinLimit(request: Request, maxBytes: number): Promise<string> {
  const stream = request.body;

  // Some runtimes expose no readable stream (e.g. an already-consumed or
  // synthetic body); fall back to the buffered reader, which is still bounded
  // by the Content-Length pre-check in `readJsonBody`.
  if (!stream) {
    return request.text();
  }

  const reader = stream.getReader();

  try {
    const { chunks, total } = await collectBoundedChunks(reader, maxBytes);
    return concatChunksToText(chunks, total);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parses the JSON body of an API request and normalizes client-side problems
 * into `4xx` responses that fit the React Router control flow (routes throw
 * `Response` objects). Both syntactically invalid JSON and non-object payloads
 * (`null`, arrays, primitives) are rejected before they reach downstream
 * validation, so actions can safely treat the result as a keyed object without
 * risking `TypeError`s turning into generic `500`s.
 *
 * A configurable byte limit is enforced *before* the body is buffered so that
 * oversized payloads cannot exhaust process memory (issue #77). The declared
 * `Content-Length` is checked first, and the body stream is additionally capped
 * while reading as defense-in-depth against a missing or spoofed header.
 *
 * @param request - The incoming API request.
 * @param options - Optional overrides, notably the maximum body size.
 * @returns The parsed JSON body as a keyed object.
 * @throws {Response} `413` when the body exceeds the configured size limit.
 * @throws {Response} `400` when the body is not valid JSON or not a JSON object.
 */
export async function readJsonBody(
  request: Request,
  options: ReadJsonBodyOptions = {},
): Promise<Record<string, unknown>> {
  const maxBytes = options.maxBytes ?? getMaxRequestBodyBytes();

  // Reject early based on the declared size to avoid buffering the body at all.
  const contentLengthHeader = request.headers.get("content-length");

  if (contentLengthHeader !== null) {
    const declaredLength = Number(contentLengthHeader);

    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Response(BODY_TOO_LARGE_MESSAGE, { status: 413 });
    }
  }

  const rawBody = await readBodyTextWithinLimit(request, maxBytes);

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Response("Invalid JSON in request body", { status: 400 });
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Response("Request body must be a JSON object", { status: 400 });
  }

  return parsed as Record<string, unknown>;
}

export async function requireSystemAdminApi(request: Request) {
  try {
    return await requireSystemAdminUser(request);
  } catch {
    throw new Response("System admin authentication required", { status: 401 });
  }
}

export function mapDomainErrorToJsonResponse(error: unknown): Response | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  const status = DOMAIN_ERROR_STATUS_BY_MESSAGE.get(error.message);

  if (!status) {
    return undefined;
  }

  return Response.json(
    {
      error: error.message,
      ok: false,
    },
    { status },
  );
}

function isValidationError(
  error: unknown,
): error is { issues: Array<{ message?: string; path?: Array<number | string> }> } {
  return (
    typeof error === "object" && error !== null && "issues" in error && Array.isArray(error.issues)
  );
}

const MAX_ISSUE_PATHS = 10;

function formatIssuePath(path: Array<number | string> | undefined): string {
  if (!path || path.length === 0) {
    return "";
  }

  return path.map((segment) => String(segment)).join(".");
}

function collectIssuePaths(issues: Array<{ path?: Array<number | string> }>): {
  issueCount: number;
  issuePaths: string[];
} {
  const issuePaths = issues
    .slice(0, MAX_ISSUE_PATHS)
    .map((issue) => formatIssuePath(issue.path))
    .filter((path) => path.length > 0);

  return { issueCount: issues.length, issuePaths };
}

async function handleResponseThrow(request: Request, error: Response): Promise<Response> {
  const status = error.status;
  const alreadyLogged = isResponseAlreadyLogged(error);
  const { reasonMessage, responseBody } = await readThrownResponseBody(error);

  if (!alreadyLogged && status >= 400 && status < 500) {
    logApiFailure({
      method: request.method,
      path: getRequestPath(request),
      reasonCategory: status === 405 ? "method_not_allowed" : "other",
      reasonMessage,
      status,
    });
  }

  return Response.json({ ...responseBody, ok: false }, { status });
}

function handleMappedDomainError(request: Request, error: unknown, mapped: Response): Response {
  logApiFailure({
    method: request.method,
    path: getRequestPath(request),
    reasonCategory: "domain_error",
    reasonMessage: error instanceof Error ? error.message : "Domain error",
    status: mapped.status,
  });

  return mapped;
}

/**
 * A single validation issue as produced by the backend Zod schemas.
 */
export type ValidationIssue = { message?: string; path?: Array<number | string> };

/**
 * Optional hooks for {@link withDomainErrorJson}. All hooks are opt-in and the
 * default behavior (used by most endpoints) is unchanged when they are omitted.
 */
export type WithDomainErrorJsonOptions = {
  /**
   * Last-chance handler invoked for errors that are neither thrown `Response`s,
   * mapped domain errors, nor validation errors, before the generic `500`
   * fallback. Returning a `Response` short-circuits the fallback (e.g. `token`
   * maps invalid client credentials to `401`); returning `undefined` lets the
   * generic `500` apply.
   */
  onUnmappedError?: (error: unknown, request: Request) => Response | undefined;
  /**
   * Resolves the HTTP status for a validation failure from its issues. Lets an
   * endpoint promote specific issues to a non-`400` status (e.g. `send` maps an
   * `attachments` size issue to `413`). The `issues` array is always included in
   * the JSON response regardless of the resolved status. Defaults to `400`.
   */
  validationStatus?: (issues: ValidationIssue[]) => number;
};

function handleValidationError(
  request: Request,
  error: { issues: ValidationIssue[] },
  resolveStatus?: (issues: ValidationIssue[]) => number,
): Response {
  const firstIssue = error.issues[0];
  const reasonMessage = firstIssue.message ?? "Validation failed";
  const status = resolveStatus?.(error.issues) ?? 400;

  logApiFailure({
    details: collectIssuePaths(error.issues),
    method: request.method,
    path: getRequestPath(request),
    reasonCategory: "validation",
    reasonMessage,
    status,
  });

  return Response.json({ error: "Validation failed", issues: error.issues, ok: false }, { status });
}

function handleUnmappedError(
  request: Request,
  error: unknown,
  onUnmappedError?: (error: unknown, request: Request) => Response | undefined,
): Response {
  const handled = onUnmappedError?.(error, request);

  if (handled) {
    return handled;
  }

  // An unmapped error is an unexpected server fault. Log the concrete cause
  // server-side, but return a generic message so internal details (e.g. a raw
  // database error such as "attempt to write a readonly database") never leak to
  // the client.
  const rawMessage = error instanceof Error ? error.message : "Internal server error";

  logApiFailure({
    method: request.method,
    path: getRequestPath(request),
    reasonCategory: "other",
    reasonMessage: rawMessage,
    status: 500,
  });

  return Response.json({ error: "Internal server error", ok: false }, { status: 500 });
}

export async function withDomainErrorJson(
  request: Request,
  handler: () => Promise<Response>,
  options: WithDomainErrorJsonOptions = {},
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Response) {
      return handleResponseThrow(request, error);
    }

    const mappedResponse = mapDomainErrorToJsonResponse(error);

    if (mappedResponse) {
      return handleMappedDomainError(request, error, mappedResponse);
    }

    if (isValidationError(error)) {
      return handleValidationError(request, error, options.validationStatus);
    }

    return handleUnmappedError(request, error, options.onUnmappedError);
  }
}

/**
 * Builds a React Router loader/action that rejects every request it receives
 * with a logged `405`.
 *
 * It closes the framework's silent `405` gap: a resource route that defines
 * only one of `loader`/`action` lets React Router answer the unsupported HTTP
 * verb (e.g. `POST` on a loader-only route, `GET` on an action-only route) with
 * a bare framework `405` that never reaches {@link logApiFailure} and never
 * returns the `{ ok: false }` JSON envelope. Registering this handler as the
 * missing counterpart routes those verbs through {@link withDomainErrorJson},
 * so they are logged as `method_not_allowed` and answered with JSON, exactly
 * like the explicit {@link requireMethod} rejections in the primary handler.
 *
 * @param allowedMethods - The methods served by the real counterpart handler.
 *   Used both for the `Allow` header and the thrown `405` message.
 * @returns A handler that always resolves to a logged `405` JSON response.
 */
export function methodNotAllowedHandler(
  ...allowedMethods: string[]
): (arguments_: { request: Request }) => Promise<Response> {
  return async ({ request }) =>
    withDomainErrorJson(request, () => {
      requireMethod(request, ...allowedMethods);

      // The real counterpart handler serves `allowedMethods`, so this stub only
      // runs for verbs `requireMethod` already rejected above. This throw is an
      // unreachable, type-level fallback.
      throw new Response(`Method ${request.method} not allowed`, {
        headers: { Allow: allowedMethods.join(", ") },
        status: 405,
      });
    });
}

export const mailerApi = {
  canTokenAccessConfig,
  canTokenAccessJob,
  canTokenAccessToken,
  createApplication,
  createApplicationToken,
  createToken,
  deleteJob,
  deleteToken,
  enqueueMail,
  getApplicationById,
  getJob,
  getJobDeliveryStatus,
  getJobDeliveryStatusForToken,
  getJobStatusView,
  getSmtpConfig,
  getTokenById,
  listApplications,
  listJobDeliveryStatuses,
  listJobDeliveryStatusesForToken,
  listJobs,
  listJobStatusViews,
  listSmtpConfigs,
  listTokensByConfig,
  lockSmtpConfig,
  pauseJob,
  resumeJob,
  retryJob,
  revokeToken,
  rotateToken,
  unlockSmtpConfig,
  updateTokenScopes,
  upsertSmtpConfig,
  validateSmtpConfig,
};
