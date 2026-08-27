/* oxlint-disable no-magic-numbers, sort-keys, typescript/explicit-function-return-type -- HTTP status codes are semantic literals; operation fields are grouped by meaning, not sorted; Zod builder return types are inferred. */
/* eslint-disable max-lines -- The route→operation registry is intentionally a single source of truth. */

/**
 * Single source of truth for the Relanto Mailer API's route→operation mapping.
 *
 * Two distinct consumers read from this module:
 * - **`generate.ts`** converts `operations` and the component-schema maps into
 *   a complete OpenAPI 3.1.1 document.
 * - **Coverage tests** iterate over `operations` to verify that every registered
 *   endpoint is exercised by the integration-test suite.
 *
 * Adding a new endpoint requires only one entry here; the generated spec and
 * the coverage assertions update automatically on the next build/test run.
 */
import { z } from "zod";

import {
  attachmentSchema,
  createApplicationInputSchema,
  deliveryFailureCategorySchema,
  deliveryModeSchema,
  deliveryStatusBatchInputSchema,
  deliveryStatusSchema,
  issueClientAccessTokenInputSchema,
  mailerErrorCategorySchema,
  mailJobStatusSchema,
  sendMailInputSchema,
  tlsVersionSchema,
  tokenKindSchema,
  type TokenScope,
  tokenScopeSchema,
  updateTokenScopesInputSchema,
  upsertSmtpConfigInputSchema,
} from "../types.js";
import {
  applicationAdminTokenSchema,
  applicationConfigResponseSchema,
  applicationResponseSchema,
  applicationSchema,
  applicationsListResponseSchema,
  applicationTokenSchema,
  configsListResponseSchema,
  configViewResponseSchema,
  createdApplicationAdminTokenSchema,
  createdApplicationTokenSchema,
  createdMailerTokenSchema,
  createdTokenResponseSchema,
  deliveryStatusBatchResponseSchema,
  deliveryStatusResponseSchema,
  deliveryStatusResultSchema,
  errorSchema,
  healthResponseSchema,
  issuedAccessTokenResponseSchema,
  issueSchema,
  jobResponseSchema,
  jobsListResponseSchema,
  jobStatusResponseSchema,
  mailAttachmentStatusMetadataSchema,
  mailerDebugAttemptSchema,
  mailerDebugInfoSchema,
  mailerErrorResultSchema,
  mailerTokenSchema,
  mailJobSchema,
  mailJobStatusViewSchema,
  metricsResponseSchema,
  okResponseSchema,
  publicSmtpConfigSchema,
  revokedTokenResponseSchema,
  sendMailResponseSchema,
  smtpConfigViewSchema,
  tokensListResponseSchema,
  tokenViewResponseSchema,
  tokenViewSchema,
  validateResponseSchema,
  validationResultSchema,
} from "./responses.js";

const RETENTION_MIN_DAYS = 1;
const RETENTION_MAX_DAYS = 365;
const RETENTION_DEFAULT_DAYS = 30;

/**
 * Returns a Zod number schema for a retention-days field with a shared 1–365
 * range and a default of 30. Centralised here so all four retention fields in
 * `createConfigTokenRequestSchema` produce consistent validation messages.
 *
 * @param field - Field name used in the validation error message.
 * @returns A Zod schema for the retention-days value.
 */
function retentionDaysField(field: string) {
  return z
    .number({ error: `${field} must be a number` })
    .int()
    .min(RETENTION_MIN_DAYS)
    .max(RETENTION_MAX_DAYS)
    .default(RETENTION_DEFAULT_DAYS);
}

/**
 * Request body for `POST /api/v1/configs/:configId/tokens`. The route hands the
 * `principalId`-based payload to `createToken` (a legacy input shape not covered
 * by a schema in `types.ts`), so it is modeled here for the spec.
 */
export const createConfigTokenRequestSchema = z.object({
  label: z.string().min(1),
  principalId: z.string().min(1),
  retainAttachmentsDays: retentionDaysField("retainAttachmentsDays"),
  retainErrorDetailsDays: retentionDaysField("retainErrorDetailsDays"),
  retainFailedJobsDays: retentionDaysField("retainFailedJobsDays"),
  retainSentJobsDays: retentionDaysField("retainSentJobsDays"),
  scopes: z.array(tokenScopeSchema).min(1),
});

