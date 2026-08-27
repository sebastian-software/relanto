/* cspell:ignore oxlint */
/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type -- Schema limits are part of the public API contract; Zod schema builder return types are deliberately inferred. */
/* eslint-disable max-lines, no-nested-ternary, regexp/require-unicode-sets-regexp, require-unicode-regexp -- Shared API schemas intentionally live together; base64 validation regexes are ASCII payload checks. */
import { z } from "zod";

import { getSendRateLimitPerMinute } from "./env.js";

const MAX_HTML_LENGTH = 200_000;
const MAX_TEXT_LENGTH = 100_000;
const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const EMAIL_ADDRESS_MESSAGE = "Must be a valid email address";
const CRLF_PATTERN = /[\r\n]/u;

function getDecodedBase64Size(value: string): number {
  const normalized = value.replaceAll(/\s+/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;

  return Math.floor((normalized.length * 3) / 4) - padding;
}

const emailAddressSchema = z.string().trim().min(1).check(z.email(EMAIL_ADDRESS_MESSAGE));

export const tlsVersionSchema = z.enum(["TLSv1.2", "TLSv1.3"]);

export const apiFailureReasonSchema = z.enum([
  "auth_missing",
  "auth_invalid",
  "scope_missing",
  "validation",
  "domain_error",
  "method_not_allowed",
  "rate_limited",
  "other",
]);

export const tokenScopeSchema = z.enum([
  "send",
  "validate",
  "readStatus",
  "readConfig",
  "manageTokens",
  "manageApplications",
]);

export const tokenKindSchema = z.enum(["application", "applicationAdmin"]);

export const deliveryModeSchema = z.enum(["queued", "direct"]);

export const mailJobStatusSchema = z.enum([
  "queued",
  "paused",
  "processing",
  "sent",
  "failed",
  "retry_scheduled",
  "delivery_uncertain",
  "cancelled",
]);

export const mailerErrorCategorySchema = z.enum([
  "auth",
  "config",
  "content",
  "network",
  "rate_limit",
  "tls",
  "unknown",
]);

export const deliveryStatusSchema = z.enum([
  "queued",
  "processing",
  "retrying",
  "delivered",
  "bounced",
  "rejected",
  "permanently_failed",
  "cancelled",
  "unknown",
  "expired",
]);

export const deliveryFailureCategorySchema = z.enum([
  "unknown_recipient",
  "mailbox_unavailable",
  "relay_rejection",
  "provider_rejection",
  "delivery_uncertain",
  "expired_or_unknown",
]);

export const deliveryStatusBatchInputSchema = z.object({
  jobIds: z.array(z.string().trim().min(1, "jobId must not be empty")).min(1).max(50),
});

function requiredString(field: string) {
  return z
    .string({ error: `${field} is required` })
    .trim()
    .min(1, `${field} is required`);
}

function optionalString(field: string) {
  return z
    .string({ error: `${field} must be a string` })
    .trim()
    .min(1, `${field} must not be empty`);
}

function headerSafeString(field: string) {
  return requiredString(field).refine(
    (value) => !CRLF_PATTERN.test(value),
    `${field} must not contain line breaks`,
  );
}

function retentionDaysField(field: string) {
  return z
    .number({ error: `${field} must be a number` })
    .int(`${field} must be a whole number`)
    .min(1, `${field} must be at least 1`)
    .max(365, `${field} must be at most 365`)
    .default(30);
}

function timeoutMsField(field: string, fallback: number) {
  return z
    .number({ error: `${field} must be a number` })
    .int(`${field} must be a whole number`)
    .min(100, `${field} must be at least 100 ms`)
    .max(120_000, `${field} must be at most 120000 ms`)
    .default(fallback);
}

function sendRateLimitPerMinuteField(field: string, fallback: number) {
  return z
    .number({ error: `${field} must be a number` })
    .int(`${field} must be a whole number`)
    .min(0, `${field} must be at least 0`)
    .max(10_000, `${field} must be at most 10000`)
    .default(fallback);
}

export const attachmentSchema = z.object({
  cid: z.string().trim().optional(),
  contentBase64: requiredString("contentBase64").refine(
    (value) => getDecodedBase64Size(value) <= MAX_ATTACHMENT_BYTES,
    `Each attachment must not exceed ${MAX_ATTACHMENT_BYTES} bytes`,
  ),
  contentDisposition: z.enum(["attachment", "inline"]).default("attachment"),
  contentType: requiredString("contentType"),
  filename: requiredString("filename"),
});

// Boundary schemas used to validate JSON columns and token scope arrays read
// back from SQLite. They mirror the structures produced on the write path, so a
// corrupted or unexpected row fails fast instead of flowing through as `any`.
export const storedAttachmentsSchema = z.array(attachmentSchema);

export const storedHeadersSchema = z.record(z.string(), z.string());

export const storedTokenScopesSchema = z.array(tokenScopeSchema);

export const createApplicationAdminInputSchema = z.object({
  label: requiredString("label"),
});

export const createApplicationInputSchema = z.object({
  applicationAdminId: requiredString("applicationAdminId"),
  label: requiredString("label"),
});

export const renameApplicationAdminInputSchema = z.object({
  applicationAdminId: requiredString("applicationAdminId"),
  label: requiredString("label"),
});

export const renameApplicationInputSchema = z.object({
  applicationId: requiredString("applicationId"),
  label: requiredString("label"),
});

export const upsertSmtpConfigInputSchema = z.object({
  applicationId: requiredString("applicationId"),
  connectionTimeoutMs: timeoutMsField("connectionTimeoutMs", 10_000),
  defaultFromAddress: emailAddressSchema,
  greetingTimeoutMs: timeoutMsField("greetingTimeoutMs", 10_000),
  host: requiredString("host").refine(
    (value) => !value.includes("://") && !value.includes("/"),
    "Host must be a hostname or IP",
  ),
  minTlsVersion: tlsVersionSchema.default("TLSv1.2"),
  name: requiredString("name"),
  password: optionalString("password").optional(),
  port: z
    .number({ error: "port must be a number" })
    .int("port must be a whole number")
    .min(1, "port must be at least 1")
    .max(65_535, "port must be at most 65535"),
  requireTls: z.boolean().default(true),
  secure: z.boolean().default(false),
  sendRateLimitPerMinute: sendRateLimitPerMinuteField(
    "sendRateLimitPerMinute",
    getSendRateLimitPerMinute(),
  ),
  socketTimeoutMs: timeoutMsField("socketTimeoutMs", 20_000),
  username: requiredString("username"),
});

const SCOPES_ARRAY_MESSAGE = "scopes must be an array of token scopes";
const SCOPES_MIN_MESSAGE = "scopes must contain at least one entry";

const scopesField = z
  .array(tokenScopeSchema, { error: SCOPES_ARRAY_MESSAGE })
  .min(1, SCOPES_MIN_MESSAGE);

const retentionSchema = {
  retainAttachmentsDays: retentionDaysField("retainAttachmentsDays"),
  retainErrorDetailsDays: retentionDaysField("retainErrorDetailsDays"),
  retainFailedJobsDays: retentionDaysField("retainFailedJobsDays"),
  retainSentJobsDays: retentionDaysField("retainSentJobsDays"),
};

export const createApplicationAdminTokenInputSchema = z.object({
  applicationAdminId: requiredString("applicationAdminId"),
  label: requiredString("label"),
  scopes: scopesField,
  ...retentionSchema,
});

export const createApplicationTokenInputSchema = z.object({
  applicationId: requiredString("applicationId"),
  label: requiredString("label"),
  scopes: scopesField,
  ...retentionSchema,
});

export const updateTokenScopesInputSchema = z.object({
  scopes: scopesField,
});

export const issueClientAccessTokenInputSchema = z.object({
  clientId: requiredString("clientId"),
  clientSecret: requiredString("clientSecret"),
});

export const listApiFailuresFilterSchema = z.object({
  applicationId: optionalString("applicationId").optional(),
  fromTimestamp: optionalString("fromTimestamp").optional(),
  httpStatus: z
    .number({ error: "httpStatus must be a number" })
    .int("httpStatus must be a whole number")
    .min(100, "httpStatus must be a valid HTTP status code")
    .max(599, "httpStatus must be a valid HTTP status code")
    .optional(),
  limit: z
    .number({ error: "limit must be a number" })
    .int("limit must be a whole number")
    .min(1, "limit must be at least 1")
    .max(500, "limit must be at most 500")
    .optional(),
  reasonCategory: apiFailureReasonSchema.optional(),
  toTimestamp: optionalString("toTimestamp").optional(),
});

export const sendMailInputSchema = z
  .object({
    attachments: z
      .array(attachmentSchema)
      .max(MAX_ATTACHMENT_COUNT, `Attachments must not exceed ${MAX_ATTACHMENT_COUNT} items`)
      .default([]),
    from: emailAddressSchema.optional(),
    headers: z
      .record(z.string(), z.string())
      .refine(
        (value) =>
          Object.entries(value).every(
            ([key, headerValue]) => !CRLF_PATTERN.test(key) && !CRLF_PATTERN.test(headerValue),
          ),
        "Header names and values must not contain line breaks",
      )
      .default({}),
    html: requiredString("html").max(
      MAX_HTML_LENGTH,
      `HTML body must not exceed ${MAX_HTML_LENGTH} characters`,
    ),
    idempotencyKey: z
      .string({ error: "idempotencyKey must be a string" })
      .trim()
      .min(1, "idempotencyKey must not be empty")
      .max(255, "idempotencyKey must not exceed 255 characters")
      .optional(),
    messageId: headerSafeString("messageId"),
    subject: headerSafeString("subject"),
    text: requiredString("text").max(
      MAX_TEXT_LENGTH,
      `Text body must not exceed ${MAX_TEXT_LENGTH} characters`,
    ),
    to: emailAddressSchema,
  })
  .superRefine((value, context) => {
    const totalAttachmentBytes = value.attachments.reduce(
      (sum, attachment) => sum + getDecodedBase64Size(attachment.contentBase64),
      0,
    );

    if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      context.addIssue({
        code: "custom",
        message: `Attachments must not exceed ${MAX_TOTAL_ATTACHMENT_BYTES} bytes in total`,
        path: ["attachments"],
      });
    }
  });

