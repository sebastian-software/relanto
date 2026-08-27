/* eslint-disable max-lines -- Response schemas and their compile-time conformance assertions intentionally live together. */

/**
 * Zod schemas for all API response bodies and their constituent entity types.
 *
 * The schemas serve two purposes:
 *
 * **1. OpenAPI component generation** – `registry.ts` exports these schemas as
 * `responseComponentSchemas`. The generator converts them to JSON Schema
 * draft-2020-12 via `z.toJSONSchema` with the `"output"` view so that fields
 * carrying Zod defaults are marked required in the spec.
 *
 * **2. Compile-time drift guard** – `ResponseSchemaConformance` at the bottom
 * of this module uses the `Equal`/`Expect`/`Simplify` helpers to assert at
 * `tsc` time that every Zod schema is structurally identical to the canonical
 * TypeScript type in `types.ts`. If a type evolves without a matching schema
 * update, the typecheck fails and flags the drift immediately.
 */
import { z } from "zod";

import {
  type Application,
  type ApplicationAdminToken,
  type ApplicationToken,
  attachmentSchema,
  type CreatedApplicationAdminToken,
  type CreatedApplicationToken,
  type CreatedMailerToken,
  deliveryFailureCategorySchema,
  deliveryModeSchema,
  type DeliveryStatusResult,
  deliveryStatusSchema,
  type IssuedAccessToken,
  type MailAttachmentStatusMetadata,
  type MailerDebugAttempt,
  type MailerDebugInfo,
  mailerErrorCategorySchema,
  type MailerErrorResult,
  type MailerToken,
  type MailJob,
  mailJobStatusSchema,
  type MailJobStatusView,
  type SmtpConfigView,
  tlsVersionSchema,
  tokenKindSchema,
  tokenScopeSchema,
} from "../types.js";

// -----------------------------------------------------------------------------
// Shared building blocks
// -----------------------------------------------------------------------------

const healthStatusSchema = z.enum(["healthy", "unhealthy"]);

/**
 * A single validation issue, mirroring the shape produced by the backend Zod
 * schemas and surfaced through the `issues` array of the error envelope.
 */
export const issueSchema = z.object({
  message: z.string().optional(),
  path: z.array(z.union([z.string(), z.number()])).optional(),
});

/**
 * The unified error envelope returned by every endpoint on failure. Mirrors the
 * `{ ok: false, error, issues? }` shape assembled in `api._shared.ts`.
 */
export const errorSchema = z.object({
  error: z.string(),
  issues: z.array(issueSchema).optional(),
  ok: z.literal(false),
});

// -----------------------------------------------------------------------------
// Entity schemas (mirroring the canonical TS types in types.ts)
// -----------------------------------------------------------------------------

export const applicationSchema = z.object({
  applicationAdminId: z.string(),
  createdAt: z.string(),
  id: z.string(),
  label: z.string(),
  updatedAt: z.string(),
});

export const smtpConfigViewSchema = z.object({
  applicationAdminId: z.string(),
  applicationId: z.string(),
  applicationLabel: z.string(),
  connectionTimeoutMs: z.number().int(),
  createdAt: z.string(),
  defaultFromAddress: z.string(),
  disabledAt: z.string().optional(),
  greetingTimeoutMs: z.number().int(),
  hasPassword: z.boolean(),
  host: z.string(),
  id: z.string(),
  lockedAt: z.string().optional(),
  minTlsVersion: tlsVersionSchema,
  name: z.string(),
  port: z.number().int(),
  requireTls: z.boolean(),
  secure: z.boolean(),
  sendRateLimitPerMinute: z.number().int(),
  socketTimeoutMs: z.number().int(),
  updatedAt: z.string(),
  username: z.string(),
});

/**
 * The application-facing SMTP config view returned by `GET /api/v1/config`. It
 * suppresses `username` in addition to the always-hidden secret columns.
 */
export const publicSmtpConfigSchema = smtpConfigViewSchema.omit({ username: true });

/**
 * Attachment metadata exposed on the job status view (payload removed).
 */
export const mailAttachmentStatusMetadataSchema = attachmentSchema.omit({ contentBase64: true });