// -----------------------------------------------------------------------------
// Component registries. Request bodies are converted with the JSON Schema
// "input" view (defaulted fields stay optional), responses with the "output"
// view (defaulted fields are always present). Shared enums appear in both so a
// single `#/components/schemas/*` reference resolves regardless of direction.
// -----------------------------------------------------------------------------

/**
 * Named Zod schemas for all request bodies and their shared building blocks.
 *
 * Converted with the `"input"` JSON Schema view so that fields with Zod
 * defaults remain optional in the OpenAPI spec, matching the wire behaviour
 * where callers may omit defaulted values.
 */
export const requestComponentSchemas: Record<string, z.ZodType> = {
  CreateApplicationInput: createApplicationInputSchema,
  CreateConfigTokenRequest: createConfigTokenRequestSchema,
  DeliveryStatusBatchInput: deliveryStatusBatchInputSchema,
  IssueClientAccessTokenInput: issueClientAccessTokenInputSchema,
  SendMailAttachment: attachmentSchema,
  SendMailInput: sendMailInputSchema,
  TlsVersion: tlsVersionSchema,
  TokenScope: tokenScopeSchema,
  UpdateTokenScopesInput: updateTokenScopesInputSchema,
  UpsertSmtpConfigInput: upsertSmtpConfigInputSchema,
};

/**
 * Named Zod schemas for all response bodies, entity types, and shared enums.
 *
 * Converted with the `"output"` JSON Schema view so that fields with Zod
 * defaults appear as required in the OpenAPI spec, matching the guaranteed
 * shape of every actual API response.
 */
export const responseComponentSchemas: Record<string, z.ZodType> = {
  Application: applicationSchema,
  ApplicationAdminToken: applicationAdminTokenSchema,
  ApplicationConfigResponse: applicationConfigResponseSchema,
  ApplicationResponse: applicationResponseSchema,
  ApplicationsListResponse: applicationsListResponseSchema,
  ApplicationToken: applicationTokenSchema,
  ConfigsListResponse: configsListResponseSchema,
  ConfigViewResponse: configViewResponseSchema,
  CreatedApplicationAdminToken: createdApplicationAdminTokenSchema,
  CreatedApplicationToken: createdApplicationTokenSchema,
  CreatedMailerToken: createdMailerTokenSchema,
  CreatedTokenResponse: createdTokenResponseSchema,
  DeliveryFailureCategory: deliveryFailureCategorySchema,
  DeliveryMode: deliveryModeSchema,
  DeliveryStatus: deliveryStatusSchema,
  DeliveryStatusBatchResponse: deliveryStatusBatchResponseSchema,
  DeliveryStatusResponse: deliveryStatusResponseSchema,
  DeliveryStatusResult: deliveryStatusResultSchema,
  Error: errorSchema,
  HealthResponse: healthResponseSchema,
  Issue: issueSchema,
  IssuedAccessToken: issuedAccessTokenResponseSchema,
  JobResponse: jobResponseSchema,
  JobsListResponse: jobsListResponseSchema,
  JobStatusResponse: jobStatusResponseSchema,
  MailAttachment: attachmentSchema,
  MailAttachmentStatusMetadata: mailAttachmentStatusMetadataSchema,
  MailerDebugAttempt: mailerDebugAttemptSchema,
  MailerDebugInfo: mailerDebugInfoSchema,
  MailerErrorCategory: mailerErrorCategorySchema,
  MailerErrorResult: mailerErrorResultSchema,
  MailerToken: mailerTokenSchema,
  MailJob: mailJobSchema,
  MailJobStatus: mailJobStatusSchema,
  MailJobStatusView: mailJobStatusViewSchema,
  MetricsResponse: metricsResponseSchema,
  OkResponse: okResponseSchema,
  PublicSmtpConfig: publicSmtpConfigSchema,
  RevokedTokenResponse: revokedTokenResponseSchema,
  SendMailResponse: sendMailResponseSchema,
  SmtpConfigView: smtpConfigViewSchema,
  TlsVersion: tlsVersionSchema,
  TokenKind: tokenKindSchema,
  TokenScope: tokenScopeSchema,
  TokensListResponse: tokensListResponseSchema,
  TokenView: tokenViewSchema,
  TokenViewResponse: tokenViewResponseSchema,
  ValidateResponse: validateResponseSchema,
  ValidationResult: validationResultSchema,
};

