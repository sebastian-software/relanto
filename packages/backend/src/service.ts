/* cspell:ignore oxlint sonarjs */
/* oxlint-disable no-magic-numbers, no-shadow, typescript/explicit-function-return-type, unicorn/no-array-callback-reference, unicorn/no-await-expression-member, unicorn/numeric-separators-style, unicorn/prefer-native-coercion-functions -- This legacy service boundary still mixes validation, persistence, and orchestration details. */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/strict-boolean-expressions, complexity, max-lines, max-lines-per-function, max-params, max-statements, no-await-in-loop, no-negated-condition, no-nested-ternary, sonarjs/cognitive-complexity, sonarjs/no-duplicate-string -- This service module is the legacy persistence/API boundary; narrowing database rows and decomposing workflows requires a separate behavior-preserving refactor. */
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import nodemailer from "nodemailer";

import { getDatabase } from "./db.js";
import {
  getApiFailureRetentionDays,
  getProcessingTimeoutMs,
  getSendRateLimitPerMinute,
} from "./env.js";
import {
  createId,
  createPlainToken,
  decryptSecret,
  encryptSecret,
  getTokenPreview,
  hashToken,
  sanitizeErrorMessage,
  signJwt,
  verifyJwt,
  verifyTokenHash,
} from "./security.js";
import { logJobResult } from "./structured-log.js";
import {
  type ApiFailureReason,
  apiFailureReasonSchema,
  type ApiRequestFailure,
  type Application,
  type ApplicationAdmin,
  type ApplicationAdminToken,
  type ApplicationToken,
  type AuthenticatedToken,
  type CreateApplicationAdminInput,
  createApplicationAdminInputSchema,
  type CreateApplicationAdminTokenInput,
  createApplicationAdminTokenInputSchema,
  type CreateApplicationInput,
  createApplicationInputSchema,
  type CreateApplicationTokenInput,
  createApplicationTokenInputSchema,
  type CreatedApplicationAdminToken,
  type CreatedApplicationToken,
  type CreatedMailerToken,
  type DeliveryFailureCategory,
  type DeliveryMode,
  deliveryModeSchema,
  type DeliveryStatus,
  type DeliveryStatusResult,
  type IssueClientAccessTokenInput,
  issueClientAccessTokenInputSchema,
  type IssuedAccessToken,
  type ListApiFailuresFilter,
  type MailAttachmentStatusMetadata,
  type MailerDebugAttempt,
  type MailerDebugInfo,
  type MailerErrorCategory,
  mailerErrorCategorySchema,
  type MailerErrorResult,
  type MailerToken,
  type MailJob,
  mailJobStatusSchema,
  type MailJobStatusView,
  type RenameApplicationAdminInput,
  renameApplicationAdminInputSchema,
  type RenameApplicationInput,
  renameApplicationInputSchema,
  type SendMailInput,
  sendMailInputSchema,
  type SmtpConfigSecret,
  type SmtpConfigView,
  storedAttachmentsSchema,
  storedHeadersSchema,
  storedTokenScopesSchema,
  tlsVersionSchema,
  tokenKindSchema,
  type TokenScope,
  tokenScopeSchema,
  type UpdateTokenScopesInput,
  updateTokenScopesInputSchema,
  type UpsertSmtpConfigInput,
  upsertSmtpConfigInputSchema,
} from "./types.js";

type DatabaseRecord = Record<string, null | number | string>;
type ActorType = "application" | "applicationAdmin" | "systemAdmin";
type TokenRetentionPolicy = {
  retainAttachmentsDays: number;
  retainErrorDetailsDays: number;
  retainFailedJobsDays: number;
  retainSentJobsDays: number;
};
type LegacyCreateTokenInput = {
  configId: string;
  label: string;
  principalId: string;
  retainAttachmentsDays: number;
  retainErrorDetailsDays: number;
  retainFailedJobsDays: number;
  retainSentJobsDays: number;
  scopes: TokenScope[];
};
type SmtpResolvedTarget = {
  address: string;
  family: number;
};

type AccessTokenPayload = {
  applicationAdminId?: string;
  applicationId?: string;
  aud: string;
  clientId: string;
  configId?: string;
  credentialUpdatedAt: string;
  exp: number;
  iat: number;
  kind: "application" | "applicationAdmin";
  scopes: TokenScope[];
  sub: string;
  tokenId: string;
};

const ACCESS_TOKEN_AUDIENCE = "relanto-api";
const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;

let lookupSmtpHost = dnsLookup;
let createMailerTransport = nodemailer.createTransport.bind(nodemailer);

const BLOCKED_IPV4_RANGES: Array<[number, number]> = [
  [ipv4ToInteger("0.0.0.0"), ipv4ToInteger("0.255.255.255")],
  [ipv4ToInteger("10.0.0.0"), ipv4ToInteger("10.255.255.255")],
  [ipv4ToInteger("100.64.0.0"), ipv4ToInteger("100.127.255.255")],
  [ipv4ToInteger("127.0.0.0"), ipv4ToInteger("127.255.255.255")],
  [ipv4ToInteger("169.254.0.0"), ipv4ToInteger("169.254.255.255")],
  [ipv4ToInteger("172.16.0.0"), ipv4ToInteger("172.31.255.255")],
  [ipv4ToInteger("192.0.0.0"), ipv4ToInteger("192.0.0.255")],
  [ipv4ToInteger("192.0.2.0"), ipv4ToInteger("192.0.2.255")],
  [ipv4ToInteger("192.168.0.0"), ipv4ToInteger("192.168.255.255")],
  [ipv4ToInteger("198.18.0.0"), ipv4ToInteger("198.19.255.255")],
  [ipv4ToInteger("198.51.100.0"), ipv4ToInteger("198.51.100.255")],
  [ipv4ToInteger("203.0.113.0"), ipv4ToInteger("203.0.113.255")],
  [ipv4ToInteger("224.0.0.0"), ipv4ToInteger("255.255.255.255")],
];

const IPV6_UNSPECIFIED = ipv6ToBigInt("::");
const IPV6_LOOPBACK = ipv6ToBigInt("::1");
const IPV6_DOCUMENTATION_START = ipv6ToBigInt("2001:db8::");
const IPV6_DOCUMENTATION_END = ipv6ToBigInt("2001:db8:ffff:ffff:ffff:ffff:ffff:ffff");
const IPV6_UNIQUE_LOCAL_START = ipv6ToBigInt("fc00::");
const IPV6_UNIQUE_LOCAL_END = ipv6ToBigInt("fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff");
const IPV6_LINK_LOCAL_START = ipv6ToBigInt("fe80::");
const IPV6_LINK_LOCAL_END = ipv6ToBigInt("febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff");
const IPV6_MULTICAST_START = ipv6ToBigInt("ff00::");
const IPV6_MULTICAST_END = ipv6ToBigInt("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff");

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Returns an ISO timestamp that is strictly greater than `previous`.
 *
 * Token invalidation on rotation relies on `updated_at` changing so that
 * access tokens issued before the rotation (which embed the prior
 * `credentialUpdatedAt`) stop matching. Because `nowIso()` only has
 * millisecond resolution, a rotation happening in the same millisecond as the
 * previous update would otherwise reuse the same timestamp and leave the old
 * credential valid. Advancing by one millisecond guarantees invalidation.
 *
 * @param previous - The current ISO timestamp that the result must exceed.
 * @returns An ISO timestamp strictly greater than `previous`.
 */
function advanceIsoTimestamp(previous: string): string {
  const previousMs = new Date(previous).getTime();
  const nowMs = Date.now();
  const nextMs = Number.isFinite(previousMs) && nowMs <= previousMs ? previousMs + 1 : nowMs;

  return new Date(nextMs).toISOString();
}

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function createClientId(kind: "application" | "applicationAdmin"): string {
  return createId(kind === "application" ? "appcli" : "admcli");
}

function ipv4ToInteger(address: string): number {
  const octets = address.split(".").map((part) => Number(part));
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    throw new Error(`Invalid IPv4 address: ${address}`);
  }

  return octets[0] * 256 ** 3 + octets[1] * 256 ** 2 + octets[2] * 256 + octets[3];
}

function expandIpv6Address(address: string): string[] {
  const [head, tail = ""] = address.toLowerCase().split("::");
  const headParts = head ? head.split(":").filter(Boolean) : [];
  const tailParts = tail ? tail.split(":").filter(Boolean) : [];
  const missingGroups = 8 - (headParts.length + tailParts.length);

  if (missingGroups < 0) {
    throw new Error(`Invalid IPv6 address: ${address}`);
  }

  return [...headParts, ...Array.from({ length: missingGroups }, () => "0"), ...tailParts];
}

function ipv6ToBigInt(address: string): bigint {
  return expandIpv6Address(address).reduce(
    (result, part) => (result << 16n) + BigInt(`0x${part || "0"}`),
    0n,
  );
}

function isIpv4MappedIpv6(address: string): boolean {
  return address.toLowerCase().startsWith("::ffff:");
}

function getMappedIpv4Address(address: string): string {
  return address.slice(address.lastIndexOf(":") + 1);
}

function isIpv4Blocked(address: string): boolean {
  const value = ipv4ToInteger(address);
  return BLOCKED_IPV4_RANGES.some(([start, end]) => value >= start && value <= end);
}

function isIpv6Blocked(address: string): boolean {
  if (isIpv4MappedIpv6(address)) {
    return isIpv4Blocked(getMappedIpv4Address(address));
  }

  const value = ipv6ToBigInt(address);
  return (
    value === IPV6_UNSPECIFIED ||
    value === IPV6_LOOPBACK ||
    (value >= IPV6_DOCUMENTATION_START && value <= IPV6_DOCUMENTATION_END) ||
    (value >= IPV6_UNIQUE_LOCAL_START && value <= IPV6_UNIQUE_LOCAL_END) ||
    (value >= IPV6_LINK_LOCAL_START && value <= IPV6_LINK_LOCAL_END) ||
    (value >= IPV6_MULTICAST_START && value <= IPV6_MULTICAST_END)
  );
}

/**
 * Guards against SSRF by asserting that a resolved SMTP host address is publicly routable.
 *
 * Blocks all loopback, private, link-local, documentation, and multicast ranges for
 * both IPv4 and IPv6, including IPv4-mapped IPv6 addresses (`::ffff:x.x.x.x`). Called
 * for every address returned by DNS before a transport connection is opened.
 *
 * @param address - A resolved IP address string (IPv4 dotted-decimal or IPv6 colon notation).
 * @param family - The IP family as returned by DNS lookup: `4` for IPv4, `6` for IPv6.
 * @throws {Error} If the resolved address falls within a non-globally-routable IP range.
 */
export function assertSafeResolvedAddress(address: string, family: number): void {
  if (family === 4 && isIpv4Blocked(address)) {
    throw new Error(`Non-global SMTP target is not allowed: ${address}`);
  }

  if (family === 6 && isIpv6Blocked(address)) {
    throw new Error(`Non-global SMTP target is not allowed: ${address}`);
  }
}

function databaseAll(sql: string, ...parameters: Array<null | number | string>): DatabaseRecord[] {
  const statement = getDatabase().prepare(sql);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 returns `unknown`; rows are shaped as string/number/null columns.
  return statement.all(...parameters) as DatabaseRecord[];
}

function databaseGet(
  sql: string,
  ...parameters: Array<null | number | string>
): DatabaseRecord | undefined {
  const statement = getDatabase().prepare(sql);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 returns `unknown`; rows are shaped as string/number/null columns.
  return statement.get(...parameters) as DatabaseRecord | undefined;
}

function databaseRun(sql: string, ...parameters: Array<null | number | string>): void {
  getDatabase()
    .prepare(sql)
    .run(...parameters);
}

// Single untyped JSON boundary. `JSON.parse` returns `any`; funneling every DB
// column parse through this helper keeps the `any` contained here and hands
// callers an `unknown` they must narrow with Zod before use.
function parseJson(value: string): unknown {
  return JSON.parse(value);
}

function appendNotDeletedClause(clauses: string[]): string[] {
  return ["deleted_at IS NULL", ...clauses];
}

function isJobDueConditionSql(alias = ""): string {
  const prefix = alias.length > 0 ? `${alias}.` : "";

  return `(
    ${prefix}status = 'queued'
    OR (${prefix}status = 'retry_scheduled' AND ${prefix}next_retry_at IS NOT NULL AND ${prefix}next_retry_at <= ?)
  )`;
}

function mapApplicationAdmin(record: DatabaseRecord): ApplicationAdmin {
  return {
    createdAt: String(record.created_at),
    id: String(record.id),
    label: String(record.label),
    updatedAt: String(record.updated_at),
  };
}

function mapApplication(record: DatabaseRecord): Application {
  return {
    applicationAdminId: String(record.application_admin_id),
    createdAt: String(record.created_at),
    id: String(record.id),
    label: String(record.label),
    updatedAt: String(record.updated_at),
  };
}

function mapSmtpConfigView(record: DatabaseRecord): SmtpConfigView {
  return {
    applicationAdminId: String(record.application_admin_id),
    applicationId: String(record.application_id),
    applicationLabel: String(record.application_label),
    connectionTimeoutMs: Number(record.connection_timeout_ms),
    createdAt: String(record.created_at),
    defaultFromAddress: String(record.default_from_address),
    disabledAt: record.disabled_at ? String(record.disabled_at) : undefined,
    greetingTimeoutMs: Number(record.greeting_timeout_ms),
    hasPassword: Number(record.has_password) > 0,
    host: String(record.host),
    id: String(record.id),
    lockedAt: record.locked_at ? String(record.locked_at) : undefined,
    minTlsVersion: tlsVersionSchema.parse(record.min_tls_version),
    name: String(record.name),
    port: Number(record.port),
    requireTls: Number(record.require_tls) > 0,
    secure: Number(record.secure) > 0,
    sendRateLimitPerMinute: Number(record.send_rate_limit_per_minute),
    socketTimeoutMs: Number(record.socket_timeout_ms),
    updatedAt: String(record.updated_at),
    username: String(record.username),
  };
}