export const mailJobSchema = z.object({
  acceptedAt: z.string().optional(),
  applicationId: z.string(),
  attachments: z.array(attachmentSchema),
  configId: z.string(),
  createdAt: z.string(),
  deletedAt: z.string().optional(),
  deliveryMode: deliveryModeSchema,
  errorCategory: mailerErrorCategorySchema.optional(),
  errorCode: z.string().optional(),
  errorPermanent: z.boolean().optional(),
  from: z.string(),
  headers: z.record(z.string(), z.string()),
  html: z.string(),
  id: z.string(),
  idempotencyKey: z.string().optional(),
  lastError: z.string().optional(),
  messageId: z.string(),
  nextRetryAt: z.string().optional(),
  processingStartedAt: z.string().optional(),
  providerMessageId: z.string().optional(),
  providerResponseCode: z.number().int().optional(),
  retryCount: z.number().int(),
  sentAt: z.string().optional(),
  status: mailJobStatusSchema,
  subject: z.string(),
  text: z.string(),
  to: z.string(),
  tokenId: z.string().optional(),
  tokenKind: tokenKindSchema.optional(),
  updatedAt: z.string(),
});

/**
 * Status view of a mail job as returned by the list/read-status endpoints.
 * Strips the large payload fields (`html`, `text`, `headers`, and the raw
 * `attachments` array) and replaces `attachments` with metadata-only entries
 * (no `contentBase64`) to keep the response lean.
 */
export const mailJobStatusViewSchema = mailJobSchema
  .omit({ attachments: true, headers: true, html: true, text: true })
  .extend({ attachments: z.array(mailAttachmentStatusMetadataSchema) });

export const deliveryStatusResultSchema = z.object({
  deliveryStatus: deliveryStatusSchema,
  errorCode: z.string().optional(),
  failureCategory: deliveryFailureCategorySchema.optional(),
  failureReason: z.string().optional(),
  jobId: z.string(),
  jobStatus: mailJobStatusSchema.optional(),
  nextRetryAt: z.string().optional(),
  providerMessageId: z.string().optional(),
  providerResponseCode: z.number().int().optional(),
  retryCount: z.number().int().optional(),
  sentAt: z.string().optional(),
  terminal: z.boolean(),
  updatedAt: z.string().optional(),
});

export const mailerTokenSchema = z.object({
  clientId: z.string(),
  createdAt: z.string(),
  id: z.string(),
  kind: tokenKindSchema,
  label: z.string(),
  lastUsedAt: z.string().optional(),
  revokedAt: z.string().optional(),
  scopes: z.array(tokenScopeSchema),
  updatedAt: z.string(),
});

/**
 * An application-admin token. Extends the base `mailerTokenSchema` with the
 * `applicationAdminId` owner field and narrows `kind` to the literal
 * `"applicationAdmin"` to act as a discriminant in union types.
 */
export const applicationAdminTokenSchema = mailerTokenSchema
  .omit({ kind: true })
  .extend({ applicationAdminId: z.string(), kind: z.literal("applicationAdmin") });

/**
 * An application-scoped token. Adds `applicationId` (required) and `configId`
 * (optional – only set when the token is bound to a specific SMTP config) and
 * narrows `kind` to `"application"`.
 */
export const applicationTokenSchema = mailerTokenSchema.omit({ kind: true }).extend({
  applicationId: z.string(),
  configId: z.string().optional(),
  kind: z.literal("application"),
});

/**
 * Application-admin token as returned immediately after creation. Extends
 * `applicationAdminTokenSchema` with `clientSecret`, which the API exposes only
 * once at creation time and never returns again.
 */
export const createdApplicationAdminTokenSchema = applicationAdminTokenSchema.extend({
  clientSecret: z.string(),
});

/**
 * Application token as returned immediately after creation. Extends
 * `applicationTokenSchema` with `clientSecret`, which the API exposes only once
 * at creation time and never returns again.
 */
export const createdApplicationTokenSchema = applicationTokenSchema.extend({
  clientSecret: z.string(),
});

/**
 * Discriminated union of both created-token shapes (application-admin and
 * application). The `kind` field identifies which variant was returned.
 */
export const createdMailerTokenSchema = z.union([
  createdApplicationAdminTokenSchema,
  createdApplicationTokenSchema,
]);

/**
 * A stored token as returned by the read/update-scopes endpoints.
 */
export const tokenViewSchema = z.union([applicationAdminTokenSchema, applicationTokenSchema]);

export const issuedAccessTokenSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  ok: z.literal(true),
  tokenType: z.literal("Bearer"),
});