// -----------------------------------------------------------------------------
// Operations
// -----------------------------------------------------------------------------

/** HTTP methods used by the operations in this registry. */
export type HttpMethod = "delete" | "get" | "patch" | "post" | "put";

/**
 * A single path or query parameter in the OpenAPI 3.1 parameter-object shape.
 * Path parameters are always required; query parameters default to optional in
 * this registry (see `queryParameter` helper).
 */
export type OperationParameter = {
  description: string;
  in: "path" | "query";
  name: string;
  required: boolean;
  schema: Record<string, unknown>;
};

/**
 * Maps a single HTTP status code to its human-readable description and the
 * name of a component schema (a key in `responseComponentSchemas`) that
 * describes the response body in the generated spec.
 */
export type OperationResponse = {
  description: string;
  schema: string;
};

/**
 * Full description of one API endpoint, as registered in the `operations` array.
 *
 * @property path - URL path, may contain `{param}` placeholders.
 * @property method - HTTP method.
 * @property operationId - Stable camelCase identifier used in the generated
 *   spec and as the key in the endpoint-coverage test matrix.
 * @property requestBody - Name of a component schema (key in
 *   `requestComponentSchemas`) for the JSON request body, if any.
 * @property parameters - Path and query parameters for this operation.
 * @property responses - Map from HTTP status code to `OperationResponse`. Every
 *   operation should include at least a success status and 500.
 * @property scope - Required `TokenScope` the bearer token must carry, or
 *   `null` for public endpoints. The generator appends this to the operation
 *   description so callers can see it in the rendered spec.
 * @property security - `"bearer"` to emit a `bearerAuth` security requirement;
 *   `"none"` for unauthenticated endpoints (e.g. `/health`).
 * @property summary - Short, human-readable operation title (shown in spec UIs).
 * @property description - Longer description. The generator automatically
 *   appends the required scope note when `scope` is non-null.
 * @property tags - OpenAPI tags used to group operations in the rendered spec.
 */
export type ApiOperation = {
  description: string;
  method: HttpMethod;
  operationId: string;
  parameters?: OperationParameter[];
  path: string;
  requestBody?: string;
  responses: Record<number, OperationResponse>;
  scope: null | TokenScope;
  security: "bearer" | "none";
  summary: string;
  tags: string[];
};

function pathParameter(name: string, description: string): OperationParameter {
  return { description, in: "path", name, required: true, schema: { type: "string" } };
}

function queryParameter(
  name: string,
  description: string,
  schema: Record<string, unknown> = { type: "string" },
): OperationParameter {
  return { description, in: "query", name, required: false, schema };
}

function error(description: string): OperationResponse {
  return { description, schema: "Error" };
}

// Reused error descriptions, extracted so a single literal is not duplicated.
const MSG_UNAUTHENTICATED = "Missing or invalid authentication.";
const MSG_SERVER_ERROR = "Unexpected server error.";
const MSG_VALIDATION = "Validation error.";
const MSG_OWNERSHIP = "Ownership violation.";
const MSG_CONFIG_NOT_FOUND = "SMTP config not found.";
const MSG_TOKEN_NOT_FOUND = "Token not found.";
const MSG_JOB_NOT_FOUND = "Job not found.";

const jobIdParameter = pathParameter("jobId", "Identifier of the mail job.");
const configIdParameter = pathParameter("configId", "Identifier of the SMTP config.");
const tokenIdParameter = pathParameter("tokenId", "Identifier of the token.");

// Shared 401/403/500 response map spread into every authenticated operation so
// each entry does not repeat the same three error lines.
const AUTH_ERRORS = {
  401: error(MSG_UNAUTHENTICATED),
  403: error("Scope or ownership violation."),
  500: error(MSG_SERVER_ERROR),
} as const;