function mapApplicationToken(record: DatabaseRecord): ApplicationToken {
  return {
    applicationId: String(record.application_id),
    clientId: String(record.client_id),
    configId: record.config_id ? String(record.config_id) : undefined,
    createdAt: String(record.created_at),
    id: String(record.id),
    kind: "application",
    label: String(record.label),
    lastUsedAt: record.last_used_at ? String(record.last_used_at) : undefined,
    revokedAt: record.revoked_at ? String(record.revoked_at) : undefined,
    scopes: storedTokenScopesSchema.parse(parseJson(String(record.scopes_json))),
    updatedAt: String(record.updated_at),
  };
}

function mapApplicationAdminToken(record: DatabaseRecord): ApplicationAdminToken {
  return {
    applicationAdminId: String(record.application_admin_id),
    clientId: String(record.client_id),
    createdAt: String(record.created_at),
    id: String(record.id),
    kind: "applicationAdmin",
    label: String(record.label),
    lastUsedAt: record.last_used_at ? String(record.last_used_at) : undefined,
    revokedAt: record.revoked_at ? String(record.revoked_at) : undefined,
    scopes: storedTokenScopesSchema.parse(parseJson(String(record.scopes_json))),
    updatedAt: String(record.updated_at),
  };
}

function mapMailJob(record: DatabaseRecord): MailJob {
  return {
    acceptedAt: record.accepted_at ? String(record.accepted_at) : undefined,
    applicationId: String(record.application_id),
    attachments: storedAttachmentsSchema.parse(parseJson(String(record.attachments_json))),
    configId: String(record.config_id),
    createdAt: String(record.created_at),
    deletedAt: record.deleted_at ? String(record.deleted_at) : undefined,
    deliveryMode: deliveryModeSchema.parse(record.delivery_mode),
    errorCategory: record.error_category
      ? mailerErrorCategorySchema.parse(record.error_category)
      : undefined,
    errorCode: record.error_code ? String(record.error_code) : undefined,
    errorPermanent:
      record.error_permanent === null ? undefined : Number(record.error_permanent) > 0,
    from: String(record.from_address),
    headers: storedHeadersSchema.parse(parseJson(String(record.headers_json))),
    html: String(record.html),
    id: String(record.id),
    idempotencyKey: record.idempotency_key ? String(record.idempotency_key) : undefined,
    lastError: record.last_error ? String(record.last_error) : undefined,
    messageId: String(record.message_id),
    nextRetryAt: record.next_retry_at ? String(record.next_retry_at) : undefined,
    processingStartedAt: record.processing_started_at
      ? String(record.processing_started_at)
      : undefined,
    providerMessageId: record.provider_message_id ? String(record.provider_message_id) : undefined,
    providerResponseCode:
      record.provider_response_code === null ? undefined : Number(record.provider_response_code),
    retryCount: Number(record.retry_count),
    sentAt: record.sent_at ? String(record.sent_at) : undefined,
    status: mailJobStatusSchema.parse(record.status),
    subject: String(record.subject),
    text: String(record.text_body),
    to: String(record.to_address),
    tokenId: record.token_id ? String(record.token_id) : undefined,
    tokenKind: record.token_kind ? tokenKindSchema.parse(record.token_kind) : undefined,
    updatedAt: String(record.updated_at),
  };
}

function mapAttachmentStatusMetadata(attachment: {
  cid?: string;
  contentDisposition: "attachment" | "inline";
  contentType: string;
  filename: string;
}): MailAttachmentStatusMetadata {
  return {
    cid: attachment.cid,
    contentDisposition: attachment.contentDisposition,
    contentType: attachment.contentType,
    filename: attachment.filename,
  };
}

function mapMailJobStatusView(record: DatabaseRecord): MailJobStatusView {
  return {
    acceptedAt: record.accepted_at ? String(record.accepted_at) : undefined,
    applicationId: String(record.application_id),
    attachments: storedAttachmentsSchema
      .parse(parseJson(String(record.attachments_json)))
      .map(mapAttachmentStatusMetadata),
    configId: String(record.config_id),
    createdAt: String(record.created_at),
    deletedAt: record.deleted_at ? String(record.deleted_at) : undefined,
    deliveryMode: deliveryModeSchema.parse(record.delivery_mode),
    errorCategory: record.error_category
      ? mailerErrorCategorySchema.parse(record.error_category)
      : undefined,
    errorCode: record.error_code ? String(record.error_code) : undefined,
    errorPermanent:
      record.error_permanent === null ? undefined : Number(record.error_permanent) > 0,
    from: String(record.from_address),
    id: String(record.id),
    idempotencyKey: record.idempotency_key ? String(record.idempotency_key) : undefined,
    lastError: record.last_error ? String(record.last_error) : undefined,
    messageId: String(record.message_id),
    nextRetryAt: record.next_retry_at ? String(record.next_retry_at) : undefined,
    processingStartedAt: record.processing_started_at
      ? String(record.processing_started_at)
      : undefined,
    providerMessageId: record.provider_message_id ? String(record.provider_message_id) : undefined,
    providerResponseCode:
      record.provider_response_code === null ? undefined : Number(record.provider_response_code),
    retryCount: Number(record.retry_count),
    sentAt: record.sent_at ? String(record.sent_at) : undefined,
    status: mailJobStatusSchema.parse(record.status),
    subject: String(record.subject),
    to: String(record.to_address),
    tokenId: record.token_id ? String(record.token_id) : undefined,
    tokenKind: record.token_kind ? tokenKindSchema.parse(record.token_kind) : undefined,
    updatedAt: String(record.updated_at),
  };
}

function unknownDeliveryStatus(jobId: string): DeliveryStatusResult {
  return {
    deliveryStatus: "unknown",
    failureCategory: "expired_or_unknown",
    failureReason: "The job is unknown, expired, deleted or already purged by retention.",
    jobId,
    terminal: true,
  };
}

function getFailureCategory(job: MailJobStatusView): DeliveryFailureCategory | undefined {
  if (job.status === "delivery_uncertain") {
    return "delivery_uncertain";
  }

  if (job.status !== "failed") {
    return undefined;
  }

  const providerResponseCode = job.providerResponseCode;

  if (providerResponseCode === 550) {
    return "unknown_recipient";
  }

  if (providerResponseCode === 551 || providerResponseCode === 552) {
    return "mailbox_unavailable";
  }

  if (providerResponseCode === 553 || providerResponseCode === 554) {
    return "relay_rejection";
  }

  if (providerResponseCode !== undefined && providerResponseCode >= 500) {
    return "provider_rejection";
  }

  if (
    job.errorCategory === "auth" ||
    job.errorCategory === "config" ||
    job.errorCategory === "tls"
  ) {
    return "provider_rejection";
  }

  return undefined;
}

function getDeliveryStatus(job: MailJobStatusView): DeliveryStatus {
  switch (job.status) {
    case "cancelled": {
      return "cancelled";
    }
    case "delivery_uncertain": {
      return "permanently_failed";
    }
    case "failed": {
      const failureCategory = getFailureCategory(job);

      return failureCategory === "unknown_recipient" || failureCategory === "mailbox_unavailable"
        ? "bounced"
        : failureCategory === "relay_rejection" || failureCategory === "provider_rejection"
          ? "rejected"
          : "permanently_failed";
    }
    case "paused":
    case "queued": {
      return "queued";
    }
    case "processing": {
      return "processing";
    }
    case "retry_scheduled": {
      return "retrying";
    }
    case "sent": {
      return "delivered";
    }
  }
}

function isDeliveryStatusTerminal(deliveryStatus: DeliveryStatus): boolean {
  return [
    "bounced",
    "cancelled",
    "delivered",
    "expired",
    "permanently_failed",
    "rejected",
    "unknown",
  ].includes(deliveryStatus);
}

function mapJobDeliveryStatus(job: MailJobStatusView): DeliveryStatusResult {
  const deliveryStatus = getDeliveryStatus(job);
  const failureCategory = getFailureCategory(job);

  return {
    deliveryStatus,
    errorCode: job.errorCode,
    failureCategory,
    failureReason: job.lastError,
    jobId: job.id,
    jobStatus: job.status,
    nextRetryAt: job.nextRetryAt,
    providerMessageId: job.providerMessageId,
    providerResponseCode: job.providerResponseCode,
    retryCount: job.retryCount,
    sentAt: job.sentAt,
    terminal: isDeliveryStatusTerminal(deliveryStatus),
    updatedAt: job.updatedAt,
  };
}

function canTokenAccessJobStatusView(
  authToken: AuthenticatedToken,
  job: MailJobStatusView,
): boolean {
  if (authToken.kind === "application") {
    return job.applicationId === authToken.applicationId;
  }

  return getApplicationById(job.applicationId).applicationAdminId === authToken.applicationAdminId;
}

function getJobStatusViewRecord(jobId: string): DatabaseRecord | undefined {
  return databaseGet(
    `SELECT
      id,
      application_id,
      config_id,
      token_id,
      token_kind,
      idempotency_key,
      message_id,
      from_address,
      to_address,
      subject,
      attachments_json,
      status,
      delivery_mode,
      retry_count,
      next_retry_at,
      last_error,
      error_category,
      error_permanent,
      error_code,
      provider_response_code,
      provider_message_id,
      created_at,
      updated_at,
      accepted_at,
      processing_started_at,
      sent_at,
      deleted_at
    FROM mail_jobs
    WHERE id = ?
      AND deleted_at IS NULL`,
    jobId,
  );
}

function listJobStatusViewRecordsByIds(jobIds: string[]): Map<string, MailJobStatusView> {
  const uniqueJobIds = [...new Set(jobIds)];

  if (uniqueJobIds.length === 0) {
    return new Map();
  }

  const placeholders = uniqueJobIds.map(() => "?").join(", ");
  const records = databaseAll(
    `SELECT
      id,
      application_id,
      config_id,
      token_id,
      token_kind,
      idempotency_key,
      message_id,
      from_address,
      to_address,
      subject,
      attachments_json,
      status,
      delivery_mode,
      retry_count,
      next_retry_at,
      last_error,
      error_category,
      error_permanent,
      error_code,
      provider_response_code,
      provider_message_id,
      created_at,
      updated_at,
      accepted_at,
      processing_started_at,
      sent_at,
      deleted_at
    FROM mail_jobs
    WHERE deleted_at IS NULL
      AND id IN (${placeholders})`,
    ...uniqueJobIds,
  );

  return new Map(records.map((record) => [String(record.id), mapMailJobStatusView(record)]));
}

function getTokenRetentionPolicy(
  tokenId: string,
  tokenKind: "application" | "applicationAdmin",
): TokenRetentionPolicy {
  const record =
    tokenKind === "application"
      ? databaseGet(
          `SELECT
            retain_attachments_days,
            retain_error_details_days,
            retain_failed_jobs_days,
            retain_sent_jobs_days
          FROM application_tokens
          WHERE id = ?`,
          tokenId,
        )
      : databaseGet(
          `SELECT
            retain_attachments_days,
            retain_error_details_days,
            retain_failed_jobs_days,
            retain_sent_jobs_days
          FROM application_admin_tokens
          WHERE id = ?`,
          tokenId,
        );

  if (!record) {
    throw new Error("Token retention policy not found");
  }

  return {
    retainAttachmentsDays: Number(record.retain_attachments_days),
    retainErrorDetailsDays: Number(record.retain_error_details_days),
    retainFailedJobsDays: Number(record.retain_failed_jobs_days),
    retainSentJobsDays: Number(record.retain_sent_jobs_days),
  };
}

function calculateRetentionCutoff(now: Date, retainDays: number): string {
  return new Date(now.getTime() - retainDays * 24 * 60 * 60 * 1000).toISOString();
}

// Per-row cutoff string reproduces calculateRetentionCutoff (now minus N days) in the
// exact ISO 8601 millisecond format `YYYY-MM-DDTHH:MM:SS.sss` with a trailing Z so the
// TEXT comparisons stay identical to the previous JS string comparisons.
function retentionCutoffSql(retentionDaysColumn: string): string {
  return `strftime('%Y-%m-%dT%H:%M:%fZ', @now, '-' || ${retentionDaysColumn} || ' days')`;
}

/**
 * Enforces per-token retention policies on mail jobs in a single database transaction.
 *
 * Executes three operations in order:
 * 1. **Purge** — soft-deletes (`deleted_at`) terminal jobs past their retention window.
 * 2. **Attachment redaction** — replaces `attachments_json` with `'[]'` for eligible jobs.
 * 3. **Error detail redaction** — nullifies `last_error` and related error columns.
 *
 * Counts are captured before purging so jobs that are both redacted and purged in the
 * same sweep still appear in the redaction totals, matching the previous per-row semantics.
 *
 * @param now - ISO timestamp used as the reference point for all cutoff calculations.
 * @returns Counts of purged jobs, redacted attachment rows, and redacted error-detail rows.
 */