export const sendMailPayloadLimits = {
  maxAttachmentBytes: MAX_ATTACHMENT_BYTES,
  maxAttachmentCount: MAX_ATTACHMENT_COUNT,
  maxHtmlLength: MAX_HTML_LENGTH,
  maxTextLength: MAX_TEXT_LENGTH,
  maxTotalAttachmentBytes: MAX_TOTAL_ATTACHMENT_BYTES,
} as const;

export type TokenScope = z.infer<typeof tokenScopeSchema>;
export type TokenKind = z.infer<typeof tokenKindSchema>;
export type ApiFailureReason = z.infer<typeof apiFailureReasonSchema>;
export type ListApiFailuresFilter = z.infer<typeof listApiFailuresFilterSchema>;
export type MailJobStatus = z.infer<typeof mailJobStatusSchema>;
export type DeliveryMode = z.infer<typeof deliveryModeSchema>;
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
export type DeliveryFailureCategory = z.infer<typeof deliveryFailureCategorySchema>;
export type DeliveryStatusBatchInput = z.infer<typeof deliveryStatusBatchInputSchema>;
export type CreateApplicationAdminInput = z.infer<typeof createApplicationAdminInputSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationInputSchema>;
export type RenameApplicationAdminInput = z.infer<typeof renameApplicationAdminInputSchema>;
export type RenameApplicationInput = z.infer<typeof renameApplicationInputSchema>;
export type UpsertSmtpConfigInput = z.infer<typeof upsertSmtpConfigInputSchema>;
export type CreateApplicationAdminTokenInput = z.infer<
  typeof createApplicationAdminTokenInputSchema