export const mailerDebugAttemptSchema = z.object({
  address: z.string(),
  code: z.string().optional(),
  family: z.number(),
  message: z.string().optional(),
  outcome: z.enum(["failed", "succeeded"]),
  phase: z.enum(["send", "verify"]),
});

export const mailerDebugInfoSchema = z.object({
  attempts: z.array(mailerDebugAttemptSchema),
  host: z.string(),
  minTlsVersion: tlsVersionSchema,
  port: z.number(),
  requireTls: z.boolean(),
  resolvedTargets: z.array(z.string()),
  secure: z.boolean(),
});

export const mailerErrorResultSchema = z.object({
  category: mailerErrorCategorySchema,
  code: z.string().optional(),
  debug: mailerDebugInfoSchema.optional(),
  message: z.string(),
  ok: z.literal(false),
  permanent: z.boolean(),
  providerResponseCode: z.number().optional(),
  retryAfterMs: z.number().optional(),
});

/**
 * Result body of `POST /api/v1/configs/:configId/validate`: either a bare
 * success marker or a classified mailer error.
 */
export const validationResultSchema = z.union([
  z.object({ ok: z.literal(true) }),
  mailerErrorResultSchema,
]);

// -----------------------------------------------------------------------------
// Envelope schemas (the actual JSON bodies returned by the endpoints)
// -----------------------------------------------------------------------------

export const okResponseSchema = z.object({ ok: z.literal(true) });

export const issuedAccessTokenResponseSchema = issuedAccessTokenSchema;

export const sendMailResponseSchema = z.object({
  acceptedAt: z.string().optional(),
  jobId: z.string(),
  ok: z.boolean(),
  status: mailJobStatusSchema,
});

export const applicationConfigResponseSchema = z.object({
  config: publicSmtpConfigSchema,
  ok: z.literal(true),
});

export const configViewResponseSchema = z.object({
  config: smtpConfigViewSchema,
  ok: z.literal(true),
});

export const configsListResponseSchema = z.object({
  configs: z.array(smtpConfigViewSchema),
  ok: z.literal(true),
});

export const jobsListResponseSchema = z.object({
  jobs: z.array(mailJobStatusViewSchema),
  ok: z.literal(true),
});

export const jobStatusResponseSchema = z.object({
  job: mailJobStatusViewSchema,
  ok: z.literal(true),
});

export const deliveryStatusResponseSchema = z.object({
  ok: z.literal(true),
  status: deliveryStatusResultSchema,
});

export const deliveryStatusBatchResponseSchema = z.object({
  ok: z.literal(true),
  statuses: z.array(deliveryStatusResultSchema),
});

export const jobResponseSchema = z.object({
  job: mailJobSchema,
  ok: z.literal(true),
});

export const applicationsListResponseSchema = z.object({
  applications: z.array(applicationSchema),
  ok: z.literal(true),
});

export const applicationResponseSchema = z.object({
  application: applicationSchema,
  ok: z.literal(true),
});

export const validateResponseSchema = z.object({
  ok: z.literal(true),
  result: validationResultSchema,
});

export const tokensListResponseSchema = z.object({
  ok: z.literal(true),
  tokens: z.array(mailerTokenSchema),
});

export const createdTokenResponseSchema = z.object({
  ok: z.literal(true),
  token: createdMailerTokenSchema,
});

export const tokenViewResponseSchema = z.object({
  ok: z.literal(true),
  token: tokenViewSchema,
});

export const revokedTokenResponseSchema = z.object({
  ok: z.literal(true),
  token: mailerTokenSchema,
});

export const healthResponseSchema = z.object({
  hash: z.string().optional(),
  status: healthStatusSchema,
  version: z.string(),
});

export const metricsResponseSchema = z.object({
  activity: z.object({
    failed_last_hour: z.number().int(),
    last_sent_at: z.string().nullable(),
    oldest_pending_at: z.string().nullable(),
    sent_last_hour: z.number().int(),
  }),
  checks: z.object({
    database: z.object({
      latency_ms: z.number(),
      size_bytes: z.number().int().nullable(),
      status: healthStatusSchema,
    }),
    worker: z.object({
      interval_ms: z.number().int(),
      last_tick_age_ms: z.number().int().nullable(),
      last_tick_at: z.string().nullable(),
      status: healthStatusSchema,
    }),
  }),
  errors_last_hour: z.record(z.string(), z.number()),
  hash: z.string().optional(),
  ok: z.literal(true),
  process: z.object({
    memory_heap_used_bytes: z.number().int(),
    memory_rss_bytes: z.number().int(),
  }),
  queue: z.record(z.string(), z.number()),
  services: z.object({
    active: z.number().int(),
    degraded: z.number().int(),
    total: z.number().int(),
  }),
  uptime_seconds: z.number().int(),
  version: z.string(),
});