export function applyJobRetention(now = nowIso()): {
  purgedJobs: number;
  redactedAttachments: number;
  redactedErrorDetails: number;
} {
  const database = getDatabase();

  // Terminal timestamp mirrors the previous JS expression `sent_at || updated_at`:
  // an empty or null sent_at falls back to updated_at, otherwise sent_at wins.
  const terminalAt = "COALESCE(NULLIF(sent_at, ''), updated_at)";

  const attachmentCondition = `
    deleted_at IS NULL
    AND status IN ('cancelled', 'delivery_uncertain', 'failed', 'sent')
    AND attachments_json <> '[]'
    AND ${terminalAt} <= ${retentionCutoffSql("retain_attachments_days")}`;

  const errorCondition = `
    deleted_at IS NULL
    AND status IN ('delivery_uncertain', 'failed')
    AND last_error IS NOT NULL
    AND last_error <> ''
    AND ${terminalAt} <= ${retentionCutoffSql("retain_error_details_days")}`;

  const purgeCondition = `
    deleted_at IS NULL
    AND (
      (
        status = 'sent'
        AND ${terminalAt} <= ${retentionCutoffSql("retain_sent_jobs_days")}
      )
      OR (
        status IN ('cancelled', 'delivery_uncertain', 'failed')
        AND ${terminalAt} <= ${retentionCutoffSql("retain_failed_jobs_days")}
      )
    )`;

  const applyRetention = database.transaction((nowValue: string) => {
    const parameters = { now: nowValue };

    // Counts are captured against the original row set so that jobs which are both
    // redacted and purged in the same sweep still count as redacted, matching the
    // previous per-row loop semantics exactly.
    const attachmentCountRow = database
      .prepare(`SELECT COUNT(*) AS count FROM mail_jobs WHERE ${attachmentCondition}`)
      .get(parameters);
    const errorCountRow = database
      .prepare(`SELECT COUNT(*) AS count FROM mail_jobs WHERE ${errorCondition}`)
      .get(parameters);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- COUNT(*) AS count always yields a numeric column.
    const redactedAttachments = (attachmentCountRow as { count?: number } | undefined)?.count ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- COUNT(*) AS count always yields a numeric column.
    const redactedErrorDetails = (errorCountRow as { count?: number } | undefined)?.count ?? 0;

    // Purge before redacting so deletion decisions use the original updated_at
    // (redaction bumps updated_at, which would otherwise move non-sent jobs out of
    // their purge window).
    const purgeResult = database
      .prepare(`DELETE FROM mail_jobs WHERE ${purgeCondition}`)
      .run(parameters);
    const purgedJobs = purgeResult.changes;

    // A single UPDATE keeps both redaction branches evaluated against the pre-update
    // row, so the attachment redaction cannot shift the error-redaction cutoff (or
    // vice versa).
    database
      .prepare(
        `UPDATE mail_jobs
        SET
          attachments_json = CASE WHEN (${attachmentCondition}) THEN '[]' ELSE attachments_json END,
          last_error = CASE WHEN (${errorCondition}) THEN NULL ELSE last_error END,
          error_category = CASE WHEN (${errorCondition}) THEN NULL ELSE error_category END,
          error_permanent = CASE WHEN (${errorCondition}) THEN NULL ELSE error_permanent END,
          error_code = CASE WHEN (${errorCondition}) THEN NULL ELSE error_code END,
          provider_response_code = CASE WHEN (${errorCondition}) THEN NULL ELSE provider_response_code END,
          updated_at = CASE WHEN (${attachmentCondition}) OR (${errorCondition}) THEN @now ELSE updated_at END
        WHERE (${attachmentCondition}) OR (${errorCondition})`,
      )
      .run(parameters);

    return { purgedJobs, redactedAttachments, redactedErrorDetails };
  });

  return applyRetention(now);
}

const MAX_REASON_MESSAGE_LENGTH = 500;
const MAX_REQUEST_PATH_LENGTH = 2_048;
const MAX_DETAILS_JSON_LENGTH = 2_000;

type RecordApiFailureInput = {
  applicationId?: string;
  clientId?: string;
  details?: Record<string, unknown>;
  httpStatus: number;
  reasonCategory: ApiFailureReason;
  reasonMessage: string;
  requestMethod: string;
  requestPath: string;
  tokenId?: string;
  tokenKind?: "application" | "applicationAdmin";
};

function truncateString(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function mapApiRequestFailure(record: DatabaseRecord): ApiRequestFailure {
  const detailsRaw = record.details_json ? String(record.details_json) : null;
  let details: Record<string, unknown> | undefined;

  if (detailsRaw) {
    try {
      const parsed: unknown = JSON.parse(detailsRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Guarded above to a non-array object; stored details are a flat record.
        details = parsed as Record<string, unknown>;
      }
    } catch {
      details = undefined;
    }
  }

  return {
    applicationId: record.application_id ? String(record.application_id) : undefined,
    clientId: record.client_id ? String(record.client_id) : undefined,
    createdAt: String(record.created_at),
    details,
    httpStatus: Number(record.http_status),
    id: String(record.id),
    reasonCategory: apiFailureReasonSchema.parse(record.reason_category),
    reasonMessage: String(record.reason_message),
    requestMethod: String(record.request_method),
    requestPath: String(record.request_path),
    tokenId: record.token_id ? String(record.token_id) : undefined,
    tokenKind: record.token_kind ? tokenKindSchema.parse(record.token_kind) : undefined,
  };
}

/**
 * Persists a structured record of an API request failure for audit and monitoring.
 *
 * Truncates `reasonMessage`, `requestPath`, and `details` to their maximum column
 * lengths before inserting to prevent silent data loss from oversized inputs.
 *
 * @param input - Failure metadata including HTTP status, reason category, request context, and caller identity.
 * @param now - ISO timestamp for the `created_at` column. Defaults to the current time.
 */
export function recordApiFailure(input: RecordApiFailureInput, now = nowIso()): void {
  const detailsJson = input.details
    ? truncateString(JSON.stringify(input.details), MAX_DETAILS_JSON_LENGTH)
    : null;

  databaseRun(
    `INSERT INTO api_request_failures (
      id,
      created_at,
      http_status,
      request_method,
      request_path,
      reason_category,
      reason_message,
      client_id,
      token_id,
      token_kind,
      application_id,
      details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createId("apifail"),
    now,
    input.httpStatus,
    input.requestMethod,
    truncateString(input.requestPath, MAX_REQUEST_PATH_LENGTH),
    input.reasonCategory,
    truncateString(input.reasonMessage, MAX_REASON_MESSAGE_LENGTH),
    input.clientId ?? null,
    input.tokenId ?? null,
    input.tokenKind ?? null,
    input.applicationId ?? null,
    detailsJson,
  );
}

const DEFAULT_API_FAILURE_LIST_LIMIT = 100;

export function listApiFailures(filter: ListApiFailuresFilter = {}): ApiRequestFailure[] {
  const conditions: string[] = [];
  const parameters: Array<null | number | string> = [];

  if (filter.fromTimestamp) {
    conditions.push("created_at >= ?");
    parameters.push(filter.fromTimestamp);
  }

  if (filter.toTimestamp) {
    conditions.push("created_at <= ?");
    parameters.push(filter.toTimestamp);
  }

  if (filter.httpStatus !== undefined) {
    conditions.push("http_status = ?");
    parameters.push(filter.httpStatus);
  }

  if (filter.reasonCategory) {
    conditions.push("reason_category = ?");
    parameters.push(filter.reasonCategory);
  }

  if (filter.applicationId) {
    conditions.push("application_id = ?");
    parameters.push(filter.applicationId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filter.limit ?? DEFAULT_API_FAILURE_LIST_LIMIT;

  const rows = databaseAll(
    `SELECT
      id,
      created_at,
      http_status,
      request_method,
      request_path,
      reason_category,
      reason_message,
      client_id,
      token_id,
      token_kind,
      application_id,
      details_json
    FROM api_request_failures
    ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT ?`,
    ...parameters,
    limit,
  );

  return rows.map(mapApiRequestFailure);
}

export function applyApiFailureRetention(
  retentionDays: number,
  now = nowIso(),
): { purgedFailures: number } {
  const cutoff = calculateRetentionCutoff(new Date(now), retentionDays);
  const before = databaseGet(
    "SELECT COUNT(*) AS count FROM api_request_failures WHERE created_at < ?",
    cutoff,
  );
  const purgedFailures = Number(before?.count ?? 0);

  if (purgedFailures > 0) {
    databaseRun("DELETE FROM api_request_failures WHERE created_at < ?", cutoff);
  }

  return { purgedFailures };
}

function assertApplicationAdminExists(applicationAdminId: string): void {
  const existing = databaseGet(
    "SELECT id FROM application_admins WHERE id = ?",
    applicationAdminId,
  );

  if (!existing) {
    throw new Error("Application admin not found");
  }
}

function assertApplicationExists(applicationId: string): void {
  const existing = databaseGet("SELECT id FROM applications WHERE id = ?", applicationId);

  if (!existing) {
    throw new Error("Application not found");
  }
}

function getApplicationRecord(applicationId: string): DatabaseRecord {
  const record = databaseGet(
    `SELECT id, application_admin_id, label, created_at, updated_at
    FROM applications
    WHERE id = ?`,
    applicationId,
  );

  if (!record) {
    throw new Error("Application not found");
  }

  return record;
}

function assertApplicationManagedByApplicationAdmin(
  applicationAdminId: string,
  applicationId: string,
): void {
  const application = getApplicationRecord(applicationId);

  if (String(application.application_admin_id) !== applicationAdminId) {
    throw new Error("Application admin cannot manage a foreign application");
  }
}

function getConfigRecord(configId: string): DatabaseRecord {
  const record = databaseGet(
    `SELECT
      smtp_configs.id,
      smtp_configs.application_id,
      smtp_configs.name,
      smtp_configs.host,
      smtp_configs.port,
      smtp_configs.username,
      smtp_configs.default_from_address,
      smtp_configs.password_encrypted,
      smtp_configs.secure,
      smtp_configs.require_tls,
      smtp_configs.min_tls_version,
      smtp_configs.connection_timeout_ms,
      smtp_configs.greeting_timeout_ms,
      smtp_configs.socket_timeout_ms,
      smtp_configs.send_rate_limit_per_minute,
      smtp_configs.disabled_at,
      smtp_configs.locked_at,
      smtp_configs.created_at,
      smtp_configs.updated_at,
      applications.application_admin_id,
      applications.label AS application_label
    FROM smtp_configs
    INNER JOIN applications ON applications.id = smtp_configs.application_id
    WHERE smtp_configs.id = ?`,
    configId,
  );

  if (!record) {
    throw new Error("SMTP config not found");
  }

  return record;
}

function getApplicationConfigByApplicationId(applicationId: string): DatabaseRecord | undefined {
  return databaseGet(
    `SELECT
      smtp_configs.id,
      smtp_configs.application_id,
      smtp_configs.name,
      smtp_configs.host,
      smtp_configs.port,
      smtp_configs.username,
      smtp_configs.default_from_address,
      smtp_configs.password_encrypted,
      smtp_configs.secure,
      smtp_configs.require_tls,
      smtp_configs.min_tls_version,
      smtp_configs.connection_timeout_ms,
      smtp_configs.greeting_timeout_ms,
      smtp_configs.socket_timeout_ms,
      smtp_configs.send_rate_limit_per_minute,
      smtp_configs.disabled_at,
      smtp_configs.locked_at,
      smtp_configs.created_at,
      smtp_configs.updated_at,
      applications.application_admin_id,
      applications.label AS application_label
    FROM smtp_configs
    INNER JOIN applications ON applications.id = smtp_configs.application_id
    WHERE smtp_configs.application_id = ?`,
    applicationId,
  );
}

function readConfigSecret(configId: string): SmtpConfigSecret {
  const record = getConfigRecord(configId);

  if (!record.password_encrypted) {
    throw new Error("SMTP config password is not set");
  }

  return {
    ...mapSmtpConfigView({
      ...record,
      has_password: record.password_encrypted ? 1 : 0,
    }),
    password: decryptSecret(String(record.password_encrypted)),
  };
}

function getMailerTokenRecord(tokenId: string): DatabaseRecord {
  const applicationToken = databaseGet(
    `SELECT
      id,
      application_id,
      client_id,
      label,
      scopes_json,
      last_used_at,
      revoked_at,
      created_at,
      updated_at
    FROM application_tokens
    WHERE id = ?`,
    tokenId,
  );

  if (applicationToken) {
    return {
      ...applicationToken,
      config_id:
        getApplicationConfigByApplicationId(String(applicationToken.application_id))?.id ?? null,
      kind: "application",
    };
  }

  const adminToken = databaseGet(
    `SELECT
      id,
      application_admin_id,
      client_id,
      label,
      scopes_json,
      last_used_at,
      revoked_at,
      created_at,
      updated_at
    FROM application_admin_tokens
    WHERE id = ?`,
    tokenId,
  );

  if (adminToken) {
    return { ...adminToken, kind: "applicationAdmin" };
  }

  throw new Error("Token not found");
}

function logAudit(
  actorType: "system" | ActorType,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>,
): void {
  databaseRun(
    `INSERT INTO audit_logs (
      id,
      actor_type,
      actor_id,
      action,
      entity_type,
      entity_id,
      details_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    createId("audit"),
    actorType,
    actorId,
    action,
    entityType,
    entityId,
    JSON.stringify(details),
    nowIso(),
  );
}

async function resolveSafeSmtpTargets(host: string): Promise<SmtpResolvedTarget[]> {
  const lookupResult = await lookupSmtpHost(host, { all: true });

  if (lookupResult.length === 0) {
    throw new Error(`SMTP host could not be resolved: ${host}`);
  }

  for (const entry of lookupResult) {
    assertSafeResolvedAddress(entry.address, entry.family);
  }

  return lookupResult.map((entry) => ({
    address: entry.address,
    family: entry.family,
  }));
}

async function withResolvedSmtpTargets<T>(
  config: Pick<SmtpConfigSecret, "host" | "minTlsVersion" | "port" | "requireTls" | "secure">,
  phase: MailerDebugAttempt["phase"],
  operation: (target: SmtpResolvedTarget) => Promise<T>,
): Promise<
  | { debug: MailerDebugInfo; ok: true; value: T }
  | { debug?: MailerDebugInfo; error: unknown; ok: false }
> {
  let targets: SmtpResolvedTarget[];

  try {
    targets = await resolveSafeSmtpTargets(config.host);
  } catch (error) {
    return { error, ok: false };
  }

  const debug: MailerDebugInfo = {
    attempts: [],
    host: config.host,
    minTlsVersion: config.minTlsVersion,
    port: config.port,
    requireTls: config.requireTls,
    resolvedTargets: targets.map((target) => target.address),
    secure: config.secure,
  };

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];

    try {
      const value = await operation(target);
      debug.attempts.push({
        address: target.address,
        family: target.family,
        outcome: "succeeded",
        phase,
      });
      return { debug, ok: true, value };
    } catch (error) {
      const classified = classifyMailerError(error);
      debug.attempts.push({
        address: target.address,
        code: classified.code,
        family: target.family,
        message: classified.message,
        outcome: "failed",
        phase,
      });

      if (classified.category !== "network" || index === targets.length - 1) {
        return { debug, error, ok: false };
      }
    }
  }

  return {
    debug,
    error: new Error(`SMTP host could not be resolved: ${config.host}`),
    ok: false,
  };
}

function calculateRetryDelayMs(retryCount: number): number {
  return Math.min(60_000, 2_000 * 2 ** retryCount);
}

