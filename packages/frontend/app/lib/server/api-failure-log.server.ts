/* eslint-disable @typescript-eslint/strict-boolean-expressions -- Failure logging accepts heterogeneous optional fields and tolerates DB errors at runtime. */
import {
  type ApiFailureReason,
  logApiRequestRejected,
  recordApiFailure,
  type TokenKind,
} from "@relanto/backend";

const FAILURE_LOG_PREFIX = "[api-failure]";

export const API_FAILURE_LOGGED_HEADER = "X-Api-Failure-Logged";

export function markResponseAsLogged(response: Response): Response {
  response.headers.set(API_FAILURE_LOGGED_HEADER, "1");
  return response;
}

export function isResponseAlreadyLogged(response: Response): boolean {
  return response.headers.get(API_FAILURE_LOGGED_HEADER) === "1";
}

export type ThrownResponseBody = {
  reasonMessage: string;
  responseBody: Record<string, unknown>;
};

const UNKNOWN_ERROR_MESSAGE = "Unknown error";

function toPlainObject(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const result: Record<string, unknown> = {};

  for (const key of Object.keys(value)) {
    result[key] = Reflect.get(value, key);
  }

  return result;
}

/**
 * Decodes a thrown `Response` into a structured failure body. JSON responses
 * are parsed once so they are not re-encoded into a string-wrapped JSON blob,
 * while plain-text responses keep the legacy `{ error: "<text>" }` shape.
 *
 * Returned `responseBody` always wins over a parsed `ok` flag — callers add
 * `{ ok: false }` themselves and rely on this helper for the rest.
 */
export async function readThrownResponseBody(error: Response): Promise<ThrownResponseBody> {
  const contentType = error.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const parsed: unknown = await error.json();
      const parsedObject = toPlainObject(parsed);

      if (parsedObject) {
        const errorField = parsedObject.error;
        const reasonMessage = typeof errorField === "string" ? errorField : JSON.stringify(parsed);

        return { reasonMessage, responseBody: parsedObject };
      }

      const reasonMessage = JSON.stringify(parsed);

      return { reasonMessage, responseBody: { error: parsed } };
    } catch {
      return {
        reasonMessage: UNKNOWN_ERROR_MESSAGE,
        responseBody: { error: UNKNOWN_ERROR_MESSAGE },
      };
    }
  }

  const text = await error.text().catch(() => UNKNOWN_ERROR_MESSAGE);

  return { reasonMessage: text, responseBody: { error: text } };
}

export type ApiFailureLogInput = {
  applicationId?: string;
  clientId?: string;
  details?: Record<string, unknown>;
  method: string;
  path: string;
  reasonCategory: ApiFailureReason;
  reasonMessage: string;
  status: number;
  tokenId?: string;
  tokenKind?: TokenKind;
};

/**
 * Persistierte Felder sind eng begrenzt:
 * HTTP-Status, Pfad, Methode, Reason-Category, Reason-Message,
 * Client-/Token-/Applikations-Kennungen und kontrollierte `details`-Felder
 * (z. B. `issuePaths`, `expectedScope`). Niemals: Request-Body, Header-Werte,
 * Query-String-Inhalte, Zod-Issue-Values, Secret- oder Token-Material.
 */
function buildLogPayload(input: ApiFailureLogInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    method: input.method,
    path: input.path,
    reason: input.reasonCategory,
    reasonMessage: input.reasonMessage,
    status: input.status,
    ts: new Date().toISOString(),
  };

  if (input.clientId) {
    payload.clientId = input.clientId;
  }

  if (input.tokenId) {
    payload.tokenId = input.tokenId;
  }

  if (input.tokenKind) {
    payload.tokenKind = input.tokenKind;
  }

  if (input.applicationId) {
    payload.applicationId = input.applicationId;
  }

  if (input.details && Object.keys(input.details).length > 0) {
    payload.details = input.details;
  }

  return payload;
}

export function logApiFailure(input: ApiFailureLogInput): void {
  const payload = buildLogPayload(input);
  console.log(`${FAILURE_LOG_PREFIX} ${JSON.stringify(payload)}`);

  logApiRequestRejected({
    clientId: input.clientId,
    method: input.method,
    path: input.path,
    reasonCategory: input.reasonCategory,
    status: input.status,
  });

  try {
    recordApiFailure({
      applicationId: input.applicationId,
      clientId: input.clientId,
      details: input.details,
      httpStatus: input.status,
      reasonCategory: input.reasonCategory,
      reasonMessage: input.reasonMessage,
      requestMethod: input.method,
      requestPath: input.path,
      tokenId: input.tokenId,
      tokenKind: input.tokenKind,
    });
  } catch (error) {
    console.error(`${FAILURE_LOG_PREFIX} persist failed`, error);
  }
}