// -----------------------------------------------------------------------------
// Compile-time conformance: keep the Zod response schemas in lock-step with the
// canonical TS types. Any drift makes `Equal<…>` resolve to `false`, which
// `Expect<true>` then rejects during `tsc`, breaking the typecheck.
// -----------------------------------------------------------------------------

// `Simplify` flattens intersection types (e.g. `{ … } & SmtpConfig`) into a
// single object type so they compare identically to the flat object type that
// Zod's `.extend()`/`.omit()` inference produces.
type Simplify<T> = { [K in keyof T]: T[K] };
// The single-use `T` on each side is the standard type-equality idiom; the
// parameter must stay to make the two function types structurally comparable.
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- Type-equality identity trick. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */
type Expect<T extends true> = T;

/**
 * A tuple type whose sole purpose is to enforce compile-time conformance
 * between the Zod schemas above and their canonical TypeScript counterparts in
 * `types.ts`.
 *
 * Each element is `Expect<Equal<ZodInferred, Simplified<CanonicalType>>>`.
 * TypeScript resolves the pair to `true` when the types are structurally
 * identical and to `false` otherwise; `Expect<false>` is an immediate type
 * error, breaking the build and surfacing the drift at `tsc` time.
 *
 * The type is exported so that tree-shaking cannot elide it and the assertion
 * runs unconditionally during every typecheck.
 */
export type ResponseSchemaConformance = [
  Expect<Equal<z.infer<typeof applicationSchema>, Simplify<Application>>>,
  Expect<Equal<z.infer<typeof smtpConfigViewSchema>, Simplify<SmtpConfigView>>>,
  Expect<Equal<z.infer<typeof publicSmtpConfigSchema>, Simplify<Omit<SmtpConfigView, "username">>>>,
  Expect<
    Equal<
      z.infer<typeof mailAttachmentStatusMetadataSchema>,
      Simplify<MailAttachmentStatusMetadata>
    >
  >,
  Expect<Equal<z.infer<typeof mailJobSchema>, Simplify<MailJob>>>,
  Expect<Equal<z.infer<typeof mailJobStatusViewSchema>, Simplify<MailJobStatusView>>>,
  Expect<Equal<z.infer<typeof deliveryStatusResultSchema>, Simplify<DeliveryStatusResult>>>,
  Expect<Equal<z.infer<typeof mailerTokenSchema>, Simplify<MailerToken>>>,
  Expect<Equal<z.infer<typeof applicationAdminTokenSchema>, Simplify<ApplicationAdminToken>>>,
  Expect<Equal<z.infer<typeof applicationTokenSchema>, Simplify<ApplicationToken>>>,
  Expect<
    Equal<
      z.infer<typeof createdApplicationAdminTokenSchema>,
      Simplify<CreatedApplicationAdminToken>
    >
  >,
  Expect<Equal<z.infer<typeof createdApplicationTokenSchema>, Simplify<CreatedApplicationToken>>>,
  Expect<Equal<z.infer<typeof createdMailerTokenSchema>, Simplify<CreatedMailerToken>>>,
  Expect<
    Equal<z.infer<typeof tokenViewSchema>, Simplify<ApplicationAdminToken | ApplicationToken>>
  >,
  Expect<Equal<z.infer<typeof issuedAccessTokenSchema>, Simplify<IssuedAccessToken>>>,
  Expect<Equal<z.infer<typeof mailerDebugAttemptSchema>, Simplify<MailerDebugAttempt>>>,
  Expect<Equal<z.infer<typeof mailerDebugInfoSchema>, Simplify<MailerDebugInfo>>>,
  Expect<Equal<z.infer<typeof mailerErrorResultSchema>, Simplify<MailerErrorResult>>>,
  Expect<Equal<z.infer<typeof validationResultSchema>, Simplify<{ ok: true } | MailerErrorResult>>>,
];