function classifyMailerError(error: unknown, debug?: MailerDebugInfo): MailerErrorResult {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Nodemailer throws loosely typed errors; each field is accessed defensively below.
  const candidate = error as {
    code?: string;
    message?: string;
    responseCode?: number;
  };
  const message = sanitizeErrorMessage(candidate.message || "Unknown mailer error");
  const responseCode =
    typeof candidate.responseCode === "number" ? candidate.responseCode : undefined;

  // Authentication failures are terminal regardless of their SMTP response
  // code, so they take precedence over the generic response-code handling
  // below (an EAUTH error typically carries a 5xx code such as 535).
  if (candidate.code === "EAUTH") {
    return {
      category: "auth",
      code: candidate.code,
      debug,
      message,
      ok: false,
      permanent: true,
      providerResponseCode: responseCode,
    };
  }

  if (
    candidate.code === "ESOCKET" ||
    candidate.code === "ECONNECTION" ||
    candidate.code === "ETIMEDOUT"
  ) {
    return {
      category: "network",
      code: candidate.code,
      debug,
      message,
      ok: false,
      permanent: false,
      providerResponseCode: responseCode,
    };
  }

  if (candidate.code === "ETLS") {
    return {
      category: "tls",
      code: candidate.code,
      debug,
      message,
      ok: false,
      permanent: true,
      providerResponseCode: responseCode,
    };
  }

  // Server-side rejections (nodemailer EENVELOPE/EMESSAGE carry a numeric SMTP
  // responseCode). A 5xx reply is a final rejection (e.g. 550/553/501), so the
  // message is permanently undeliverable and must not be retried. A 4xx reply is
  // a temporary failure and should be retried.
  if (responseCode !== undefined && responseCode >= 400) {
    if (responseCode >= 500) {
      return {
        category: "content",
        code: candidate.code,
        debug,
        message,
        ok: false,
        permanent: true,
        providerResponseCode: responseCode,
      };
    }

    // Transient 4xx: 421 (service not available) is connection-oriented, while
    // 450/451/452 (mailbox busy, local error, out of storage) behave like rate
    // limiting.
    const transientCategory: MailerErrorCategory = responseCode === 421 ? "network" : "rate_limit";
    return {
      category: transientCategory,
      code: candidate.code,
      debug,
      message,
      ok: false,
      permanent: false,
      providerResponseCode: responseCode,
    };
  }

  // Envelope/message rejections without a numeric response code: classify as a
  // content error and retry, since there is no reliable permanence signal.
  if (candidate.code === "EENVELOPE" || candidate.code === "EMESSAGE") {
    return {
      category: "content",
      code: candidate.code,
      debug,
      message,
      ok: false,
      permanent: false,
      providerResponseCode: responseCode,
    };
  }

  return {
    category: "unknown",
    code: candidate.code,
    debug,
    message,
    ok: false,
    permanent: false,
    providerResponseCode: responseCode,
  };
}

function createTransportForConfig(config: SmtpConfigSecret, target: SmtpResolvedTarget) {
  return createMailerTransport({
    auth: {
      pass: config.password,
      user: config.username,
    },
    connectionTimeout: config.connectionTimeoutMs,
    greetingTimeout: config.greetingTimeoutMs,
    host: target.address,
    port: config.port,
    requireTLS: config.requireTls,
    secure: config.secure,
    socketTimeout: config.socketTimeoutMs,
    tls: {
      minVersion: config.minTlsVersion,
      servername: isIP(config.host) === 0 ? config.host : undefined,
    },
  });
}

function writeJobEvent(jobId: string, status: string, details: Record<string, unknown>): void {
  databaseRun(
    "INSERT INTO job_events (id, job_id, status, details_json, created_at) VALUES (?, ?, ?, ?, ?)",
    createId("evt"),
    jobId,
    status,
    JSON.stringify(details),
    nowIso(),
  );
}

function validateApplicationScopes(scopes: TokenScope[]): void {
  if (scopes.some((scope) => ["manageApplications", "manageTokens"].includes(scope))) {
    throw new Error("Application tokens cannot include management scopes");
  }
}

function validateApplicationAdminScopes(scopes: TokenScope[]): void {
  if (scopes.includes("send")) {
    throw new Error("Application admin tokens cannot send mail directly");
  }

  if (scopes.includes("readConfig")) {
    throw new Error("Application admin tokens cannot read application SMTP configs directly");
  }
}

export function listApplicationAdmins(): ApplicationAdmin[] {
  return databaseAll(
    `SELECT id, label, created_at, updated_at
    FROM application_admins
    ORDER BY label ASC`,
  ).map(mapApplicationAdmin);
}

export function createApplicationAdmin(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  input: CreateApplicationAdminInput,
): ApplicationAdmin {
  const parsed = createApplicationAdminInputSchema.parse(input);
  const id = createId("appadm");
  const timestamp = nowIso();

  databaseRun(
    `INSERT INTO application_admins (id, label, created_at, updated_at)
    VALUES (?, ?, ?, ?)`,
    id,
    parsed.label,
    timestamp,
    timestamp,
  );

  logAudit(actorType, actorId, "application_admin.created", "application_admin", id, {});

  return getApplicationAdminById(id);
}

export function getApplicationAdminById(applicationAdminId: string): ApplicationAdmin {
  const record = databaseGet(
    `SELECT id, label, created_at, updated_at
    FROM application_admins
    WHERE id = ?`,
    applicationAdminId,
  );

  if (!record) {
    throw new Error("Application admin not found");
  }

  return mapApplicationAdmin(record);
}

export function listApplications(applicationAdminId?: string): Application[] {
  const records = applicationAdminId
    ? databaseAll(
        `SELECT id, application_admin_id, label, created_at, updated_at
        FROM applications
        WHERE application_admin_id = ?
        ORDER BY label ASC`,
        applicationAdminId,
      )
    : databaseAll(
        `SELECT id, application_admin_id, label, created_at, updated_at
        FROM applications
        ORDER BY label ASC`,
      );

  return records.map(mapApplication);
}

export function createApplication(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  input: CreateApplicationInput,
): Application {
  const parsed = createApplicationInputSchema.parse(input);
  assertApplicationAdminExists(parsed.applicationAdminId);
  const id = createId("app");
  const timestamp = nowIso();

  databaseRun(
    `INSERT INTO applications (id, application_admin_id, label, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)`,
    id,
    parsed.applicationAdminId,
    parsed.label,
    timestamp,
    timestamp,
  );

  logAudit(actorType, actorId, "application.created", "application", id, {
    applicationAdminId: parsed.applicationAdminId,
  });

  return getApplicationById(id);
}

export function renameApplicationAdmin(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  input: RenameApplicationAdminInput,
): ApplicationAdmin {
  const parsed = renameApplicationAdminInputSchema.parse(input);
  const previous = getApplicationAdminById(parsed.applicationAdminId);
  const timestamp = nowIso();

  databaseRun(
    `UPDATE application_admins SET label = ?, updated_at = ? WHERE id = ?`,
    parsed.label,
    timestamp,
    parsed.applicationAdminId,
  );

  logAudit(
    actorType,
    actorId,
    "application_admin.renamed",
    "application_admin",
    parsed.applicationAdminId,
    { nextLabel: parsed.label, previousLabel: previous.label },
  );

  return getApplicationAdminById(parsed.applicationAdminId);
}

export function renameApplication(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  input: RenameApplicationInput,
): Application {
  const parsed = renameApplicationInputSchema.parse(input);
  const previous = getApplicationById(parsed.applicationId);
  const timestamp = nowIso();

  databaseRun(
    `UPDATE applications SET label = ?, updated_at = ? WHERE id = ?`,
    parsed.label,
    timestamp,
    parsed.applicationId,
  );

  logAudit(actorType, actorId, "application.renamed", "application", parsed.applicationId, {
    nextLabel: parsed.label,
    previousLabel: previous.label,
  });

  return getApplicationById(parsed.applicationId);
}

export function getApplicationById(applicationId: string): Application {
  return mapApplication(getApplicationRecord(applicationId));
}

export function listSmtpConfigs(
  filters: {
    applicationAdminId?: string;
    configId?: string;
  } = {},
): SmtpConfigView[] {
  const clauses = ["1 = 1"];
  const values: Array<null | number | string> = [];

  // Restrict to a single config (application tokens only ever see their own config).
  if (filters.configId) {
    clauses.push("smtp_configs.id = ?");
    values.push(filters.configId);
  }

  // Restrict to configs whose owning application belongs to the admin (application admin tokens).
  if (filters.applicationAdminId) {
    clauses.push("applications.application_admin_id = ?");
    values.push(filters.applicationAdminId);
  }

  return databaseAll(
    `SELECT
      smtp_configs.id,
      smtp_configs.application_id,
      smtp_configs.name,
      smtp_configs.host,
      smtp_configs.port,
      smtp_configs.username,
      smtp_configs.default_from_address,
      smtp_configs.password_encrypted,
      smtp_configs.secure,
      smtp_configs.require_tls,
      smtp_configs.min_tls_version,
      smtp_configs.connection_timeout_ms,
      smtp_configs.greeting_timeout_ms,
      smtp_configs.socket_timeout_ms,
      smtp_configs.send_rate_limit_per_minute,
      smtp_configs.disabled_at,
      smtp_configs.locked_at,
      smtp_configs.created_at,
      smtp_configs.updated_at,
      applications.application_admin_id,
      applications.label AS application_label,
      CASE WHEN smtp_configs.password_encrypted IS NULL THEN 0 ELSE 1 END AS has_password
    FROM smtp_configs
    INNER JOIN applications ON applications.id = smtp_configs.application_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY applications.label ASC`,
    ...values,
  ).map(mapSmtpConfigView);
}

export function getSmtpConfig(configId: string): SmtpConfigView {
  const record = getConfigRecord(configId);
  return mapSmtpConfigView({ ...record, has_password: record.password_encrypted ? 1 : 0 });
}

export function getSmtpConfigByApplicationId(applicationId: string): null | SmtpConfigView {
  const record = getApplicationConfigByApplicationId(applicationId);

  if (!record) {
    return null;
  }

  return mapSmtpConfigView({
    ...record,
    has_password: record.password_encrypted ? 1 : 0,
  });
}

export function getSendRateLimitPerMinuteForConfig(configId: string): number {
  const record = databaseGet(
    "SELECT send_rate_limit_per_minute FROM smtp_configs WHERE id = ?",
    configId,
  );

  if (!record) {
    return getSendRateLimitPerMinute();
  }

  return Number(record.send_rate_limit_per_minute);
}

/**
 * Creates or updates the SMTP configuration for an application.
 *
 * When `configId` is omitted the function looks up an existing config for the
 * application and updates it if found, or inserts a new record if none exists.
 * Providing `configId` forces an update of that specific record.
 *
 * Invariants enforced before writing:
 * - The owning application must exist.
 * - Application admin actors may only modify configs belonging to their managed applications.
 * - A locked config (`locked_at IS NOT NULL`) cannot be updated.
 * - The `applicationId` of an existing config cannot be changed.
 * - Omitting `password` in the input preserves the stored encrypted password
 *   (`COALESCE(?, password_encrypted)`).
 *
 * @param actorId - ID of the actor performing the operation.
 * @param actorType - Role of the actor (`systemAdmin`, `application`, or `applicationAdmin`).
 * @param input - SMTP configuration fields to write.
 * @param configId - Optional ID of an existing config to update explicitly.
 * @returns The saved SMTP configuration view (without the plaintext password).
 * @throws {Error} If the application does not exist, the config is locked, or ownership checks fail.
 */
