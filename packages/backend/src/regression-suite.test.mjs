import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDatabase, resetDatabase } from "./db.ts";
import {
  applyApiFailureRetention,
  authenticateAccessToken,
  applyJobRetention,
  createApplication,
  createApplicationAdmin,
  createApplicationAdminToken,
  createApplicationToken,
  deleteJob,
  enqueueMail,
  getJob,
  getJobStatusView,
  issueClientAccessToken,
  listApiFailures,
  listJobs,
  listJobStatusViews,
  pauseJob,
  recordApiFailure,
  resumeJob,
  retryJob,
  revokeToken,
  rotateToken,
  upsertSmtpConfig,
} from "./service.ts";

function createFixture() {
  const admin = createApplicationAdmin("system", "systemAdmin", { label: "Admin" });
  const application = createApplication("system", "systemAdmin", {
    applicationAdminId: admin.id,
    label: "App",
  });
  const config = upsertSmtpConfig("system", "systemAdmin", {
    applicationId: application.id,
    connectionTimeoutMs: 10_000,
    defaultFromAddress: "sender@example.com",
    greetingTimeoutMs: 10_000,
    host: "smtp.example.com",
    minTlsVersion: "TLSv1.2",
    name: "Primary SMTP",
    password: "secret",
    port: 587,
    requireTls: true,
    secure: false,
    socketTimeoutMs: 20_000,
    username: "mailer",
  });
  const applicationToken = createApplicationToken("system", "systemAdmin", {
    applicationId: application.id,
    label: "Application token",
    retainAttachmentsDays: 30,
    retainErrorDetailsDays: 30,
    retainFailedJobsDays: 30,
    retainSentJobsDays: 30,
    scopes: ["send", "readStatus"],
  });
  const applicationAdminToken = createApplicationAdminToken("system", "systemAdmin", {
    applicationAdminId: admin.id,
    label: "Admin token",
    retainAttachmentsDays: 30,
    retainErrorDetailsDays: 30,
    retainFailedJobsDays: 30,
    retainSentJobsDays: 30,
    scopes: ["manageApplications", "manageTokens", "readStatus"],
  });

  return {
    admin,
    application,
    applicationAdminToken,
    applicationToken,
    authToken: {
      applicationId: application.id,
      configId: config.id,
      kind: "application",
      scopes: ["send", "readStatus"],
      tokenId: applicationToken.id,
    },
    config,
  };
}

function createSendMailInput(overrides = {}) {
  return {
    attachments: [],
    from: "sender@example.com",
    headers: {},
    html: "<p>Hello</p>",
    messageId: "msg-1",
    subject: "Hello",
    text: "Hello",
    to: "recipient@example.com",
    ...overrides,
  };
}

function createAttachment() {
  return {
    contentBase64: Buffer.from("attachment").toString("base64"),
    contentDisposition: "attachment",
    contentType: "text/plain",
    filename: "attachment.txt",
  };
}