/**
 * The complete list of API operations that make up the Relanto Mailer HTTP API.
 *
 * This array is the authoritative source for both the OpenAPI spec generator
 * (`generate.ts`) and the endpoint-coverage assertions in the test suite.
 * Operations are ordered by resource group: Authentication → Mail → Jobs →
 * Configuration → Applications → Tokens → Monitoring.
 */
export const operations: ApiOperation[] = [
  {
    description: "Exchanges client credentials for a short-lived bearer access token.",
    method: "post",
    operationId: "issueAccessToken",
    path: "/api/v1/token",
    requestBody: "IssueClientAccessTokenInput",
    responses: {
      200: { description: "Access token issued.", schema: "IssuedAccessToken" },
      400: error("Missing or empty clientId/clientSecret."),
      401: error("Invalid or revoked client credentials."),
      413: error("Request body exceeds the maximum allowed size."),
      429: error("Rate limit exceeded."),
      500: error(MSG_SERVER_ERROR),
    },
    scope: null,
    security: "none",
    summary: "Issue an access token",
    tags: ["Authentication"],
  },
  {
    description: "Enqueues a mail job (or sends it directly). Only application tokens may send.",
    method: "post",
    operationId: "sendMail",
    path: "/api/v1/send",
    requestBody: "SendMailInput",
    responses: {
      200: { description: "Mail accepted (queued) or sent (direct).", schema: "SendMailResponse" },
      400: error(MSG_VALIDATION),
      401: error(MSG_UNAUTHENTICATED),
      403: error("System-admin session or application-admin token cannot send mail."),
      404: error("SMTP config or application not found."),
      409: { description: "Direct send did not end in 'sent'.", schema: "SendMailResponse" },
      413: error("Attachment or payload size exceeded."),
      429: error("Rate limit exceeded."),
      500: error(MSG_SERVER_ERROR),
    },
    scope: "send",
    security: "bearer",
    summary: "Send mail",
    tags: ["Mail"],
  },
  {
    description: "Returns the application-facing SMTP config (without username).",
    method: "get",
    operationId: "readApplicationConfig",
    path: "/api/v1/config",
    responses: {
      200: { description: "The application SMTP config.", schema: "ApplicationConfigResponse" },
      401: error(MSG_UNAUTHENTICATED),
      403: error("Only application tokens may read the application config."),
      404: error(MSG_CONFIG_NOT_FOUND),
      500: error(MSG_SERVER_ERROR),
    },
    scope: "readConfig",
    security: "bearer",
    summary: "Read the application SMTP config",
    tags: ["Configuration"],
  },
  {
    description: "Lists mail job status views scoped to the caller.",
    method: "get",
    operationId: "listJobs",
    parameters: [
      queryParameter("applicationId", "Restrict by application (ignored for application tokens)."),
      queryParameter("configId", "Restrict by SMTP config."),
      queryParameter("createdAfter", "Only jobs created strictly after this ISO 8601 instant."),
      queryParameter("createdBefore", "Only jobs created strictly before this ISO 8601 instant."),
      queryParameter("messageId", "Exact match on the mail Message-ID."),
      queryParameter("status", "Restrict by job status.", {
        $ref: "#/components/schemas/MailJobStatus",
      }),
    ],
    path: "/api/v1/jobs",
    responses: {
      200: { description: "List of mail job status views.", schema: "JobsListResponse" },
      400: error("Invalid query parameter."),
      401: error(MSG_UNAUTHENTICATED),
      403: error("Scope violation."),
      500: error(MSG_SERVER_ERROR),
    },
    scope: "readStatus",
    security: "bearer",
    summary: "List mail jobs",
    tags: ["Jobs"],
  },
  {
    description:
      "Returns delivery-status polling results for a bounded list of known job IDs. Unknown, deleted or retention-purged IDs are returned as per-job 'unknown' results.",
    method: "post",
    operationId: "readJobDeliveryStatuses",
    path: "/api/v1/jobs/delivery-status",
    requestBody: "DeliveryStatusBatchInput",
    responses: {
      200: {
        description: "Per-job delivery-status polling results in request order.",
        schema: "DeliveryStatusBatchResponse",
      },
      400: error("Invalid batch request."),
      401: error(MSG_UNAUTHENTICATED),
      403: error("Scope or ownership violation."),
      413: error("Request body exceeds the maximum allowed size."),
      500: error(MSG_SERVER_ERROR),
    },
    scope: "readStatus",
    security: "bearer",
    summary: "Read delivery statuses",
    tags: ["Jobs"],
  },
  {
    description: "Returns the status view of a single owned mail job.",
    method: "get",
    operationId: "readJob",
    parameters: [jobIdParameter],
    path: "/api/v1/jobs/{jobId}",
    responses: {
      200: { description: "The mail job status view.", schema: "JobStatusResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_JOB_NOT_FOUND),
    },
    scope: "readStatus",
    security: "bearer",
    summary: "Read a mail job",
    tags: ["Jobs"],
  },
  {
    description:
      "Returns the client-facing delivery status for a single job ID. Unknown, deleted or retention-purged IDs are returned as an 'unknown' result.",
    method: "get",
    operationId: "readJobDeliveryStatus",
    parameters: [jobIdParameter],
    path: "/api/v1/jobs/{jobId}/delivery-status",
    responses: {
      200: { description: "The delivery-status polling result.", schema: "DeliveryStatusResponse" },
      ...AUTH_ERRORS,
    },
    scope: "readStatus",
    security: "bearer",
    summary: "Read a job delivery status",
    tags: ["Jobs"],
  },
  {
    description: "Deletes an owned mail job that is neither processing nor sent.",
    method: "delete",
    operationId: "deleteJob",
    parameters: [jobIdParameter],
    path: "/api/v1/jobs/{jobId}",
    responses: {
      200: { description: "Job deleted.", schema: "OkResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_JOB_NOT_FOUND),
      409: error("Processing or sent jobs cannot be deleted."),
    },
    scope: "manageApplications",
    security: "bearer",
    summary: "Delete a mail job",
    tags: ["Jobs"],
  },
  {
    description: "Pauses a pending mail job.",
    method: "post",
    operationId: "pauseJob",
    parameters: [jobIdParameter],
    path: "/api/v1/jobs/{jobId}/pause",
    responses: {
      200: { description: "The paused job.", schema: "JobResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_JOB_NOT_FOUND),
      409: error("Only pending jobs can be paused."),
    },
    scope: "manageApplications",
    security: "bearer",
    summary: "Pause a mail job",
    tags: ["Jobs"],
  },
  {
    description: "Resumes a paused mail job.",
    method: "post",
    operationId: "resumeJob",
    parameters: [jobIdParameter],
    path: "/api/v1/jobs/{jobId}/resume",
    responses: {
      200: { description: "The resumed job.", schema: "JobResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_JOB_NOT_FOUND),
      409: error("Only paused jobs can be resumed."),
    },
    scope: "manageApplications",
    security: "bearer",
    summary: "Resume a mail job",
    tags: ["Jobs"],
  },
  {
    description: "Manually retries a failed or uncertain mail job.",
    method: "post",
    operationId: "retryJob",
    parameters: [jobIdParameter],
    path: "/api/v1/jobs/{jobId}/retry",
    responses: {
      200: { description: "The retried job.", schema: "JobResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_JOB_NOT_FOUND),
      409: error("Only failed or uncertain jobs can be retried manually."),
    },
    scope: "manageApplications",
    security: "bearer",
    summary: "Retry a mail job",
    tags: ["Jobs"],
  },
  {
    description: "Lists applications visible to the caller.",
    method: "get",
    operationId: "listApplications",
    path: "/api/v1/applications",
    responses: {
      200: { description: "List of applications.", schema: "ApplicationsListResponse" },
      ...AUTH_ERRORS,
    },
    scope: "manageApplications",
    security: "bearer",
    summary: "List applications",
    tags: ["Applications"],
  },
  {
    description: "Creates a new application under an application admin.",
    method: "post",
    operationId: "createApplication",
    path: "/api/v1/applications",
    requestBody: "CreateApplicationInput",
    responses: {
      201: { description: "The created application.", schema: "ApplicationResponse" },
      400: error(MSG_VALIDATION),
      401: error(MSG_UNAUTHENTICATED),
      403: error("Application tokens cannot create applications."),
      404: error("Application admin not found."),
      500: error(MSG_SERVER_ERROR),
    },
    scope: "manageApplications",
    security: "bearer",
    summary: "Create an application",
    tags: ["Applications"],
  },
  {
    description: "Lists SMTP configs visible to the caller.",
    method: "get",
    operationId: "listConfigs",
    path: "/api/v1/configs",
    responses: {
      200: { description: "List of SMTP config views.", schema: "ConfigsListResponse" },
      ...AUTH_ERRORS,
    },
    scope: "manageApplications",
    security: "bearer",
    summary: "List SMTP configs",
    tags: ["Configuration"],
  },
  {
    description: "Creates a new SMTP config for an application.",
    method: "post",
    operationId: "createConfig",
    path: "/api/v1/configs",
    requestBody: "UpsertSmtpConfigInput",
    responses: {
      201: { description: "The created SMTP config view.", schema: "ConfigViewResponse" },
      400: error(MSG_VALIDATION),
      401: error(MSG_UNAUTHENTICATED),
      403: error("Application tokens cannot create SMTP configs."),
      404: error("Application not found."),
      409: error("SMTP config application cannot be changed."),
      423: error("SMTP config is locked."),
      500: error(MSG_SERVER_ERROR),
    },
    scope: "manageApplications",
    security: "bearer",
    summary: "Create an SMTP config",
    tags: ["Configuration"],
  },
  {
    description: "Returns a single SMTP config view (admin-side, with username).",
    method: "get",
    operationId: "readConfig",
    parameters: [configIdParameter],
    path: "/api/v1/configs/{configId}",
    responses: {
      200: { description: "The SMTP config view.", schema: "ConfigViewResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_CONFIG_NOT_FOUND),
    },
    scope: "manageApplications",
    security: "bearer",
    summary: "Read an SMTP config",
    tags: ["Configuration"],
  },
  {
    description: "Replaces an SMTP config with a full representation.",
    method: "put",
    operationId: "updateConfig",
    parameters: [configIdParameter],
    path: "/api/v1/configs/{configId}",
    requestBody: "UpsertSmtpConfigInput",
    responses: {
      200: { description: "The updated SMTP config view.", schema: "ConfigViewResponse" },
      400: error(MSG_VALIDATION),
      401: error(MSG_UNAUTHENTICATED),
      403: error(MSG_OWNERSHIP),
      404: error(MSG_CONFIG_NOT_FOUND),
      409: error("SMTP config application cannot be changed."),
      423: error("SMTP config is locked."),
      500: error(MSG_SERVER_ERROR),
    },
    scope: "manageApplications",
    security: "bearer",
    summary: "Update an SMTP config",
    tags: ["Configuration"],
  },
  {
    description: "Verifies connectivity of an SMTP config and returns the result.",
    method: "post",
    operationId: "validateConfig",
    parameters: [configIdParameter],
    path: "/api/v1/configs/{configId}/validate",
    responses: {
      200: { description: "The validation result.", schema: "ValidateResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_CONFIG_NOT_FOUND),
    },
    scope: "validate",
    security: "bearer",
    summary: "Validate an SMTP config",
    tags: ["Configuration"],
  },
  {
    description: "Lists the tokens issued for an SMTP config.",
    method: "get",
    operationId: "listConfigTokens",
    parameters: [configIdParameter],
    path: "/api/v1/configs/{configId}/tokens",
    responses: {
      200: { description: "List of tokens.", schema: "TokensListResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_CONFIG_NOT_FOUND),
    },
    scope: "manageTokens",
    security: "bearer",
    summary: "List tokens for a config",
    tags: ["Tokens"],
  },
  {
    description: "Issues a new application or application-admin token for an SMTP config.",
    method: "post",
    operationId: "createConfigToken",
    parameters: [configIdParameter],
    path: "/api/v1/configs/{configId}/tokens",
    requestBody: "CreateConfigTokenRequest",
    responses: {
      201: {
        description: "The created token (with clientSecret).",
        schema: "CreatedTokenResponse",
      },
      400: error("Validation error or invalid scopes."),
      401: error(MSG_UNAUTHENTICATED),
      403: error(MSG_OWNERSHIP),
      404: error(MSG_CONFIG_NOT_FOUND),
      409: error("Application requires an SMTP config before tokens can be issued."),
      500: error(MSG_SERVER_ERROR),
    },
    scope: "manageTokens",
    security: "bearer",
    summary: "Create a token for a config",
    tags: ["Tokens"],
  },
  {
    description: "Revokes a token so it can no longer be exchanged for access tokens.",
    method: "post",
    operationId: "revokeToken",
    parameters: [tokenIdParameter],
    path: "/api/v1/tokens/{tokenId}/revoke",
    responses: {
      200: { description: "The revoked token.", schema: "RevokedTokenResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_TOKEN_NOT_FOUND),
    },
    scope: "manageTokens",
    security: "bearer",
    summary: "Revoke a token",
    tags: ["Tokens"],
  },
  {
    description: "Rotates a token's secret and returns the new clientSecret.",
    method: "post",
    operationId: "rotateToken",
    parameters: [tokenIdParameter],
    path: "/api/v1/tokens/{tokenId}/rotate",
    responses: {
      200: {
        description: "The rotated token (with clientSecret).",
        schema: "CreatedTokenResponse",
      },
      ...AUTH_ERRORS,
      404: error(MSG_TOKEN_NOT_FOUND),
    },
    scope: "manageTokens",
    security: "bearer",
    summary: "Rotate a token",
    tags: ["Tokens"],
  },
  {
    description: "Replaces the scope set of a token.",
    method: "patch",
    operationId: "updateTokenScopes",
    parameters: [tokenIdParameter],
    path: "/api/v1/tokens/{tokenId}/scopes",
    requestBody: "UpdateTokenScopesInput",
    responses: {
      200: { description: "The updated token.", schema: "TokenViewResponse" },
      400: error("Validation error or invalid scopes."),
      401: error(MSG_UNAUTHENTICATED),
      403: error(MSG_OWNERSHIP),
      404: error(MSG_TOKEN_NOT_FOUND),
      500: error(MSG_SERVER_ERROR),
    },
    scope: "manageTokens",
    security: "bearer",
    summary: "Update token scopes",
    tags: ["Tokens"],
  },
  {
    description: "Returns a single token's metadata.",
    method: "get",
    operationId: "readToken",
    parameters: [tokenIdParameter],
    path: "/api/v1/tokens/{tokenId}",
    responses: {
      200: { description: "The token metadata.", schema: "TokenViewResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_TOKEN_NOT_FOUND),
    },
    scope: "manageTokens",
    security: "bearer",
    summary: "Read a token",
    tags: ["Tokens"],
  },
  {
    description: "Permanently deletes a token.",
    method: "delete",
    operationId: "deleteToken",
    parameters: [tokenIdParameter],
    path: "/api/v1/tokens/{tokenId}",
    responses: {
      200: { description: "Token deleted.", schema: "OkResponse" },
      ...AUTH_ERRORS,
      404: error(MSG_TOKEN_NOT_FOUND),
    },
    scope: "manageTokens",
    security: "bearer",
    summary: "Delete a token",
    tags: ["Tokens"],
  },
  {
    description: "Reports database and worker health. No authentication required.",
    method: "get",
    operationId: "healthCheck",
    path: "/health",
    responses: {
      200: { description: "Service healthy.", schema: "HealthResponse" },
      503: { description: "Service unhealthy.", schema: "HealthResponse" },
    },
    scope: null,
    security: "none",
    summary: "Health check",
    tags: ["Monitoring"],
  },
  {
    description:
      "Returns operational metrics. Requires the static METRICS_TOKEN as a bearer token.",
    method: "get",
    operationId: "metrics",
    path: "/metrics",
    responses: {
      200: { description: "Metrics snapshot.", schema: "MetricsResponse" },
      401: error("Missing authorization."),
      403: error("Invalid metrics token."),
      404: error("Metrics endpoint disabled."),
      503: error("Failed to collect metrics."),
    },
    scope: null,
    security: "bearer",
    summary: "Operational metrics",
    tags: ["Monitoring"],
  },
];