export function upsertSmtpConfig(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  input: UpsertSmtpConfigInput,
  configId?: string,
): SmtpConfigView {
  const parsed = upsertSmtpConfigInputSchema.parse(input);
  assertApplicationExists(parsed.applicationId);

  if (actorType === "applicationAdmin") {
    assertApplicationManagedByApplicationAdmin(actorId, parsed.applicationId);
  }

  const timestamp = nowIso();

  if (configId) {
    const existing = getConfigRecord(configId);

    if (existing.locked_at) {
      throw new Error("SMTP config is locked");
    }

    if (actorType === "applicationAdmin" && String(existing.application_admin_id) !== actorId) {
      throw new Error("Application admin cannot update a foreign SMTP config");
    }

    if (String(existing.application_id) !== parsed.applicationId) {
      throw new Error("SMTP config application cannot be changed");
    }

    databaseRun(
      `UPDATE smtp_configs
      SET
        name = ?,
        host = ?,
        port = ?,
        username = ?,
        default_from_address = ?,
        password_encrypted = COALESCE(?, password_encrypted),
        secure = ?,
        require_tls = ?,
        min_tls_version = ?,
        connection_timeout_ms = ?,
        greeting_timeout_ms = ?,
        socket_timeout_ms = ?,
        send_rate_limit_per_minute = ?,
        updated_at = ?
      WHERE id = ?`,
      parsed.name,
      parsed.host,
      parsed.port,
      parsed.username,
      parsed.defaultFromAddress,
      parsed.password ? encryptSecret(parsed.password) : null,
      parsed.secure ? 1 : 0,
      parsed.requireTls ? 1 : 0,
      parsed.minTlsVersion,
      parsed.connectionTimeoutMs,
      parsed.greetingTimeoutMs,
      parsed.socketTimeoutMs,
      parsed.sendRateLimitPerMinute,
      timestamp,
      configId,
    );

    logAudit(actorType, actorId, "smtp_config.updated", "smtp_config", configId, {
      applicationId: parsed.applicationId,
    });

    return getSmtpConfig(configId);
  }

  const existingForApplication = getApplicationConfigByApplicationId(parsed.applicationId);

  if (existingForApplication) {
    return upsertSmtpConfig(actorId, actorType, parsed, String(existingForApplication.id));
  }

  const id = createId("cfg");

  databaseRun(
    `INSERT INTO smtp_configs (
      id,
      application_id,
      name,
      host,
      port,
      username,
      default_from_address,
      password_encrypted,
      secure,
      require_tls,
      min_tls_version,
      connection_timeout_ms,
      greeting_timeout_ms,
      socket_timeout_ms,
      send_rate_limit_per_minute,
      disabled_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    parsed.applicationId,
    parsed.name,
    parsed.host,
    parsed.port,
    parsed.username,
    parsed.defaultFromAddress,
    parsed.password ? encryptSecret(parsed.password) : null,
    parsed.secure ? 1 : 0,
    parsed.requireTls ? 1 : 0,
    parsed.minTlsVersion,
    parsed.connectionTimeoutMs,
    parsed.greetingTimeoutMs,
    parsed.socketTimeoutMs,
    parsed.sendRateLimitPerMinute,
    null,
    timestamp,
    timestamp,
  );

  logAudit(actorType, actorId, "smtp_config.created", "smtp_config", id, {
    applicationId: parsed.applicationId,
  });

  return getSmtpConfig(id);
}

/**
 * Opens a live SMTP connection to verify that the stored configuration is reachable
 * and the credentials are accepted by the server.
 *
 * Resolves all IP addresses for the configured host, rejects non-globally-routable
 * addresses (SSRF protection via {@link assertSafeResolvedAddress}), and attempts
 * each address in sequence. The connection is closed immediately after the SMTP
 * handshake regardless of the outcome.
 *
 * @param configId - The ID of the SMTP configuration to validate.
 * @returns `{ ok: true }` on success, or a classified {@link MailerErrorResult} on failure.
 */
export async function validateSmtpConfig(
  configId: string,
): Promise<{ ok: true } | MailerErrorResult> {
  const config = readConfigSecret(configId);
  const result = await withResolvedSmtpTargets(config, "verify", async (target) => {
    const transport = createTransportForConfig(config, target);
    try {
      await transport.verify();
    } finally {
      transport.close();
    }
  });

  if (result.ok) {
    return { ok: true };
  }

  return classifyMailerError(result.error, result.debug);
}

/**
 * Locks an SMTP configuration, preventing further updates until it is unlocked.
 *
 * A locked config also blocks the creation of new application tokens (which require
 * the config to be writable). Calling this on an already-locked config is a no-op
 * that returns the current config view without writing to the database.
 *
 * @param actorId - ID of the actor performing the lock.
 * @param actorType - Role of the actor.
 * @param configId - ID of the SMTP configuration to lock.
 * @returns The SMTP configuration view with `lockedAt` set.
 */
export function lockSmtpConfig(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  configId: string,
): SmtpConfigView {
  const config = getSmtpConfig(configId);

  if (config.lockedAt) {
    return config;
  }

  const timestamp = nowIso();
  databaseRun(
    `UPDATE smtp_configs SET locked_at = ?, updated_at = ? WHERE id = ?`,
    timestamp,
    timestamp,
    configId,
  );
  logAudit(actorType, actorId, "smtp_config.locked", "smtp_config", configId, {});

  return getSmtpConfig(configId);
}

/**
 * Removes the lock from an SMTP configuration, re-enabling updates and new token creation.
 *
 * Calling this on an already-unlocked config is a no-op that returns the current
 * config view without writing to the database.
 *
 * @param actorId - ID of the actor performing the unlock.
 * @param actorType - Role of the actor.
 * @param configId - ID of the SMTP configuration to unlock.
 * @returns The SMTP configuration view with `lockedAt` cleared.
 */
export function unlockSmtpConfig(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  configId: string,
): SmtpConfigView {
  const config = getSmtpConfig(configId);

  if (!config.lockedAt) {
    return config;
  }

  const timestamp = nowIso();
  databaseRun(
    `UPDATE smtp_configs SET locked_at = NULL, updated_at = ? WHERE id = ?`,
    timestamp,
    configId,
  );
  logAudit(actorType, actorId, "smtp_config.unlocked", "smtp_config", configId, {});

  return getSmtpConfig(configId);
}

export function listApplicationAdminTokens(applicationAdminId: string): ApplicationAdminToken[] {
  assertApplicationAdminExists(applicationAdminId);

  return databaseAll(
    `SELECT
      id,
      application_admin_id,
      client_id,
      label,
      scopes_json,
      last_used_at,
      revoked_at,
      created_at,
      updated_at
    FROM application_admin_tokens
    WHERE application_admin_id = ?
    ORDER BY created_at DESC`,
    applicationAdminId,
  ).map(mapApplicationAdminToken);
}

export function listApplicationTokensByApplication(applicationId: string): ApplicationToken[] {
  assertApplicationExists(applicationId);

  return databaseAll(
    `SELECT
      application_tokens.id,
      application_tokens.application_id,
      application_tokens.client_id,
      application_tokens.label,
      application_tokens.scopes_json,
      application_tokens.last_used_at,
      application_tokens.revoked_at,
      application_tokens.created_at,
      application_tokens.updated_at,
      smtp_configs.id AS config_id
    FROM application_tokens
    LEFT JOIN smtp_configs ON smtp_configs.application_id = application_tokens.application_id
    WHERE application_tokens.application_id = ?
    ORDER BY application_tokens.created_at DESC`,
    applicationId,
  ).map(mapApplicationToken);
}

export function listTokensByConfig(configId: string): MailerToken[] {
  const config = getConfigRecord(configId);
  const applicationTokens = listApplicationTokensByApplication(String(config.application_id));
  const adminTokens = listApplicationAdminTokens(String(config.application_admin_id));

  return [...applicationTokens, ...adminTokens];
}

function getApplicationTokenByClientId(clientId: string): DatabaseRecord | undefined {
  return databaseGet(
    `SELECT
      application_tokens.id,
      application_tokens.application_id,
      application_tokens.client_id,
      application_tokens.hashed_token,
      application_tokens.scopes_json,
      application_tokens.revoked_at,
      application_tokens.updated_at,
      smtp_configs.id AS config_id
    FROM application_tokens
    INNER JOIN smtp_configs ON smtp_configs.application_id = application_tokens.application_id
    WHERE application_tokens.client_id = ?`,
    clientId,
  );
}

function getApplicationAdminTokenByClientId(clientId: string): DatabaseRecord | undefined {
  return databaseGet(
    `SELECT
      id,
      application_admin_id,
      client_id,
      hashed_token,
      scopes_json,
      revoked_at,
      updated_at
    FROM application_admin_tokens
    WHERE client_id = ?`,
    clientId,
  );
}

function updateTokenLastUsed(kind: "application" | "applicationAdmin", tokenId: string): void {
  const table = kind === "application" ? "application_tokens" : "application_admin_tokens";

  try {
    databaseRun(`UPDATE ${table} SET last_used_at = ? WHERE id = ?`, nowIso(), tokenId);
  } catch (error) {
    // Recording the last-used timestamp is best-effort telemetry. A failure here
    // — most notably a read-only database — must never break authentication or
    // the authenticated request, so the error is logged and swallowed instead of
    // propagating out of `authenticateAccessToken`. Read-only endpoints then keep
    // working even when the database cannot be written.
    console.error(
      `[token-last-used] failed to update last_used_at: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function issueSignedAccessToken(payload: AccessTokenPayload): IssuedAccessToken {
  return {
    accessToken: signJwt(payload),
    expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS,
    ok: true,
    tokenType: "Bearer",
  };
}

/**
 * Creates a new long-lived application admin token.
 *
 * The generated `clientSecret` is returned exactly once in the result; only its
 * SHA-256 hash is stored in the database. Scope validation rejects the `send` and
 * `readConfig` scopes, which are reserved for application tokens.
 *
 * @param actorId - ID of the actor performing the operation.
 * @param actorType - Role of the actor.
 * @param input - Token configuration including admin ID, label, scopes, and data retention settings.
 * @returns The new token record plus the one-time-visible `clientSecret`.
 * @throws {Error} If the application admin does not exist or the requested scopes are invalid for this token kind.
 */
export function createApplicationAdminToken(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  input: CreateApplicationAdminTokenInput,
): CreatedApplicationAdminToken {
  const parsed = createApplicationAdminTokenInputSchema.parse(input);
  validateApplicationAdminScopes(parsed.scopes);
  assertApplicationAdminExists(parsed.applicationAdminId);
  const id = createId("admtok");
  const clientId = createClientId("applicationAdmin");
  const timestamp = nowIso();
  const clientSecret = createPlainToken();

  databaseRun(
    `INSERT INTO application_admin_tokens (
      id,
      application_admin_id,
      client_id,
      label,
      hashed_token,
      token_preview,
      scopes_json,
      retain_sent_jobs_days,
      retain_failed_jobs_days,
      retain_attachments_days,
      retain_error_details_days,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    parsed.applicationAdminId,
    clientId,
    parsed.label,
    hashToken(clientSecret),
    getTokenPreview(clientSecret),
    JSON.stringify(parsed.scopes),
    parsed.retainSentJobsDays,
    parsed.retainFailedJobsDays,
    parsed.retainAttachmentsDays,
    parsed.retainErrorDetailsDays,
    timestamp,
    timestamp,
  );

  logAudit(actorType, actorId, "application_admin_token.created", "application_admin_token", id, {
    applicationAdminId: parsed.applicationAdminId,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Just inserted an admin token, so getTokenById resolves to the applicationAdmin union member.
  return {
    ...getTokenById(id),
    clientSecret,
  } as CreatedApplicationAdminToken;
}

/**
 * Creates a new long-lived application token.
 *
 * Requires that the application already has a non-locked SMTP configuration. The
 * configuration ID is embedded in access tokens so the worker knows which SMTP
 * server to use for mail delivery. Scope validation rejects management scopes
 * (`manageApplications`, `manageTokens`), which are reserved for admin tokens.
 *
 * The generated `clientSecret` is returned exactly once; only its SHA-256 hash is persisted.
 *
 * @param actorId - ID of the actor performing the operation.
 * @param actorType - Role of the actor.
 * @param input - Token configuration including application ID, label, scopes, and data retention settings.
 * @returns The new token record plus the one-time-visible `clientSecret`.
 * @throws {Error} If the application or its SMTP config does not exist, the config is locked, or scopes are invalid.
 */
export function createApplicationToken(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  input: CreateApplicationTokenInput,
): CreatedApplicationToken {
  const parsed = createApplicationTokenInputSchema.parse(input);
  validateApplicationScopes(parsed.scopes);
  assertApplicationExists(parsed.applicationId);

  const applicationConfig = getApplicationConfigByApplicationId(parsed.applicationId);

  if (!applicationConfig) {
    throw new Error("Application requires an SMTP config before tokens can be issued");
  }

  if (applicationConfig.locked_at) {
    throw new Error("SMTP config is locked");
  }

  const id = createId("apptok");
  const clientId = createClientId("application");
  const timestamp = nowIso();
  const clientSecret = createPlainToken();

  databaseRun(
    `INSERT INTO application_tokens (
      id,
      application_id,
      client_id,
      label,
      hashed_token,
      token_preview,
      scopes_json,
      retain_sent_jobs_days,
      retain_failed_jobs_days,
      retain_attachments_days,
      retain_error_details_days,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    parsed.applicationId,
    clientId,
    parsed.label,
    hashToken(clientSecret),
    getTokenPreview(clientSecret),
    JSON.stringify(parsed.scopes),
    parsed.retainSentJobsDays,
    parsed.retainFailedJobsDays,
    parsed.retainAttachmentsDays,
    parsed.retainErrorDetailsDays,
    timestamp,
    timestamp,
  );

  logAudit(actorType, actorId, "application_token.created", "application_token", id, {
    applicationId: parsed.applicationId,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Just inserted an application token, so getTokenById resolves to the application union member.
  return {
    ...getTokenById(id),
    clientSecret,
  } as CreatedApplicationToken;
}

export function createToken(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  input: LegacyCreateTokenInput,
): CreatedMailerToken {
  const config = getConfigRecord(input.configId);
  const application = getApplicationById(String(config.application_id));

  const admin = databaseGet("SELECT id FROM application_admins WHERE id = ?", input.principalId);
  if (admin) {
    if (String(config.application_admin_id) !== input.principalId) {
      throw new Error("Application admin can only receive tokens for managed applications");
    }

    return createApplicationAdminToken(actorId, actorType, {
      applicationAdminId: input.principalId,
      label: input.label,
      retainAttachmentsDays: input.retainAttachmentsDays,
      retainErrorDetailsDays: input.retainErrorDetailsDays,
      retainFailedJobsDays: input.retainFailedJobsDays,
      retainSentJobsDays: input.retainSentJobsDays,
      scopes: input.scopes,
    });
  }

  if (application.id !== input.principalId) {
    throw new Error("Application token must belong to the application owning the SMTP config");
  }

  return createApplicationToken(actorId, actorType, {
    applicationId: input.principalId,
    label: input.label,
    retainAttachmentsDays: input.retainAttachmentsDays,
    retainErrorDetailsDays: input.retainErrorDetailsDays,
    retainFailedJobsDays: input.retainFailedJobsDays,
    retainSentJobsDays: input.retainSentJobsDays,
    scopes: input.scopes,
  });
}

export function getTokenById(tokenId: string): ApplicationAdminToken | ApplicationToken {
  const record = getMailerTokenRecord(tokenId);
  return record.kind === "application"
    ? mapApplicationToken(record)
    : mapApplicationAdminToken(record);
}

/**
 * Replaces the secret of an existing token without changing its identity or scopes.
 *
 * Advances `updated_at` by at least one millisecond (see `advanceIsoTimestamp`) so
 * that any access tokens already signed against the previous `credentialUpdatedAt`
 * are immediately rejected on their next use. The old secret cannot be recovered
 * after rotation.
 *
 * @param actorId - ID of the actor performing the rotation.
 * @param actorType - Role of the actor.
 * @param tokenId - ID of the token to rotate.
 * @returns The updated token record plus the new one-time-visible `clientSecret`.
 */
export function rotateToken(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  tokenId: string,
): CreatedMailerToken {
  const token = getTokenById(tokenId);
  const clientSecret = createPlainToken();
  const table = token.kind === "application" ? "application_tokens" : "application_admin_tokens";

  databaseRun(
    `UPDATE ${table}
    SET
      hashed_token = ?,
      token_preview = ?,
      revoked_at = NULL,
      updated_at = ?
    WHERE id = ?`,
    hashToken(clientSecret),
    getTokenPreview(clientSecret),
    advanceIsoTimestamp(token.updatedAt),
    tokenId,
  );

  logAudit(actorType, actorId, `${token.kind}_token.rotated`, `${token.kind}_token`, tokenId, {});

  return {
    ...getTokenById(tokenId),
    clientSecret,
  };
}

/**
 * Exchanges a long-lived client credential pair for a short-lived Bearer access token.
 *
 * Looks up the token by `clientId` (trying application tokens first, then admin tokens),
 * verifies the secret against the stored hash, and issues a signed JWT valid for
 * `ACCESS_TOKEN_LIFETIME_SECONDS` seconds. The JWT embeds the token's current
 * `updated_at` as `credentialUpdatedAt`; token rotation or revocation changes
 * `updated_at`, causing {@link authenticateAccessToken} to reject previously issued JWTs
 * on their next use without waiting for expiry.
 *
 * @param input - The `clientId` and `clientSecret` to authenticate.
 * @returns A signed Bearer JWT with its expiry duration and token type.
 * @throws {Error} If the credentials are invalid, the token is revoked, or the client ID is unknown.
 */
export function issueClientAccessToken(input: IssueClientAccessTokenInput): IssuedAccessToken {
  const parsed = issueClientAccessTokenInputSchema.parse(input);
  const now = nowEpochSeconds();
  const applicationToken = getApplicationTokenByClientId(parsed.clientId);
  const adminToken = getApplicationAdminTokenByClientId(parsed.clientId);
  const applicationSecretMatches = verifyTokenHash(
    parsed.clientSecret,
    applicationToken ? String(applicationToken.hashed_token) : undefined,
  );
  const adminSecretMatches = verifyTokenHash(
    parsed.clientSecret,
    adminToken ? String(adminToken.hashed_token) : undefined,
  );

  if (applicationToken) {
    if (applicationToken.revoked_at || !applicationSecretMatches) {
      throw new Error("Invalid or revoked client credentials");
    }

    const scopes = storedTokenScopesSchema.parse(parseJson(String(applicationToken.scopes_json)));

    return issueSignedAccessToken({
      applicationId: String(applicationToken.application_id),
      aud: ACCESS_TOKEN_AUDIENCE,
      clientId: String(applicationToken.client_id),
      configId: String(applicationToken.config_id),
      credentialUpdatedAt: String(applicationToken.updated_at),
      exp: now + ACCESS_TOKEN_LIFETIME_SECONDS,
      iat: now,
      kind: "application",
      scopes,
      sub: String(applicationToken.client_id),
      tokenId: String(applicationToken.id),
    });
  }

  if (!adminToken || adminToken.revoked_at || !adminSecretMatches) {
    throw new Error("Invalid or revoked client credentials");
  }

  const scopes = storedTokenScopesSchema.parse(parseJson(String(adminToken.scopes_json)));

  return issueSignedAccessToken({
    applicationAdminId: String(adminToken.application_admin_id),
    aud: ACCESS_TOKEN_AUDIENCE,
    clientId: String(adminToken.client_id),
    credentialUpdatedAt: String(adminToken.updated_at),
    exp: now + ACCESS_TOKEN_LIFETIME_SECONDS,
    iat: now,
    kind: "applicationAdmin",
    scopes,
    sub: String(adminToken.client_id),
    tokenId: String(adminToken.id),
  });
}

/**
 * Marks a token as revoked, preventing further access token issuance.
 *
 * Outstanding access tokens issued before revocation will be rejected on their
 * next use because {@link authenticateAccessToken} checks `revoked_at` during
 * the live database lookup. The token record is retained; use {@link deleteToken}
 * for a hard delete.
 *
 * @param actorId - ID of the actor revoking the token.
 * @param actorType - Role of the actor.
 * @param tokenId - ID of the token to revoke.
 * @returns The updated token record with `revokedAt` set.
 */
export function revokeToken(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  tokenId: string,
): MailerToken {
  const token = getTokenById(tokenId);
  const table = token.kind === "application" ? "application_tokens" : "application_admin_tokens";

  databaseRun(
    `UPDATE ${table} SET revoked_at = ?, updated_at = ? WHERE id = ?`,
    nowIso(),
    nowIso(),
    tokenId,
  );
  logAudit(actorType, actorId, `${token.kind}_token.revoked`, `${token.kind}_token`, tokenId, {});

  return getTokenById(tokenId);
}

/**
 * Permanently removes a token from the database.
 *
 * Unlike {@link revokeToken}, which retains the record, this is a hard delete.
 * Any outstanding access tokens for this credential will be rejected on their
 * next authenticated request because the token row will no longer be found
 * during {@link authenticateAccessToken}'s live lookup.
 *
 * @param actorId - ID of the actor deleting the token.
 * @param actorType - Role of the actor.
 * @param tokenId - ID of the token to delete.
 */
export function deleteToken(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  tokenId: string,
): void {
  const token = getTokenById(tokenId);
  const table = token.kind === "application" ? "application_tokens" : "application_admin_tokens";

  databaseRun(`DELETE FROM ${table} WHERE id = ?`, tokenId);
  logAudit(actorType, actorId, `${token.kind}_token.deleted`, `${token.kind}_token`, tokenId, {});
}

/**
 * Replaces the scope set of an existing token.
 *
 * Scope validation is kind-specific: application tokens reject management scopes
 * (`manageApplications`, `manageTokens`); application admin tokens reject `send`
 * and `readConfig`. The updated scopes take effect on the next access token issuance;
 * existing short-lived access tokens continue to carry their previously embedded
 * scopes until they expire.
 *
 * @param actorId - ID of the actor performing the update.
 * @param actorType - Role of the actor.
 * @param tokenId - ID of the token whose scopes to replace.
 * @param input - The new scope list.
 * @returns The updated token record.
 * @throws {Error} If the requested scopes are invalid for the token kind.
 */
export function updateTokenScopes(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  tokenId: string,
  input: UpdateTokenScopesInput,
): ApplicationAdminToken | ApplicationToken {
  const parsed = updateTokenScopesInputSchema.parse(input);
  const token = getTokenById(tokenId);

  if (token.kind === "application") {
    validateApplicationScopes(parsed.scopes);
  } else {
    validateApplicationAdminScopes(parsed.scopes);
  }

  const table = token.kind === "application" ? "application_tokens" : "application_admin_tokens";

  databaseRun(
    `UPDATE ${table} SET scopes_json = ?, updated_at = ? WHERE id = ?`,
    JSON.stringify(parsed.scopes),
    nowIso(),
    tokenId,
  );

  logAudit(
    actorType,
    actorId,
    `${token.kind}_token.scopes_updated`,
    `${token.kind}_token`,
    tokenId,
    { scopes: parsed.scopes },
  );

  return getTokenById(tokenId);
}

/**
 * Validates a Bearer access token and returns its typed authentication context.
 *
 * Performs the following checks in order:
 * 1. JWT signature and structural validity via {@link verifyJwt}.
 * 2. `aud`, `exp`, `iat` and claim type guards.
 * 3. Optional scope check: throws if `requiredScope` is present but absent from the token.
 * 4. Live database lookup: verifies the token has not been revoked or rotated since
 *    issuance (the `credentialUpdatedAt` claim must match the stored `updated_at`).
 *
 * Updates `last_used_at` on success.
 *
 * @param rawToken - The compact JWT string from the `Authorization: Bearer` header.
 * @param requiredScope - If provided, the token must include this scope or the call throws.
 * @returns A typed {@link AuthenticatedToken} describing the principal and their scopes.
 * @throws {Error} If the token is invalid, expired, revoked, rotated, or missing the required scope.
 */
export function authenticateAccessToken(
  rawToken: string,
  requiredScope?: TokenScope,
): AuthenticatedToken {
  const payload = verifyJwt(rawToken);
  const aud = payload.aud;
  const exp = payload.exp;
  const iat = payload.iat;
  const tokenId = payload.tokenId;
  const kind = payload.kind;
  const clientId = payload.clientId;
  const credentialUpdatedAt = payload.credentialUpdatedAt;

  if (
    aud !== ACCESS_TOKEN_AUDIENCE ||
    typeof credentialUpdatedAt !== "string" ||
    typeof exp !== "number" ||
    typeof iat !== "number" ||
    typeof tokenId !== "string" ||
    typeof clientId !== "string"
  ) {
    throw new Error("Invalid or revoked token");
  }

  const now = nowEpochSeconds();

  if (exp <= now || iat > now + 30) {
    throw new Error("Invalid or revoked token");
  }

  const scopes = Array.isArray(payload.scopes)
    ? payload.scopes.map((scope) => tokenScopeSchema.parse(scope))
    : undefined;

  if (!scopes) {
    throw new Error("Invalid or revoked token");
  }

  if (requiredScope && !scopes.includes(requiredScope)) {
    throw new Error(`Token is missing required scope: ${requiredScope}`);
  }

  if (kind === "application") {
    const applicationToken = databaseGet(
      `SELECT
        application_tokens.id,
        application_tokens.application_id,
        application_tokens.client_id,
        application_tokens.revoked_at,
        application_tokens.updated_at,
        smtp_configs.id AS config_id
      FROM application_tokens
      INNER JOIN smtp_configs ON smtp_configs.application_id = application_tokens.application_id
      WHERE application_tokens.id = ?`,
      tokenId,
    );

    if (
      !applicationToken ||
      applicationToken.revoked_at ||
      String(applicationToken.client_id) !== clientId ||
      String(applicationToken.updated_at) !== credentialUpdatedAt
    ) {
      throw new Error("Invalid or revoked token");
    }

    updateTokenLastUsed("application", String(applicationToken.id));

    return {
      applicationId: String(applicationToken.application_id),
      clientId,
      configId: String(applicationToken.config_id),
      kind: "application",
      scopes,
      tokenId: String(applicationToken.id),
    };
  }

  if (kind !== "applicationAdmin") {
    throw new Error("Invalid or revoked token");
  }

  const adminToken = databaseGet(
    `SELECT
      id,
      application_admin_id,
      client_id,
      revoked_at,
      updated_at
    FROM application_admin_tokens
    WHERE id = ?`,
    tokenId,
  );

  if (
    !adminToken ||
    adminToken.revoked_at ||
    String(adminToken.client_id) !== clientId ||
    String(adminToken.updated_at) !== credentialUpdatedAt
  ) {
    throw new Error("Invalid or revoked token");
  }

  updateTokenLastUsed("applicationAdmin", String(adminToken.id));

  return {
    applicationAdminId: String(adminToken.application_admin_id),
    clientId,
    kind: "applicationAdmin",
    scopes,
    tokenId: String(adminToken.id),
  };
}

/**
 * Returns whether `authToken` may access the SMTP config identified by `configId`.
 *
 * Application tokens are restricted to their own config. Application admin tokens
 * can access any config whose owning application belongs to their admin account.
 *
 * @param authToken - The authenticated principal.
 * @param configId - The SMTP configuration ID to check.
 * @returns `true` if the token may access the config, `false` otherwise.
 */
export function canTokenAccessConfig(authToken: AuthenticatedToken, configId: string): boolean {
  const config = getConfigRecord(configId);

  if (authToken.kind === "application") {
    return authToken.configId === configId;
  }

  return String(config.application_admin_id) === authToken.applicationAdminId;
}

/**
 * Returns whether `authToken` may access the token identified by `tokenId`.
 *
 * Application tokens may only access tokens belonging to the same application.
 * Application admin tokens can access admin tokens for the same admin account and
 * application tokens for applications managed by that admin.
 *
 * @param authToken - The authenticated principal.
 * @param tokenId - The token ID to check.
 * @returns `true` if the token may access the target token, `false` otherwise.
 */
export function canTokenAccessToken(authToken: AuthenticatedToken, tokenId: string): boolean {
  const token = getTokenById(tokenId);

  if (authToken.kind === "application") {
    if (token.kind !== "application") {
      return false;
    }

    return token.applicationId === authToken.applicationId;
  }

  if (token.kind === "applicationAdmin") {
    return token.applicationAdminId === authToken.applicationAdminId;
  }

  return (
    getApplicationById(token.applicationId).applicationAdminId === authToken.applicationAdminId
  );
}

/**
 * Returns whether `authToken` may access the mail job identified by `jobId`.
 *
 * Application tokens are restricted to jobs belonging to their own application.
 * Application admin tokens can access jobs for any application they manage.
 *
 * @param authToken - The authenticated principal.
 * @param jobId - The mail job ID to check.
 * @returns `true` if the token may access the job, `false` otherwise.
 */
export function canTokenAccessJob(authToken: AuthenticatedToken, jobId: string): boolean {
  const job = getJob(jobId);

  if (authToken.kind === "application") {
    return job.applicationId === authToken.applicationId;
  }

  return getApplicationById(job.applicationId).applicationAdminId === authToken.applicationAdminId;
}

export function listJobs(
  filters: {
    applicationAdminId?: string;
    applicationId?: string;
    configId?: string;
    createdAfter?: string;
    createdBefore?: string;
    messageId?: string;
    status?: string;
  } = {},
): MailJob[] {
  const clauses = appendNotDeletedClause(["1 = 1"]);
  const values: Array<null | number | string> = [];

  if (filters.applicationId) {
    clauses.push("application_id = ?");
    values.push(filters.applicationId);
  }

  // Restrict to jobs whose owning application belongs to the admin (application admin tokens).
  // Kept as a subquery to avoid a JOIN and the resulting column-name ambiguity in the SELECT list.
  if (filters.applicationAdminId) {
    clauses.push("application_id IN (SELECT id FROM applications WHERE application_admin_id = ?)");
    values.push(filters.applicationAdminId);
  }

  if (filters.configId) {
    clauses.push("config_id = ?");
    values.push(filters.configId);
  }

  if (filters.createdAfter) {
    clauses.push("created_at >= ?");
    values.push(filters.createdAfter);
  }

  if (filters.createdBefore) {
    clauses.push("created_at <= ?");
    values.push(filters.createdBefore);
  }

  if (filters.messageId) {
    clauses.push("message_id = ?");
    values.push(filters.messageId);
  }

  if (filters.status) {
    clauses.push("status = ?");
    values.push(filters.status);
  }

  return databaseAll(
    `SELECT
      id,
      application_id,
      config_id,
      token_id,
      token_kind,
      idempotency_key,
      message_id,
      from_address,
      to_address,
      subject,
      html,
      text_body,
      headers_json,
      attachments_json,
      status,
      delivery_mode,
      retry_count,
      next_retry_at,
      last_error,
      error_category,
      error_permanent,
      error_code,
      provider_response_code,
      provider_message_id,
      created_at,
      updated_at,
      accepted_at,
      processing_started_at,
      sent_at,
      deleted_at
    FROM mail_jobs
    WHERE ${clauses.join(" AND ")}
    ORDER BY created_at DESC`,
    ...values,
  ).map(mapMailJob);
}

export function listJobStatusViews(
  filters: {
    applicationAdminId?: string;
    applicationId?: string;
    configId?: string;
    createdAfter?: string;
    createdBefore?: string;
    messageId?: string;
    status?: string;
  } = {},
): MailJobStatusView[] {
  const clauses = appendNotDeletedClause(["1 = 1"]);
  const values: Array<null | number | string> = [];

  if (filters.applicationId) {
    clauses.push("application_id = ?");
    values.push(filters.applicationId);
  }

  // Restrict to jobs whose owning application belongs to the admin (application admin tokens).
  // Kept as a subquery to avoid a JOIN and the resulting column-name ambiguity in the SELECT list.
  if (filters.applicationAdminId) {
    clauses.push("application_id IN (SELECT id FROM applications WHERE application_admin_id = ?)");
    values.push(filters.applicationAdminId);
  }

  if (filters.configId) {
    clauses.push("config_id = ?");
    values.push(filters.configId);
  }

  if (filters.createdAfter) {
    clauses.push("created_at >= ?");
    values.push(filters.createdAfter);
  }

  if (filters.createdBefore) {
    clauses.push("created_at <= ?");
    values.push(filters.createdBefore);
  }

  if (filters.messageId) {
    clauses.push("message_id = ?");
    values.push(filters.messageId);
  }

  if (filters.status) {
    clauses.push("status = ?");
    values.push(filters.status);
  }

  return databaseAll(
    `SELECT
      id,
      application_id,
      config_id,
      token_id,
      token_kind,
      idempotency_key,
      message_id,
      from_address,
      to_address,
      subject,
      attachments_json,
      status,
      delivery_mode,
      retry_count,
      next_retry_at,
      last_error,
      error_category,
      error_permanent,
      error_code,
      provider_response_code,
      provider_message_id,
      created_at,
      updated_at,
      accepted_at,
      processing_started_at,
      sent_at,
      deleted_at
    FROM mail_jobs
    WHERE ${clauses.join(" AND ")}
    ORDER BY created_at DESC`,
    ...values,
  ).map(mapMailJobStatusView);
}

export function getJob(jobId: string): MailJob {
  const record = databaseGet(
    `SELECT
      id,
      application_id,
      config_id,
      token_id,
      token_kind,
      idempotency_key,
      message_id,
      from_address,
      to_address,
      subject,
      html,
      text_body,
      headers_json,
      attachments_json,
      status,
      delivery_mode,
      retry_count,
      next_retry_at,
      last_error,
      error_category,
      error_permanent,
      error_code,
      provider_response_code,
      provider_message_id,
      created_at,
      updated_at,
      accepted_at,
      processing_started_at,
      sent_at,
      deleted_at
    FROM mail_jobs
    WHERE id = ?
      AND deleted_at IS NULL`,
    jobId,
  );

  if (!record) {
    throw new Error("Job not found");
  }

  return mapMailJob(record);
}

export function getJobStatusView(jobId: string): MailJobStatusView {
  const record = getJobStatusViewRecord(jobId);

  if (!record) {
    throw new Error("Job not found");
  }

  return mapMailJobStatusView(record);
}

export function getJobDeliveryStatus(jobId: string): DeliveryStatusResult {
  const record = getJobStatusViewRecord(jobId);

  return record ? mapJobDeliveryStatus(mapMailJobStatusView(record)) : unknownDeliveryStatus(jobId);
}

export function getJobDeliveryStatusForToken(
  authToken: AuthenticatedToken,
  jobId: string,
): DeliveryStatusResult {
  const record = getJobStatusViewRecord(jobId);

  if (!record) {
    return unknownDeliveryStatus(jobId);
  }

  const job = mapMailJobStatusView(record);

  if (!canTokenAccessJobStatusView(authToken, job)) {
    throw new Error("Token cannot read a job outside its ownership");
  }

  return mapJobDeliveryStatus(job);
}

export function listJobDeliveryStatuses(jobIds: string[]): DeliveryStatusResult[] {
  const jobsById = listJobStatusViewRecordsByIds(jobIds);

  return jobIds.map((jobId) => {
    const job = jobsById.get(jobId);

    return job ? mapJobDeliveryStatus(job) : unknownDeliveryStatus(jobId);
  });
}

export function listJobDeliveryStatusesForToken(
  authToken: AuthenticatedToken,
  jobIds: string[],
): DeliveryStatusResult[] {
  const jobsById = listJobStatusViewRecordsByIds(jobIds);

  for (const job of jobsById.values()) {
    if (!canTokenAccessJobStatusView(authToken, job)) {
      throw new Error("Token cannot read a job outside its ownership");
    }
  }

  return jobIds.map((jobId) => {
    const job = jobsById.get(jobId);

    return job ? mapJobDeliveryStatus(job) : unknownDeliveryStatus(jobId);
  });
}

/**
 * Creates a mail job for delivery via the authenticated application's SMTP configuration.
 *
 * Only application tokens (not admin tokens) may enqueue mail. When the input includes
 * an `idempotencyKey` and a non-deleted job with that key already exists for the same
 * application, the existing job is returned without creating a duplicate — enabling safe
 * retries from the caller. The `from` address falls back to the config's
 * `defaultFromAddress` when not provided. Retention settings are read from the token's
 * policy at enqueue time.
 *
 * @param authToken - The authenticated application token.
 * @param input - Mail content and optional idempotency key.
 * @param deliveryMode - `"queued"` to hand off to the worker, `"direct"` to process inline.
 * @returns The newly created (or idempotently matched) mail job in `queued` status.
 * @throws {Error} If `authToken` is not an application token.
 */
export function enqueueMail(
  authToken: AuthenticatedToken,
  input: SendMailInput,
  deliveryMode: DeliveryMode,
): MailJob {
  if (authToken.kind !== "application") {
    throw new Error("Only application tokens can enqueue mail");
  }

  const parsed = sendMailInputSchema.parse(input);
  const config = getSmtpConfig(authToken.configId);
  const resolvedInput: { from: string } & SendMailInput = {
    ...parsed,
    from: parsed.from ?? config.defaultFromAddress,
  };
  const retentionPolicy = getTokenRetentionPolicy(authToken.tokenId, authToken.kind);
  const existing =
    resolvedInput.idempotencyKey !== undefined
      ? databaseGet(
          `SELECT
            id,
            application_id,
            config_id,
            token_id,
            token_kind,
            idempotency_key,
            message_id,
            from_address,
            to_address,
            subject,
            html,
            text_body,
            headers_json,
            attachments_json,
            status,
            delivery_mode,
            retry_count,
            next_retry_at,
            last_error,
            error_category,
            error_permanent,
            error_code,
            provider_response_code,
            provider_message_id,
            created_at,
            updated_at,
            accepted_at,
            processing_started_at,
            sent_at,
            deleted_at
          FROM mail_jobs
          WHERE application_id = ?
            AND idempotency_key = ?
            AND deleted_at IS NULL`,
          authToken.applicationId,
          resolvedInput.idempotencyKey,
        )
      : undefined;

  if (existing) {
    return mapMailJob(existing);
  }

  return createMailJob({
    applicationId: authToken.applicationId,
    auditActorId: authToken.applicationId,
    auditActorType: "application",
    auditMeta: {
      applicationId: authToken.applicationId,
      configId: authToken.configId,
      tokenId: authToken.tokenId,
    },
    configId: authToken.configId,
    deliveryMode,
    eventMeta: { deliveryMode },
    input: resolvedInput,
    retentionPolicy,
    tokenId: authToken.tokenId,
    tokenKind: "application",
  });
}

function createMailJob(options: {
  applicationId: string;
  auditActorId: string;
  auditActorType: "systemAdmin" | ActorType;
  auditMeta: Record<string, unknown>;
  configId: string;
  deliveryMode: DeliveryMode;
  eventMeta: Record<string, unknown>;
  input: { from: string } & SendMailInput;
  retentionPolicy: {
    retainAttachmentsDays: number;
    retainErrorDetailsDays: number;
    retainFailedJobsDays: number;
    retainSentJobsDays: number;
  };
  tokenId: null | string;
  tokenKind: "application" | null;
}): MailJob {
  const jobId = createId("job");
  const timestamp = nowIso();

  getDatabase().transaction(() => {
    databaseRun(
      `INSERT INTO mail_jobs (
      id,
      application_id,
      config_id,
      token_id,
      token_kind,
      idempotency_key,
      message_id,
      from_address,
      to_address,
      subject,
      html,
      text_body,
      headers_json,
      attachments_json,
      retain_sent_jobs_days,
      retain_failed_jobs_days,
      retain_attachments_days,
      retain_error_details_days,
      status,
      delivery_mode,
      retry_count,
      created_at,
      updated_at,
      accepted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      jobId,
      options.applicationId,
      options.configId,
      options.tokenId,
      options.tokenKind,
      options.input.idempotencyKey || null,
      options.input.messageId,
      options.input.from,
      options.input.to,
      options.input.subject,
      options.input.html,
      options.input.text,
      JSON.stringify(options.input.headers),
      JSON.stringify(options.input.attachments),
      options.retentionPolicy.retainSentJobsDays,
      options.retentionPolicy.retainFailedJobsDays,
      options.retentionPolicy.retainAttachmentsDays,
      options.retentionPolicy.retainErrorDetailsDays,
      "queued",
      options.deliveryMode,
      0,
      timestamp,
      timestamp,
      timestamp,
    );

    writeJobEvent(jobId, "queued", options.eventMeta);
    logAudit(
      options.auditActorType,
      options.auditActorId,
      "mail_job.created",
      "mail_job",
      jobId,
      options.auditMeta,
    );
  })();

  return getJob(jobId);
}

/**
 * Enqueues and immediately delivers a test email as a system admin action.
 *
 * Creates a simple test job in `"direct"` mode using the SMTP config identified by
 * `configId` and processes it synchronously. The job is created with a 30-day
 * retention policy and is not associated with any application token.
 *
 * @param actorId - ID of the system admin initiating the test.
 * @param configId - ID of the SMTP configuration to test.
 * @param recipientEmail - The address to deliver the test message to.
 * @returns `{ ok: true, job }` on successful delivery, or a classified {@link MailerErrorResult} on failure.
 */
export async function sendSystemAdminTestMail(
  actorId: string,
  configId: string,
  recipientEmail: string,
): Promise<{ job: MailJob; ok: true } | MailerErrorResult> {
  const config = readConfigSecret(configId);
  const parsedInput = sendMailInputSchema.parse({
    attachments: [],
    from: config.defaultFromAddress,
    headers: {},
    html: "<p>This is a Relanto test email.</p>",
    messageId: `<${createId("testmail")}@relanto.local>`,
    subject: "Relanto SMTP test email",
    text: "This is a Relanto test email.",
    to: recipientEmail,
  } satisfies SendMailInput);
  const resolvedInput: { from: string } & SendMailInput = {
    ...parsedInput,
    from: config.defaultFromAddress,
  };
  const job = createMailJob({
    applicationId: config.applicationId,
    auditActorId: actorId,
    auditActorType: "systemAdmin",
    auditMeta: {
      applicationId: config.applicationId,
      configId: config.id,
      testMail: true,
    },
    configId: config.id,
    deliveryMode: "direct",
    eventMeta: { deliveryMode: "direct", testMail: true },
    input: resolvedInput,
    retentionPolicy: {
      retainAttachmentsDays: 30,
      retainErrorDetailsDays: 30,
      retainFailedJobsDays: 30,
      retainSentJobsDays: 30,
    },
    tokenId: null,
    tokenKind: null,
  });

  const result = await processJobDetailed(job.id);
  const finalJob = result.job;

  if (finalJob.status === "sent") {
    return { job: finalJob, ok: true };
  }

  return {
    category: finalJob.errorCategory ?? "unknown",
    code: finalJob.errorCode,
    debug: result.error?.debug,
    message: finalJob.lastError ?? "Test email could not be sent",
    ok: false,
    permanent: finalJob.errorPermanent ?? finalJob.status === "failed",
    providerResponseCode: finalJob.providerResponseCode,
  };
}

/**
 * Pauses a pending mail job, preventing it from being picked up by the worker.
 *
 * Only jobs in `queued`, `retry_scheduled`, `paused`, or `cancelled` status can be
 * paused. Attempting to pause a job that is `processing`, `sent`, `failed`, or
 * `delivery_uncertain` throws. Use {@link resumeJob} to re-queue a paused job.
 *
 * @param actorId - ID of the actor performing the pause.
 * @param actorType - Role of the actor.
 * @param jobId - ID of the mail job to pause.
 * @returns The updated mail job with `status = "paused"`.
 * @throws {Error} If the job is in a terminal or in-progress status.
 */
export function pauseJob(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  jobId: string,
): MailJob {
  const job = getJob(jobId);

  if (
    job.status === "processing" ||
    job.status === "sent" ||
    job.status === "failed" ||
    job.status === "delivery_uncertain"
  ) {
    throw new Error("Only pending jobs can be paused");
  }

  getDatabase().transaction(() => {
    databaseRun(
      "UPDATE mail_jobs SET status = ?, updated_at = ? WHERE id = ?",
      "paused",
      nowIso(),
      jobId,
    );
    writeJobEvent(jobId, "paused", {});
    logAudit(actorType, actorId, "mail_job.paused", "mail_job", jobId, {});
  })();

  return getJob(jobId);
}

/**
 * Re-queues a paused mail job for processing.
 *
 * The accumulated `retry_count` is intentionally preserved so that the automatic
 * exponential backoff continues from where it left off. To start a fresh delivery
 * attempt with a reset counter, use {@link retryJob} instead.
 *
 * @param actorId - ID of the actor performing the resume.
 * @param actorType - Role of the actor.
 * @param jobId - ID of the mail job to resume.
 * @returns The updated mail job with `status = "queued"`.
 * @throws {Error} If the job is not currently in `paused` status.
 */
export function resumeJob(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  jobId: string,
): MailJob {
  const job = getJob(jobId);

  if (job.status !== "paused") {
    throw new Error("Only paused jobs can be resumed");
  }

  getDatabase().transaction(() => {
    // Resuming only lifts the manual pause; the accumulated retry_count reflects real
    // delivery attempts and is intentionally preserved so the automatic backoff
    // progression continues where it left off.
    databaseRun(
      "UPDATE mail_jobs SET status = ?, next_retry_at = NULL, updated_at = ? WHERE id = ?",
      "queued",
      nowIso(),
      jobId,
    );
    writeJobEvent(jobId, "queued", { resumed: true });
    logAudit(actorType, actorId, "mail_job.resumed", "mail_job", jobId, {});
  })();

  return getJob(jobId);
}

/**
 * Manually re-queues a failed or delivery-uncertain job as a fresh delivery attempt.
 *
 * Unlike automatic retries (which increment `retry_count` and advance the exponential
 * backoff), a manual retry resets `retry_count` to 0 so the next failure starts the
 * backoff sequence from the beginning. All error fields are also cleared so the job
 * appears clean for the next attempt.
 *
 * @param actorId - ID of the actor requesting the retry.
 * @param actorType - Role of the actor.
 * @param jobId - ID of the mail job to retry.
 * @returns The updated mail job with `status = "queued"` and `retryCount = 0`.
 * @throws {Error} If the job is not in `failed` or `delivery_uncertain` status.
 */
export function retryJob(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  jobId: string,
): MailJob {
  const job = getJob(jobId);

  if (!["delivery_uncertain", "failed"].includes(job.status)) {
    throw new Error("Only failed or uncertain jobs can be retried manually");
  }

  getDatabase().transaction(() => {
    // A manual retry is an operator-initiated fresh start: reset retry_count so the
    // exponential backoff restarts from the beginning instead of immediately hitting
    // the delivery_uncertain threshold (and the maximum delay) on the next failure.
    databaseRun(
      `UPDATE mail_jobs
    SET
      status = ?,
      retry_count = 0,
      next_retry_at = NULL,
      last_error = NULL,
      error_category = NULL,
      error_permanent = NULL,
      error_code = NULL,
      provider_response_code = NULL,
      updated_at = ?
    WHERE id = ?`,
      "queued",
      nowIso(),
      jobId,
    );
    writeJobEvent(jobId, "queued", { manualRetry: true });
    logAudit(actorType, actorId, "mail_job.retry_requested", "mail_job", jobId, {});
  })();

  return getJob(jobId);
}

/**
 * Cancels and soft-deletes a mail job.
 *
 * Sets `status = "cancelled"`, stamps `deleted_at`, and clears `idempotency_key` so
 * the same key can be reused for a new job. Jobs that are currently `processing` or
 * have already been `sent` cannot be deleted.
 *
 * @param actorId - ID of the actor deleting the job.
 * @param actorType - Role of the actor.
 * @param jobId - ID of the mail job to cancel and delete.
 * @throws {Error} If the job is currently being processed or has already been sent.
 */
export function deleteJob(
  actorId: string,
  actorType: "systemAdmin" | ActorType,
  jobId: string,
): void {
  const job = getJob(jobId);

  if (job.status === "processing") {
    throw new Error("Processing jobs cannot be deleted");
  }

  if (job.status === "sent") {
    throw new Error("Sent jobs cannot be deleted");
  }

  getDatabase().transaction(() => {
    databaseRun(
      "UPDATE mail_jobs SET status = ?, deleted_at = ?, idempotency_key = NULL, updated_at = ? WHERE id = ?",
      "cancelled",
      nowIso(),
      nowIso(),
      jobId,
    );
    writeJobEvent(jobId, "cancelled", { deleted: true });
    logAudit(actorType, actorId, "mail_job.deleted", "mail_job", jobId, {});
  })();
}

/**
 * Resets all jobs stuck in `processing` status back to `queued`.
 *
 * In the single-process SQLite setup, any job still marked `processing` at boot was
 * orphaned by a crash or hard kill between the claim write and the final status update.
 * This function is called once on worker startup, before the tick loop begins, so no
 * such jobs are silently abandoned.
 *
 * @param now - ISO timestamp used as the new `updated_at` value for reclaimed rows.
 * @returns The number of jobs that were reclaimed.
 */
export function reclaimStuckProcessingJobs(now = nowIso()): number {
  return getDatabase().transaction(() => {
    const reclaimed = databaseAll(
      `UPDATE mail_jobs
    SET status = ?, processing_started_at = NULL, updated_at = ?
    WHERE status = ? AND deleted_at IS NULL
    RETURNING id`,
      "queued",
      now,
      "processing",
    );

    for (const record of reclaimed) {
      writeJobEvent(String(record.id), "queued", { reclaimedOnStartup: true });
    }

    return reclaimed.length;
  })();
}

/**
 * Moves jobs that have been in `processing` status longer than `timeoutMs` back to
 * `retry_scheduled`, so the worker can attempt them again on the next tick.
 *
 * A job becomes stuck in `processing` when the worker crashes after claiming it but
 * before recording the outcome. Unlike {@link reclaimStuckProcessingJobs} (which runs
 * once at startup), this function is called on every worker tick to catch jobs that
 * time out after a crash-free start.
 *
 * @param now - ISO timestamp for both the cutoff calculation and new `updated_at` values.
 * @param timeoutMs - Maximum milliseconds a job may remain in `processing` before being reaped.
 * @returns The number of jobs moved to `retry_scheduled`.
 */
export function reapTimedOutProcessingJobs(
  now = nowIso(),
  timeoutMs = getProcessingTimeoutMs(),
): number {
  const cutoff = new Date(new Date(now).getTime() - timeoutMs).toISOString();

  return getDatabase().transaction(() => {
    const reaped = databaseAll(
      `UPDATE mail_jobs
    SET status = ?, next_retry_at = ?, updated_at = ?
    WHERE status = ?
      AND deleted_at IS NULL
      AND processing_started_at IS NOT NULL
      AND processing_started_at <= ?
    RETURNING id`,
      "retry_scheduled",
      now,
      now,
      "processing",
      cutoff,
    );

    for (const record of reaped) {
      writeJobEvent(String(record.id), "retry_scheduled", { reapedAfterTimeoutMs: timeoutMs });
    }

    return reaped.length;
  })();
}

function claimJobById(jobId: string, now: string): MailJob | undefined {
  const claimed = getDatabase().transaction(() => {
    const claimedRow = databaseGet(
      `UPDATE mail_jobs
    SET status = ?, processing_started_at = ?, updated_at = ?
    WHERE id = ?
      AND deleted_at IS NULL
      AND ${isJobDueConditionSql()}
    RETURNING id`,
      "processing",
      now,
      now,
      jobId,
      now,
    );

    if (!claimedRow) {
      return false;
    }

    writeJobEvent(jobId, "processing", {});

    return true;
  })();

  if (!claimed) {
    return undefined;
  }

  return getJob(jobId);
}

function claimNextDueJob(now: string): MailJob | undefined {
  const jobId = getDatabase().transaction(() => {
    const claimed = databaseGet(
      `UPDATE mail_jobs
    SET status = ?, processing_started_at = ?, updated_at = ?
    WHERE id = (
      SELECT queued_jobs.id
      FROM mail_jobs queued_jobs
      WHERE queued_jobs.deleted_at IS NULL
        AND ${isJobDueConditionSql("queued_jobs")}
      ORDER BY queued_jobs.created_at ASC
      LIMIT 1
    )
    RETURNING id`,
      "processing",
      now,
      now,
      now,
    );

    if (!claimed) {
      return;
    }

    const claimedJobId = String(claimed.id);
    writeJobEvent(claimedJobId, "processing", {});

    return claimedJobId;
  })();

  if (!jobId) {
    return undefined;
  }

  return getJob(jobId);
}

async function processClaimedJobDetailed(
  job: MailJob,
): Promise<{ error?: MailerErrorResult; job: MailJob }> {
  const jobId = job.id;
  const config = readConfigSecret(job.configId);
  const attempt = await withResolvedSmtpTargets(config, "send", async (target) => {
    const transport = createTransportForConfig(config, target);
    try {
      return await transport.sendMail({
        attachments: job.attachments.map((attachment) => ({
          cid: attachment.cid,
          content: Buffer.from(attachment.contentBase64, "base64"),
          contentDisposition: attachment.contentDisposition,
          contentType: attachment.contentType,
          filename: attachment.filename,
        })),
        from: job.from,
        headers: job.headers,
        html: job.html,
        messageId: job.messageId,
        subject: job.subject,
        text: job.text,
        to: job.to,
      });
    } finally {
      transport.close();
    }
  });

  if (attempt.ok) {
    const result = attempt.value;
    getDatabase().transaction(() => {
      databaseRun(
        `UPDATE mail_jobs
      SET
        status = ?,
        provider_message_id = ?,
        sent_at = ?,
        next_retry_at = NULL,
        last_error = NULL,
        error_category = NULL,
        error_permanent = NULL,
        error_code = NULL,
        provider_response_code = NULL,
        updated_at = ?
      WHERE id = ?`,
        "sent",
        result.messageId || null,
        nowIso(),
        nowIso(),
        jobId,
      );
      writeJobEvent(jobId, "sent", { providerMessageId: result.messageId || null });
    })();
    logJobResult({ jobId, retryCount: job.retryCount, status: "sent" });

    return { job: getJob(jobId) };
  }

  const classified = classifyMailerError(attempt.error, attempt.debug);
  const retryCount = job.retryCount + 1;
  const nextRetryAt = classified.permanent
    ? null
    : new Date(Date.now() + calculateRetryDelayMs(job.retryCount)).toISOString();
  const nextStatus = classified.permanent
    ? "failed"
    : retryCount >= 5
      ? "delivery_uncertain"
      : "retry_scheduled";

  getDatabase().transaction(() => {
    databaseRun(
      `UPDATE mail_jobs
    SET
      status = ?,
      retry_count = ?,
      next_retry_at = ?,
      last_error = ?,
      error_category = ?,
      error_permanent = ?,
      error_code = ?,
      provider_response_code = ?,
      updated_at = ?
    WHERE id = ?`,
      nextStatus,
      retryCount,
      nextStatus === "retry_scheduled" ? nextRetryAt : null,
      classified.message,
      classified.category,
      classified.permanent ? 1 : 0,
      classified.code || null,
      classified.providerResponseCode || null,
      nowIso(),
      jobId,
    );

    writeJobEvent(jobId, nextStatus, {
      code: classified.code,
      permanent: classified.permanent,
      providerResponseCode: classified.providerResponseCode,
    });
  })();
  logJobResult({
    errorCategory: classified.category,
    errorCode: classified.code,
    jobId,
    retryCount,
    status: nextStatus,
  });

  return { error: classified, job: getJob(jobId) };
}

async function processClaimedJob(job: MailJob): Promise<MailJob> {
  return (await processClaimedJobDetailed(job)).job;
}

export function setSmtpTestDependencies(
  dependencies: Partial<{
    createMailerTransport: typeof createMailerTransport;
    lookupSmtpHost: typeof lookupSmtpHost;
  }>,
): void {
  if (dependencies.lookupSmtpHost) {
    lookupSmtpHost = dependencies.lookupSmtpHost;
  }

  if (dependencies.createMailerTransport) {
    createMailerTransport = dependencies.createMailerTransport;
  }
}

export function resetSmtpTestDependencies(): void {
  lookupSmtpHost = dnsLookup;
  createMailerTransport = nodemailer.createTransport.bind(nodemailer);
}

/**
 * Runs the full retention sweep: mail job purge/redaction and API failure purge.
 *
 * Delegates to {@link applyJobRetention} and {@link applyApiFailureRetention} using
 * the configured `API_FAILURE_RETENTION_DAYS` value. Called periodically by the
 * worker's retention timer.
 *
 * @param now - ISO timestamp used as the reference point for all cutoff calculations.
 */
export function runRetention(now = nowIso()): void {
  applyJobRetention(now);
  applyApiFailureRetention(getApiFailureRetentionDays(), now);
}

/**
 * Processes up to `limit` due mail jobs in a single worker tick.
 *
 * First reaps any timed-out processing jobs (see {@link reapTimedOutProcessingJobs}),
 * then claims and processes queued or retry-scheduled jobs one at a time, oldest
 * first, until the limit is reached or the queue is empty. Each job is claimed
 * atomically via a conditional UPDATE to prevent double-processing.
 *
 * @param limit - Maximum number of jobs to process in this tick. Defaults to 10.
 * @returns The final state of each processed job.
 */
export async function processDueJobs(limit = 10): Promise<MailJob[]> {
  reapTimedOutProcessingJobs();
  const processed: MailJob[] = [];

  for (let index = 0; index < limit; index += 1) {
    const claimedJob = claimNextDueJob(nowIso());

    if (!claimedJob) {
      break;
    }

    processed.push(await processClaimedJob(claimedJob));
  }

  return processed;
}

/**
 * Claims and processes a single mail job by ID.
 *
 * Returns the current job state unchanged if the job is deleted, paused, already
 * sent, or currently being processed by another concurrent tick. The claim is
 * performed atomically with a conditional UPDATE so only one worker tick can
 * process the job at a time.
 *
 * @param jobId - The ID of the job to process.
 * @returns The final state of the job after processing, or the unchanged state if the job was skipped.
 */
export async function processJob(jobId: string): Promise<MailJob> {
  const current = getJob(jobId);

  if (
    current.deletedAt ||
    current.status === "paused" ||
    current.status === "sent" ||
    current.status === "processing"
  ) {
    return current;
  }

  const claimedJob = claimJobById(jobId, nowIso());

  if (!claimedJob) {
    return getJob(jobId);
  }

  return processClaimedJob(claimedJob);
}

async function processJobDetailed(
  jobId: string,
): Promise<{ error?: MailerErrorResult; job: MailJob }> {
  const current = getJob(jobId);

  if (
    current.deletedAt ||
    current.status === "paused" ||
    current.status === "sent" ||
    current.status === "processing"
  ) {
    return { job: current };
  }

  const claimedJob = claimJobById(jobId, nowIso());

  if (!claimedJob) {
    return { job: getJob(jobId) };
  }

  return processClaimedJobDetailed(claimedJob);
}