describe("regression suite", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-regression-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    rmSync(tempDir, { force: true, recursive: true });
  });

  describe("token authentication", () => {
    it("authenticates a valid application token with the requested scope", () => {
      const { application, applicationToken, config } = createFixture();
      const accessToken = issueClientAccessToken({
        clientId: applicationToken.clientId,
        clientSecret: applicationToken.clientSecret,
      }).accessToken;

      expect(authenticateAccessToken(accessToken, "send")).toStrictEqual({
        applicationId: application.id,
        clientId: applicationToken.clientId,
        configId: config.id,
        kind: "application",
        scopes: ["send", "readStatus"],
        tokenId: applicationToken.id,
      });
    });

    it("rejects tokens that are missing the required scope", () => {
      const { applicationToken } = createFixture();
      const accessToken = issueClientAccessToken({
        clientId: applicationToken.clientId,
        clientSecret: applicationToken.clientSecret,
      }).accessToken;

      expect(() => authenticateAccessToken(accessToken, "manageTokens")).toThrowError(
        "Token is missing required scope: manageTokens",
      );
    });

    it("authenticates application tokens with the readConfig scope", () => {
      const { application, config } = createFixture();
      const token = createApplicationToken("system", "systemAdmin", {
        applicationId: application.id,
        label: "Config reader",
        retainAttachmentsDays: 30,
        retainErrorDetailsDays: 30,
        retainFailedJobsDays: 30,
        retainSentJobsDays: 30,
        scopes: ["readConfig"],
      });
      const accessToken = issueClientAccessToken({
        clientId: token.clientId,
        clientSecret: token.clientSecret,
      }).accessToken;

      expect(authenticateAccessToken(accessToken, "readConfig")).toStrictEqual({
        applicationId: application.id,
        clientId: token.clientId,
        configId: config.id,
        kind: "application",
        scopes: ["readConfig"],
        tokenId: token.id,
      });
    });

    it("rejects revoked admin tokens", () => {
      const { admin, applicationAdminToken } = createFixture();
      const accessToken = issueClientAccessToken({
        clientId: applicationAdminToken.clientId,
        clientSecret: applicationAdminToken.clientSecret,
      }).accessToken;

      revokeToken(admin.id, "applicationAdmin", applicationAdminToken.id);

      expect(() => authenticateAccessToken(accessToken, "manageTokens")).toThrowError(
        "Invalid or revoked token",
      );
    });
  });

  describe("token management", () => {
    it("rejects deprecated manageOwnTokens scopes for application admin tokens", () => {
      const { admin } = createFixture();

      expect(() =>
        createApplicationAdminToken("system", "systemAdmin", {
          applicationAdminId: admin.id,
          label: "Deprecated scope token",
          retainAttachmentsDays: 30,
          retainErrorDetailsDays: 30,
          retainFailedJobsDays: 30,
          retainSentJobsDays: 30,
          scopes: ["manageOwnTokens"],
        }),
      ).toThrowError();
    });

    it("rejects readConfig scopes for application admin tokens", () => {
      const { admin } = createFixture();

      expect(() =>
        createApplicationAdminToken("system", "systemAdmin", {
          applicationAdminId: admin.id,
          label: "Config reader",
          retainAttachmentsDays: 30,
          retainErrorDetailsDays: 30,
          retainFailedJobsDays: 30,
          retainSentJobsDays: 30,
          scopes: ["readConfig"],
        }),
      ).toThrowError("Application admin tokens cannot read application SMTP configs directly");
    });

    it("rotates application tokens and invalidates the previous secret", () => {
      const { applicationToken } = createFixture();
      const accessToken = issueClientAccessToken({
        clientId: applicationToken.clientId,
        clientSecret: applicationToken.clientSecret,
      }).accessToken;

      const rotated = rotateToken("system", "systemAdmin", applicationToken.id);

      expect(() => authenticateAccessToken(accessToken, "send")).toThrowError(
        "Invalid or revoked token",
      );
      expect(
        authenticateAccessToken(
          issueClientAccessToken({
            clientId: rotated.clientId,
            clientSecret: rotated.clientSecret,
          }).accessToken,
          "send",
        ),
      ).toMatchObject({
        clientId: rotated.clientId,
        kind: "application",
        tokenId: applicationToken.id,
      });
    });

    it("invalidates the previous secret even when rotation happens in the same millisecond", () => {
      // Freeze time so token creation, access-token issuance and rotation all
      // share the exact same millisecond. Rotation must still advance the
      // token's updated_at, otherwise the previously issued access token (which
      // embeds the prior credentialUpdatedAt) would keep validating.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      try {
        const { applicationToken } = createFixture();
        const accessToken = issueClientAccessToken({
          clientId: applicationToken.clientId,
          clientSecret: applicationToken.clientSecret,
        }).accessToken;

        rotateToken("system", "systemAdmin", applicationToken.id);

        expect(() => authenticateAccessToken(accessToken, "send")).toThrowError(
          "Invalid or revoked token",
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("revokes application tokens so they can no longer authenticate", () => {
      const { applicationToken } = createFixture();
      const accessToken = issueClientAccessToken({
        clientId: applicationToken.clientId,
        clientSecret: applicationToken.clientSecret,
      }).accessToken;

      revokeToken("system", "systemAdmin", applicationToken.id);

      expect(() => authenticateAccessToken(accessToken, "send")).toThrowError(
        "Invalid or revoked token",
      );
    });
  });

  describe("job status transitions", () => {
    it("pauses and resumes queued jobs", () => {
      const { application, authToken } = createFixture();
      const job = enqueueMail(authToken, createSendMailInput(), "queued");

      const paused = pauseJob(application.id, "application", job.id);
      expect(paused.status).toBe("paused");

      const resumed = resumeJob(application.id, "application", job.id);
      expect(resumed.status).toBe("queued");
    });

    it("retries failed jobs and rejects retry for queued jobs", () => {
      const { application, authToken } = createFixture();
      const job = enqueueMail(authToken, createSendMailInput(), "queued");

      expect(() => retryJob(application.id, "application", job.id)).toThrowError(
        "Only failed or uncertain jobs can be retried manually",
      );

      getDatabase()
        .prepare(
          `UPDATE mail_jobs
          SET
            status = 'failed',
            last_error = 'SMTP auth failed',
            error_category = 'auth',
            error_permanent = 1,
            retry_count = 1
          WHERE id = ?`,
        )
        .run(job.id);

      const retried = retryJob(application.id, "application", job.id);

      expect(retried.status).toBe("queued");
      // A manual retry restarts the backoff, so the accumulated retry_count is reset to 0.
      expect(retried.retryCount).toBe(0);
      expect(retried.lastError).toBeUndefined();
    });

    it("rejects pausing jobs that are already processing", () => {
      const { application, authToken } = createFixture();
      const job = enqueueMail(authToken, createSendMailInput(), "queued");

      getDatabase()
        .prepare(
          `UPDATE mail_jobs
          SET
            status = 'processing',
            processing_started_at = ?
          WHERE id = ?`,
        )
        .run("2026-03-30T10:00:00.000Z", job.id);

      expect(() => pauseJob(application.id, "application", job.id)).toThrowError(
        "Only pending jobs can be paused",
      );
      expect(
        getDatabase().prepare("SELECT status FROM mail_jobs WHERE id = ?").get(job.id),
      ).toMatchObject({
        status: "processing",
      });
    });

    it("rejects deleting jobs that are already processing", () => {
      const { application, authToken } = createFixture();
      const job = enqueueMail(authToken, createSendMailInput(), "queued");

      getDatabase()
        .prepare(
          `UPDATE mail_jobs
          SET
            status = 'processing',
            processing_started_at = ?
          WHERE id = ?`,
        )
        .run("2026-03-30T10:00:00.000Z", job.id);

      expect(() => deleteJob(application.id, "application", job.id)).toThrowError(
        "Processing jobs cannot be deleted",
      );
      expect(
        getDatabase().prepare("SELECT status, deleted_at FROM mail_jobs WHERE id = ?").get(job.id),
      ).toMatchObject({
        deleted_at: null,
        status: "processing",
      });
    });

    it("hides deleted jobs from detail and list reads", () => {
      const { application, authToken } = createFixture();
      const job = enqueueMail(
        authToken,
        createSendMailInput({ idempotencyKey: "deleted-job", messageId: "msg-deleted" }),
        "queued",
      );

      deleteJob(application.id, "application", job.id);

      expect(
        getDatabase().prepare("SELECT deleted_at, status FROM mail_jobs WHERE id = ?").get(job.id),
      ).toMatchObject({
        deleted_at: expect.any(String),
        status: "cancelled",
      });
      expect(() => getJob(job.id)).toThrowError("Job not found");
      expect(() => getJobStatusView(job.id)).toThrowError("Job not found");
      expect(listJobs({ applicationId: authToken.applicationId })).toStrictEqual([]);
      expect(listJobStatusViews({ applicationId: authToken.applicationId })).toStrictEqual([]);
    });

    it("allows re-enqueue with the same idempotency key after the previous job was deleted", () => {
      const { application, authToken } = createFixture();
      const firstJob = enqueueMail(
        authToken,
        createSendMailInput({ idempotencyKey: "requeue-after-delete", messageId: "msg-first" }),
        "queued",
      );

      deleteJob(application.id, "application", firstJob.id);

      const secondJob = enqueueMail(
        authToken,
        createSendMailInput({ idempotencyKey: "requeue-after-delete", messageId: "msg-second" }),
        "queued",
      );

      expect(secondJob.id).not.toBe(firstJob.id);
      expect(secondJob.idempotencyKey).toBe("requeue-after-delete");
      expect(secondJob.messageId).toBe("msg-second");
      expect(() => getJob(firstJob.id)).toThrowError("Job not found");
      expect(listJobs({ applicationId: authToken.applicationId })).toHaveLength(1);
      expect(listJobs({ applicationId: authToken.applicationId })[0]?.id).toBe(secondJob.id);
    });
  });

  describe("readStatus redaction", () => {
    it("returns only redacted status views without bodies, headers or attachment content", () => {
      const { authToken } = createFixture();
      const job = enqueueMail(
        authToken,
        createSendMailInput({
          attachments: [createAttachment()],
          headers: { "x-trace-id": "trace-123" },
          html: "<p>Secret HTML</p>",
          text: "Secret text",
        }),
        "queued",
      );

      expect(getJobStatusView(job.id)).toMatchObject({
        applicationId: authToken.applicationId,
        attachments: [
          {
            contentDisposition: "attachment",
            contentType: "text/plain",
            filename: "attachment.txt",
          },
        ],
        configId: authToken.configId,
        createdAt: expect.any(String),
        deliveryMode: "queued",
        from: "sender@example.com",
        id: job.id,
        messageId: "msg-1",
        retryCount: 0,
        status: "queued",
        subject: "Hello",
        to: "recipient@example.com",
        tokenId: authToken.tokenId,
        tokenKind: "application",
        updatedAt: expect.any(String),
      });

      const [statusJob] = listJobStatusViews({ applicationId: authToken.applicationId });

      expect(statusJob).toBeDefined();
      expect(statusJob).not.toHaveProperty("html");
      expect(statusJob).not.toHaveProperty("text");
      expect(statusJob).not.toHaveProperty("headers");
      expect(statusJob.attachments[0]).not.toHaveProperty("contentBase64");
    });
  });

  describe("retention enforcement", () => {
    it("redacts attachments and error details only after their configured retention window", () => {
      const { authToken } = createFixture();
      const expiredSentJob = enqueueMail(
        authToken,
        createSendMailInput({
          attachments: [createAttachment()],
          idempotencyKey: "expired-sent-job",
        }),
        "queued",
      );
      const expiredFailedJob = enqueueMail(
        authToken,
        createSendMailInput({
          attachments: [createAttachment()],
          idempotencyKey: "expired-failed-job",
        }),
        "queued",
      );
      const freshFailedJob = enqueueMail(
        authToken,
        createSendMailInput({
          attachments: [createAttachment()],
          idempotencyKey: "fresh-failed-job",
        }),
        "queued",
      );

      getDatabase()
        .prepare(
          `UPDATE mail_jobs
          SET
            status = 'sent',
            sent_at = ?,
            updated_at = ?,
            retain_sent_jobs_days = 40,
            retain_attachments_days = 1
          WHERE id = ?`,
        )
        .run("2026-03-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", expiredSentJob.id);
      getDatabase()
        .prepare(
          `UPDATE mail_jobs
          SET
            status = 'failed',
            updated_at = ?,
            last_error = 'SMTP auth failed',
            error_category = 'auth',
            error_permanent = 1,
            retain_failed_jobs_days = 40,
            retain_attachments_days = 1,
            retain_error_details_days = 1
          WHERE id = ?`,
        )
        .run("2026-03-01T00:00:00.000Z", expiredFailedJob.id);
      getDatabase()
        .prepare(
          `UPDATE mail_jobs
          SET
            status = 'failed',
            updated_at = ?,
            last_error = 'temporary error',
            error_category = 'network',
            error_permanent = 0,
            retain_failed_jobs_days = 10,
            retain_attachments_days = 10,
            retain_error_details_days = 10
          WHERE id = ?`,
        )
        .run("2026-03-29T00:00:00.000Z", freshFailedJob.id);

      expect(applyJobRetention("2026-03-30T00:00:00.000Z")).toStrictEqual({
        purgedJobs: 0,
        redactedAttachments: 2,
        redactedErrorDetails: 1,
      });

      expect(
        getDatabase()
          .prepare("SELECT attachments_json FROM mail_jobs WHERE id = ?")
          .get(expiredSentJob.id),
      ).toMatchObject({
        attachments_json: "[]",
      });
      expect(
        getDatabase()
          .prepare("SELECT attachments_json, last_error FROM mail_jobs WHERE id = ?")
          .get(expiredFailedJob.id),
      ).toMatchObject({
        attachments_json: "[]",
        last_error: null,
      });
      const freshFailedRecord = getDatabase()
        .prepare("SELECT attachments_json, last_error FROM mail_jobs WHERE id = ?")
        .get(freshFailedJob.id);

      expect(freshFailedRecord).toMatchObject({
        last_error: "temporary error",
      });
      expect(String(freshFailedRecord.attachments_json)).not.toBe("[]");
    });

    it("purges terminal jobs only after their configured retention window", () => {
      const { authToken } = createFixture();
      const expiredSentJob = enqueueMail(
        authToken,
        createSendMailInput({
          attachments: [createAttachment()],
          idempotencyKey: "expired-sent-purge",
        }),
        "queued",
      );
      const expiredFailedJob = enqueueMail(
        authToken,
        createSendMailInput({
          attachments: [createAttachment()],
          idempotencyKey: "expired-failed-purge",
        }),
        "queued",
      );
      const freshSentJob = enqueueMail(
        authToken,
        createSendMailInput({
          attachments: [createAttachment()],
          idempotencyKey: "fresh-sent-purge",
        }),
        "queued",
      );

      getDatabase()
        .prepare(
          `UPDATE mail_jobs
          SET
            status = 'sent',
            sent_at = ?,
            updated_at = ?,
            retain_sent_jobs_days = 10
          WHERE id = ?`,
        )
        .run("2026-03-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", expiredSentJob.id);
      getDatabase()
        .prepare(
          `UPDATE mail_jobs
          SET
            status = 'failed',
            updated_at = ?,
            last_error = 'SMTP auth failed',
            error_category = 'auth',
            error_permanent = 1,
            retain_failed_jobs_days = 10
          WHERE id = ?`,
        )
        .run("2026-03-01T00:00:00.000Z", expiredFailedJob.id);
      getDatabase()
        .prepare(
          `UPDATE mail_jobs
          SET
            status = 'sent',
            sent_at = ?,
            updated_at = ?,
            retain_sent_jobs_days = 10
          WHERE id = ?`,
        )
        .run("2026-03-25T00:00:00.000Z", "2026-03-25T00:00:00.000Z", freshSentJob.id);

      expect(applyJobRetention("2026-03-30T00:00:00.000Z")).toStrictEqual({
        purgedJobs: 2,
        redactedAttachments: 0,
        redactedErrorDetails: 0,
      });

      expect(
        getDatabase().prepare("SELECT id FROM mail_jobs WHERE id = ?").get(expiredSentJob.id),
      ).toBeUndefined();
      expect(
        getDatabase().prepare("SELECT id FROM mail_jobs WHERE id = ?").get(expiredFailedJob.id),
      ).toBeUndefined();
      expect(
        getDatabase().prepare("SELECT id, status FROM mail_jobs WHERE id = ?").get(freshSentJob.id),
      ).toMatchObject({
        id: freshSentJob.id,
        status: "sent",
      });
    });
  });

  describe("api request failures", () => {
    it("records failures with all relevant fields and optional fields null", () => {
      recordApiFailure(
        {
          httpStatus: 401,
          reasonCategory: "auth_missing",
          reasonMessage: "Missing authorization",
          requestMethod: "GET",
          requestPath: "/api/v1/config",
        },
        "2026-06-04T10:00:00.000Z",
      );

      const failures = listApiFailures();
      expect(failures).toHaveLength(1);
      const failure = failures[0];
      expect(failure).toMatchObject({
        applicationId: undefined,
        clientId: undefined,
        createdAt: "2026-06-04T10:00:00.000Z",
        details: undefined,
        httpStatus: 401,
        reasonCategory: "auth_missing",
        reasonMessage: "Missing authorization",
        requestMethod: "GET",
        requestPath: "/api/v1/config",
        tokenId: undefined,
        tokenKind: undefined,
      });
      expect(failure.id).toMatch(/^apifail_/);
    });

    it("stores details_json as valid JSON when provided", () => {
      recordApiFailure(
        {
          applicationId: "app_1",
          clientId: "appcli_1",
          details: { expectedScope: "readConfig", issueCount: 3, issuePaths: ["text", "html"] },
          httpStatus: 400,
          reasonCategory: "validation",
          reasonMessage: "Bad input",
          requestMethod: "POST",
          requestPath: "/api/v1/send",
          tokenId: "tok_1",
          tokenKind: "application",
        },
        "2026-06-04T10:00:00.000Z",
      );

      const [failure] = listApiFailures();
      expect(failure.details).toStrictEqual({
        expectedScope: "readConfig",
        issueCount: 3,
        issuePaths: ["text", "html"],
      });
      expect(failure).toMatchObject({
        applicationId: "app_1",
        clientId: "appcli_1",
        tokenId: "tok_1",
        tokenKind: "application",
      });
    });

    it("filters by time range, status, reason category and application", () => {
      recordApiFailure(
        {
          applicationId: "app_1",
          httpStatus: 401,
          reasonCategory: "auth_missing",
          reasonMessage: "no token",
          requestMethod: "GET",
          requestPath: "/api/v1/jobs",
        },
        "2026-06-01T10:00:00.000Z",
      );
      recordApiFailure(
        {
          applicationId: "app_2",
          httpStatus: 400,
          reasonCategory: "validation",
          reasonMessage: "bad payload",
          requestMethod: "POST",
          requestPath: "/api/v1/send",
        },
        "2026-06-02T10:00:00.000Z",
      );
      recordApiFailure(
        {
          applicationId: "app_1",
          httpStatus: 401,
          reasonCategory: "scope_missing",
          reasonMessage: "scope",
          requestMethod: "GET",
          requestPath: "/api/v1/config",
        },
        "2026-06-03T10:00:00.000Z",
      );

      expect(listApiFailures()).toHaveLength(3);

      const filteredByStatus = listApiFailures({ httpStatus: 401 });
      expect(filteredByStatus).toHaveLength(2);
      expect(filteredByStatus.every((failure) => failure.httpStatus === 401)).toBe(true);

      const filteredByReason = listApiFailures({ reasonCategory: "validation" });
      expect(filteredByReason).toHaveLength(1);
      expect(filteredByReason[0].reasonCategory).toBe("validation");

      const filteredByApplication = listApiFailures({ applicationId: "app_1" });
      expect(filteredByApplication).toHaveLength(2);
      expect(filteredByApplication.every((failure) => failure.applicationId === "app_1")).toBe(
        true,
      );

      const filteredByRange = listApiFailures({
        fromTimestamp: "2026-06-02T00:00:00.000Z",
        toTimestamp: "2026-06-02T23:59:59.000Z",
      });
      expect(filteredByRange).toHaveLength(1);
      expect(filteredByRange[0].applicationId).toBe("app_2");
    });

    it("sorts results descending by created_at", () => {
      recordApiFailure(
        {
          httpStatus: 401,
          reasonCategory: "auth_missing",
          reasonMessage: "first",
          requestMethod: "GET",
          requestPath: "/api/v1/config",
        },
        "2026-06-01T10:00:00.000Z",
      );
      recordApiFailure(
        {
          httpStatus: 401,
          reasonCategory: "auth_missing",
          reasonMessage: "second",
          requestMethod: "GET",
          requestPath: "/api/v1/config",
        },
        "2026-06-03T10:00:00.000Z",
      );
      recordApiFailure(
        {
          httpStatus: 401,
          reasonCategory: "auth_missing",
          reasonMessage: "third",
          requestMethod: "GET",
          requestPath: "/api/v1/config",
        },
        "2026-06-02T10:00:00.000Z",
      );

      const failures = listApiFailures();

      expect(failures.map((failure) => failure.reasonMessage)).toStrictEqual([
        "second",
        "third",
        "first",
      ]);
    });

    it("purges failures older than the configured retention window", () => {
      recordApiFailure(
        {
          httpStatus: 401,
          reasonCategory: "auth_missing",
          reasonMessage: "old",
          requestMethod: "GET",
          requestPath: "/api/v1/config",
        },
        "2026-05-01T00:00:00.000Z",
      );
      recordApiFailure(
        {
          httpStatus: 401,
          reasonCategory: "auth_missing",
          reasonMessage: "recent",
          requestMethod: "GET",
          requestPath: "/api/v1/config",
        },
        "2026-06-03T00:00:00.000Z",
      );

      expect(applyApiFailureRetention(30, "2026-06-04T00:00:00.000Z")).toStrictEqual({
        purgedFailures: 1,
      });

      const remaining = listApiFailures();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].reasonMessage).toBe("recent");
    });
  });
});
