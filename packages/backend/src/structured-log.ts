import type { ApiFailureReason, MailerErrorCategory, MailJobStatus } from "./types.js";

type StructuredLogEvent = "api_request_rejected" | "job_result";

// Writes exactly ONE JSON object per event to stdout so container log tooling
// (container logs, journald, …) can diagnose deliveries and rejected requests
// without a database round-trip.
//
// Payload discipline: only stable operational identifiers and categories are
// ever emitted here. Never recipients, subjects, bodies, headers, request
// bodies, secrets or token material.
function writeStructuredLog(event: StructuredLogEvent, fields: Record<string, unknown>): void {
  const payload: Record<string, unknown> = {
    event,
    ts: new Date().toISOString(),
    ...fields,
  };

  console.log(JSON.stringify(payload));
}

export type JobResultLog = {
  errorCategory?: MailerErrorCategory;
  errorCode?: string;
  jobId: string;
  retryCount?: number;
  status: MailJobStatus;
};

// Logs a single `job_result` event when a job reaches a terminal state
// (`sent`, `failed`, `retry_scheduled`, `delivery_uncertain`). Carries only the
// job identifier, status, error category/code and attempt count — never
// recipient, subject or payload data.
export function logJobResult(input: JobResultLog): void {
  const fields: Record<string, unknown> = {
    jobId: input.jobId,
    status: input.status,
  };

  if (input.errorCategory !== undefined) {
    fields.errorCategory = input.errorCategory;
  }

  if (input.errorCode !== undefined) {
    fields.errorCode = input.errorCode;
  }

  if (input.retryCount !== undefined) {
    fields.retryCount = input.retryCount;
  }

  writeStructuredLog("job_result", fields);
}

export type ApiRequestRejectedLog = {
  clientId?: string;
  method: string;
  path: string;
  reasonCategory: ApiFailureReason;
  status: number;
};

// Logs a single `api_request_rejected` event for every rejected API request
// (method-not-allowed, validation, auth, rate-limit, payload-too-large, …).
// Carries only status, reason category, client id, path and method — never
// request bodies, header values or secrets.
export function logApiRequestRejected(input: ApiRequestRejectedLog): void {
  const fields: Record<string, unknown> = {
    method: input.method,
    path: input.path,
    reasonCategory: input.reasonCategory,
    status: input.status,
  };

  if (input.clientId !== undefined) {
    fields.clientId = input.clientId;
  }

  writeStructuredLog("api_request_rejected", fields);
}