>;
export type CreateApplicationTokenInput = z.infer<typeof createApplicationTokenInputSchema>;
export type UpdateTokenScopesInput = z.infer<typeof updateTokenScopesInputSchema>;
export type IssueClientAccessTokenInput = z.infer<typeof issueClientAccessTokenInputSchema>;
export type SendMailInput = z.infer<typeof sendMailInputSchema>;

export type ApplicationAdmin = {
  createdAt: string;
  id: string;
  label: string;
  updatedAt: string;
};

export type Application = {
  applicationAdminId: string;
  createdAt: string;
  id: string;
  label: string;
  updatedAt: string;
};

export type SmtpConfig = {
  applicationId: string;
  connectionTimeoutMs: number;
  createdAt: string;
  defaultFromAddress: string;
  disabledAt?: string;
  greetingTimeoutMs: number;
  host: string;
  id: string;
  lockedAt?: string;
  minTlsVersion: "TLSv1.2" | "TLSv1.3";
  name: string;
  port: number;
  requireTls: boolean;
  secure: boolean;
  sendRateLimitPerMinute: number;
  socketTimeoutMs: number;
  updatedAt: string;
  username: string;
};

export type SmtpConfigSecret = {
  password: string;
} & SmtpConfig;

export type SmtpConfigView = {
  applicationAdminId: string;
  applicationLabel: string;
  hasPassword: boolean;
} & SmtpConfig;

export type MailerToken = {
  clientId: string;
  createdAt: string;
  id: string;
  kind: TokenKind;
  label: string;
  lastUsedAt?: string;
  revokedAt?: string;
  scopes: TokenScope[];
  updatedAt: string;
};

export type ApplicationAdminToken = {
  applicationAdminId: string;
  kind: "applicationAdmin";
} & Omit<MailerToken, "kind">;

export type ApplicationToken = {
  applicationId: string;
  configId?: string;
  kind: "application";
} & Omit<MailerToken, "kind">;

export type CreatedApplicationAdminToken = {
  clientSecret: string;
} & ApplicationAdminToken;

export type CreatedApplicationToken = {
  clientSecret: string;
} & ApplicationToken;

export type CreatedMailerToken = CreatedApplicationAdminToken | CreatedApplicationToken;

export type IssuedAccessToken = {
  accessToken: string;
  expiresIn: number;
  ok: true;
  tokenType: "Bearer";
};

export type MailAttachment = z.infer<typeof attachmentSchema>;

export type MailAttachmentStatusMetadata = Omit<MailAttachment, "contentBase64">;

export type MailerErrorCategory = z.infer<typeof mailerErrorCategorySchema>;

export type MailerDebugAttempt = {
  address: string;
  code?: string;
  family: number;
  message?: string;
  outcome: "failed" | "succeeded";
  phase: "send" | "verify";
};

export type MailerDebugInfo = {
  attempts: MailerDebugAttempt[];
  host: string;
  minTlsVersion: "TLSv1.2" | "TLSv1.3";
  port: number;
  requireTls: boolean;
  resolvedTargets: string[];
  secure: boolean;
};

export type MailerErrorResult = {
  category: MailerErrorCategory;
  code?: string;
  debug?: MailerDebugInfo;
  message: string;
  ok: false;
  permanent: boolean;
  providerResponseCode?: number;
  retryAfterMs?: number;
};

export type MailJob = {
  acceptedAt?: string;
  applicationId: string;
  attachments: MailAttachment[];
  configId: string;
  createdAt: string;
  deletedAt?: string;
  deliveryMode: DeliveryMode;
  errorCategory?: MailerErrorCategory;
  errorCode?: string;
  errorPermanent?: boolean;
  from: string;
  headers: Record<string, string>;
  html: string;
  id: string;
  idempotencyKey?: string;
  lastError?: string;
  messageId: string;
  nextRetryAt?: string;
  processingStartedAt?: string;
  providerMessageId?: string;
  providerResponseCode?: number;
  retryCount: number;
  sentAt?: string;
  status: MailJobStatus;
  subject: string;
  text: string;
  to: string;
  tokenId?: string;
  tokenKind?: TokenKind;
  updatedAt: string;
};

export type MailJobStatusView = {
  attachments: MailAttachmentStatusMetadata[];
} & Omit<MailJob, "attachments" | "headers" | "html" | "text">;

export type DeliveryStatusResult = {
  deliveryStatus: DeliveryStatus;
  errorCode?: string;
  failureCategory?: DeliveryFailureCategory;
  failureReason?: string;
  jobId: string;
  jobStatus?: MailJobStatus;
  nextRetryAt?: string;
  providerMessageId?: string;
  providerResponseCode?: number;
  retryCount?: number;
  sentAt?: string;
  terminal: boolean;
  updatedAt?: string;
};

export type ApiRequestFailure = {
  applicationId?: string;
  clientId?: string;
  createdAt: string;
  details?: Record<string, unknown>;
  httpStatus: number;
  id: string;
  reasonCategory: ApiFailureReason;
  reasonMessage: string;
  requestMethod: string;
  requestPath: string;
  tokenId?: string;
  tokenKind?: TokenKind;
};

export type AuthenticatedToken =
  | {
      applicationAdminId: string;
      clientId: string;
      kind: "applicationAdmin";
      scopes: TokenScope[];
      tokenId: string;
    }
  | {
      applicationId: string;
      clientId: string;
      configId: string;
      kind: "application";
      scopes: TokenScope[];
      tokenId: string;
    };
