import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDatabase, resetDatabase } from "./db.ts";
import {
  authenticateAccessToken,
  canTokenAccessConfig,
  canTokenAccessJob,
  createApplication,
  createApplicationAdmin,
  createApplicationToken,
  getApplicationAdminById,
  getApplicationById,
  getJobDeliveryStatus,
  getJobDeliveryStatusForToken,
  getJob,
  getSmtpConfig,
  assertSafeResolvedAddress,
  enqueueMail,
  issueClientAccessToken,
  listJobDeliveryStatuses,
  listJobDeliveryStatusesForToken,
  listJobStatusViews,
  listSmtpConfigs,
  processJob,
  renameApplication,
  renameApplicationAdmin,
  resetSmtpTestDependencies,
  resumeJob,
  retryJob,
  sendSystemAdminTestMail,
  setSmtpTestDependencies,
  upsertSmtpConfig,
  validateSmtpConfig,
} from "./service.ts";

function createSendContext() {
  const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
    label: "Admin One",
  });
  const application = createApplication("system-admin-1", "systemAdmin", {
    applicationAdminId: admin.id,
    label: "App One",
  });
  const config = upsertSmtpConfig(admin.id, "applicationAdmin", {
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
    username: "mailer@example.com",
  });
  const token = createApplicationToken("system-admin-1", "systemAdmin", {
    applicationId: application.id,
    label: "App Token",
    retainAttachmentsDays: 30,
    retainErrorDetailsDays: 30,
    retainFailedJobsDays: 30,
    retainSentJobsDays: 30,
    scopes: ["send"],
  });
  const authToken = authenticateAccessToken(
    issueClientAccessToken({
      clientId: token.clientId,
      clientSecret: token.clientSecret,
    }).accessToken,
    "send",
  );

  return { admin, application, authToken, config };
}

function enqueueTestMail(authToken, messageId) {
  return enqueueMail(
    authToken,
    {
      attachments: [],
      from: "sender@example.com",
      headers: {},
      html: "<p>Hello</p>",
      messageId,
      subject: "Subject",
      text: "Hello",
      to: "recipient@example.com",
    },
    "queued",
  );
}

describe("delivery status polling view", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-delivery-status-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    resetDatabase();
  });

  afterEach(() => {
    resetSmtpTestDependencies();
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("maps queued, delivered and unknown jobs to client-facing delivery status results", async () => {
    const { authToken } = createSendContext();
    const queuedJob = enqueueTestMail(authToken, "msg-delivery-queued");
    const sentJob = enqueueTestMail(authToken, "msg-delivery-sent");
    const sendMail = vi.fn().mockResolvedValue({ messageId: "provider-message-1" });
    const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify: vi.fn() }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.42", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    await processJob(sentJob.id);

    expect(getJobDeliveryStatus(queuedJob.id)).toMatchObject({
      deliveryStatus: "queued",
      jobId: queuedJob.id,
      jobStatus: "queued",
      terminal: false,
      updatedAt: queuedJob.updatedAt,
    });
    expect(getJobDeliveryStatus(sentJob.id)).toMatchObject({
      deliveryStatus: "delivered",
      jobId: sentJob.id,
      jobStatus: "sent",
      providerMessageId: "provider-message-1",
      terminal: true,
    });
    expect(getJobDeliveryStatus("job_missing")).toStrictEqual({
      deliveryStatus: "unknown",
      failureCategory: "expired_or_unknown",
      failureReason: "The job is unknown, expired, deleted or already purged by retention.",
      jobId: "job_missing",
      terminal: true,
    });
  });

  it("classifies terminal SMTP failures with redacted diagnostic metadata", async () => {
    const { authToken } = createSendContext();
    const sendMail = vi.fn().mockRejectedValue(
      Object.assign(new Error("Mailbox unavailable"), {
        code: "EENVELOPE",
        responseCode: 550,
      }),
    );
    const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify: vi.fn() }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.43", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const job = enqueueTestMail(authToken, "msg-delivery-failed");
    await processJob(job.id);

    expect(getJobDeliveryStatus(job.id)).toMatchObject({
      deliveryStatus: "bounced",
      errorCode: "EENVELOPE",
      failureCategory: "unknown_recipient",
      jobId: job.id,
      jobStatus: "failed",
      providerResponseCode: 550,
      terminal: true,
    });
  });

  it("keeps batch results in request order, including duplicates and unknown IDs", () => {
    const { authToken } = createSendContext();
    const job = enqueueTestMail(authToken, "msg-delivery-batch");

    expect(listJobDeliveryStatuses([job.id, "job_missing", job.id])).toMatchObject([
      { deliveryStatus: "queued", jobId: job.id },
      { deliveryStatus: "unknown", jobId: "job_missing" },
      { deliveryStatus: "queued", jobId: job.id },
    ]);
  });

  it("rejects token reads for existing jobs outside the token ownership boundary", () => {
    const { authToken } = createSendContext();
    const foreign = createSendContext();
    const job = enqueueTestMail(foreign.authToken, "msg-delivery-foreign");

    expect(() => getJobDeliveryStatusForToken(authToken, job.id)).toThrow(
      "Token cannot read a job outside its ownership",
    );
    expect(() => listJobDeliveryStatusesForToken(authToken, [job.id])).toThrow(
      "Token cannot read a job outside its ownership",
    );
  });
});

describe("classifyMailerError via processJob for SMTP response codes", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-backend-smtp-classify-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    resetDatabase();
  });

  afterEach(() => {
    resetSmtpTestDependencies();
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    rmSync(tempDir, { force: true, recursive: true });
  });

  for (const responseCode of [550, 553, 501]) {
    it(`fails permanently without retrying on a ${responseCode} envelope rejection`, async () => {
      const { authToken } = createSendContext();

      const sendMail = vi.fn().mockRejectedValue(
        Object.assign(new Error("Mailbox unavailable"), {
          code: "EENVELOPE",
          responseCode,
        }),
      );
      const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify: vi.fn() }));
      const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.40", family: 4 }]);
      setSmtpTestDependencies({
        createMailerTransport: createTransport,
        lookupSmtpHost: lookupHost,
      });

      const job = enqueueTestMail(authToken, `msg-${responseCode}`);
      const processed = await processJob(job.id);

      expect(processed.status).toBe("failed");
      expect(processed.errorPermanent).toBe(true);
      expect(processed.errorCategory).toBe("content");
      expect(processed.errorCode).toBe("EENVELOPE");
      expect(processed.providerResponseCode).toBe(responseCode);
      expect(processed.retryCount).toBe(1);
      expect(processed.nextRetryAt).toBeUndefined();
      expect(sendMail).toHaveBeenCalledTimes(1);
    });
  }

  it("fails permanently on a 550 message rejection reported as EMESSAGE", async () => {
    const { authToken } = createSendContext();

    const sendMail = vi.fn().mockRejectedValue(
      Object.assign(new Error("Message content rejected"), {
        code: "EMESSAGE",
        responseCode: 550,
      }),
    );
    const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify: vi.fn() }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.41", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const job = enqueueTestMail(authToken, "msg-emessage-550");
    const processed = await processJob(job.id);

    expect(processed.status).toBe("failed");
    expect(processed.errorPermanent).toBe(true);
    expect(processed.errorCategory).toBe("content");
    expect(processed.errorCode).toBe("EMESSAGE");
    expect(processed.providerResponseCode).toBe(550);
  });

  it("schedules a retry on a transient 421 response", async () => {
    const { authToken } = createSendContext();

    const sendMail = vi.fn().mockRejectedValue(
      Object.assign(new Error("Service not available"), {
        code: "EENVELOPE",
        responseCode: 421,
      }),
    );
    const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify: vi.fn() }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.42", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const job = enqueueTestMail(authToken, "msg-421");
    const processed = await processJob(job.id);

    expect(processed.status).toBe("retry_scheduled");
    expect(processed.errorPermanent).toBe(false);
    expect(processed.errorCategory).toBe("network");
    expect(processed.providerResponseCode).toBe(421);
    expect(processed.nextRetryAt).toBeDefined();
  });

  for (const responseCode of [450, 451]) {
    it(`schedules a rate-limit retry on a transient ${responseCode} response`, async () => {
      const { authToken } = createSendContext();

      const sendMail = vi.fn().mockRejectedValue(
        Object.assign(new Error("Mailbox busy"), {
          code: "EENVELOPE",
          responseCode,
        }),
      );
      const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify: vi.fn() }));
      const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.43", family: 4 }]);
      setSmtpTestDependencies({
        createMailerTransport: createTransport,
        lookupSmtpHost: lookupHost,
      });

      const job = enqueueTestMail(authToken, `msg-${responseCode}`);
      const processed = await processJob(job.id);

      expect(processed.status).toBe("retry_scheduled");
      expect(processed.errorPermanent).toBe(false);
      expect(processed.errorCategory).toBe("rate_limit");
      expect(processed.providerResponseCode).toBe(responseCode);
      expect(processed.nextRetryAt).toBeDefined();
    });
  }

  it("keeps EAUTH failures classified as a permanent auth error", async () => {
    const { authToken } = createSendContext();

    const sendMail = vi.fn().mockRejectedValue(
      Object.assign(new Error("Invalid login"), {
        code: "EAUTH",
        responseCode: 535,
      }),
    );
    const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify: vi.fn() }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.44", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const job = enqueueTestMail(authToken, "msg-eauth");
    const processed = await processJob(job.id);

    expect(processed.status).toBe("failed");
    expect(processed.errorPermanent).toBe(true);
    expect(processed.errorCategory).toBe("auth");
    expect(processed.errorCode).toBe("EAUTH");
  });

  it("keeps ETIMEDOUT failures classified as a transient network error", async () => {
    const { authToken } = createSendContext();

    const sendMail = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("Connection timeout"), { code: "ETIMEDOUT" }));
    const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify: vi.fn() }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.45", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const job = enqueueTestMail(authToken, "msg-etimedout");
    const processed = await processJob(job.id);

    expect(processed.status).toBe("retry_scheduled");
    expect(processed.errorPermanent).toBe(false);
    expect(processed.errorCategory).toBe("network");
    expect(processed.errorCode).toBe("ETIMEDOUT");
  });
});

describe("upsertSmtpConfig", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-backend-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    resetDatabase();
  });

  afterEach(() => {
    resetSmtpTestDependencies();
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("rejects reassigning a config to an application owned by a different application admin", () => {
    const firstAdmin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const secondAdmin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin Two",
    });
    const firstApplication = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: firstAdmin.id,
      label: "App One",
    });
    const secondApplication = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: secondAdmin.id,
      label: "App Two",
    });
    const config = upsertSmtpConfig(firstAdmin.id, "applicationAdmin", {
      applicationId: firstApplication.id,
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

    expect(() =>
      upsertSmtpConfig(
        firstAdmin.id,
        "applicationAdmin",
        {
          applicationId: secondApplication.id,
          connectionTimeoutMs: 10_000,
          defaultFromAddress: "sender@example.com",
          greetingTimeoutMs: 10_000,
          host: "smtp.changed.example.com",
          minTlsVersion: "TLSv1.2",
          name: "Moved SMTP",
          port: 587,
          requireTls: true,
          secure: false,
          socketTimeoutMs: 20_000,
          username: "mailer-updated",
        },
        config.id,
      ),
    ).toThrowError("Application admin cannot manage a foreign application");

    expect(getSmtpConfig(config.id).applicationId).toBe(firstApplication.id);
  });

  it("rejects reassigning a config to another application inside the same application admin boundary", () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const firstApplication = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    const secondApplication = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App Two",
    });
    const config = upsertSmtpConfig(admin.id, "applicationAdmin", {
      applicationId: firstApplication.id,
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

    expect(() =>
      upsertSmtpConfig(
        admin.id,
        "applicationAdmin",
        {
          applicationId: secondApplication.id,
          connectionTimeoutMs: 15_000,
          defaultFromAddress: "sender@example.com",
          greetingTimeoutMs: 11_000,
          host: "smtp.changed.example.com",
          minTlsVersion: "TLSv1.3",
          name: "Primary SMTP Updated",
          port: 465,
          requireTls: true,
          secure: true,
          socketTimeoutMs: 25_000,
          username: "mailer-updated",
        },
        config.id,
      ),
    ).toThrowError("SMTP config application cannot be changed");

    expect(getSmtpConfig(config.id).applicationId).toBe(firstApplication.id);
  });

  it("allows updating a config while keeping the same application", () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    const config = upsertSmtpConfig(admin.id, "applicationAdmin", {
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

    const updated = upsertSmtpConfig(
      admin.id,
      "applicationAdmin",
      {
        applicationId: application.id,
        connectionTimeoutMs: 15_000,
        defaultFromAddress: "sender@example.com",
        greetingTimeoutMs: 11_000,
        host: "smtp.changed.example.com",
        minTlsVersion: "TLSv1.3",
        name: "Primary SMTP Updated",
        port: 465,
        requireTls: true,
        secure: true,
        socketTimeoutMs: 25_000,
        username: "mailer-updated",
      },
      config.id,
    );

    expect(updated.applicationId).toBe(application.id);
    expect(updated.applicationAdminId).toBe(admin.id);
    expect(updated.defaultFromAddress).toBe("sender@example.com");
    expect(updated.host).toBe("smtp.changed.example.com");
    expect(updated.sendRateLimitPerMinute).toBe(60);
  });

  it("persists the per-application send rate limit on create and update", () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    const config = upsertSmtpConfig(admin.id, "applicationAdmin", {
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
      sendRateLimitPerMinute: 25,
      socketTimeoutMs: 20_000,
      username: "mailer",
    });

    expect(config.sendRateLimitPerMinute).toBe(25);

    const updated = upsertSmtpConfig(
      admin.id,
      "applicationAdmin",
      {
        applicationId: application.id,
        connectionTimeoutMs: 10_000,
        defaultFromAddress: "sender@example.com",
        greetingTimeoutMs: 10_000,
        host: "smtp.example.com",
        minTlsVersion: "TLSv1.2",
        name: "Primary SMTP",
        port: 587,
        requireTls: true,
        secure: false,
        sendRateLimitPerMinute: 0,
        socketTimeoutMs: 20_000,
        username: "mailer",
      },
      config.id,
    );

    expect(updated.sendRateLimitPerMinute).toBe(0);
  });

  it("rejects invalid default from addresses", () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });

    expect(() =>
      upsertSmtpConfig(admin.id, "applicationAdmin", {
        applicationId: application.id,
        connectionTimeoutMs: 10_000,
        defaultFromAddress: "not-an-email",
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
      }),
    ).toThrowError("Must be a valid email address");
  });

  it("writes the actual system admin actor into audit logs for admin and application creation", () => {
    const admin = createApplicationAdmin("oidc-user-123", "systemAdmin", {
      label: "Audited Admin",
    });
    const application = createApplication("oidc-user-123", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "Audited App",
    });

    const auditRows = getDatabase()
      .prepare(
        `SELECT actor_type, actor_id, action, entity_type, entity_id
         FROM audit_logs
         WHERE action IN ('application_admin.created', 'application.created')
         ORDER BY created_at ASC`,
      )
      .all()
      .map((row) => ({ ...row }));

    expect(auditRows).toStrictEqual([
      {
        action: "application_admin.created",
        actor_id: "oidc-user-123",
        actor_type: "systemAdmin",
        entity_id: admin.id,
        entity_type: "application_admin",
      },
      {
        action: "application.created",
        actor_id: "oidc-user-123",
        actor_type: "systemAdmin",
        entity_id: application.id,
        entity_type: "application",
      },
    ]);
  });
});

describe("assertSafeResolvedAddress", () => {
  it("rejects non-global IPv4 targets", () => {
    for (const address of [
      "0.0.0.0",
      "10.0.0.1",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.1.10",
      "172.16.0.1",
      "192.0.2.10",
      "192.168.1.20",
      "198.18.0.1",
      "198.51.100.10",
      "203.0.113.10",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      expect(() => assertSafeResolvedAddress(address, 4)).toThrowError(
        `Non-global SMTP target is not allowed: ${address}`,
      );
    }
  });

  it("rejects non-global IPv6 targets", () => {
    for (const address of [
      "::",
      "::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
      "fc00::1",
      "fd12:3456:789a::1",
      "fe80::1",
      "ff02::1",
    ]) {
      expect(() => assertSafeResolvedAddress(address, 6)).toThrowError(
        `Non-global SMTP target is not allowed: ${address}`,
      );
    }
  });

  it("allows globally routable IPv4 and IPv6 targets", () => {
    expect(() => assertSafeResolvedAddress("8.8.8.8", 4)).not.toThrow();
    expect(() => assertSafeResolvedAddress("1.1.1.1", 4)).not.toThrow();
    expect(() => assertSafeResolvedAddress("2606:4700:4700::1111", 6)).not.toThrow();
    expect(() => assertSafeResolvedAddress("2001:4860:4860::8888", 6)).not.toThrow();
  });
});

describe("SMTP DNS rebinding protection", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-backend-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    resetDatabase();
  });

  afterEach(() => {
    resetSmtpTestDependencies();
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("binds SMTP validation to the already validated resolved address", async () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    const config = upsertSmtpConfig(admin.id, "applicationAdmin", {
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

    const verify = vi.fn().mockResolvedValue(undefined);
    const sendMail = vi.fn();
    const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.10", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    await expect(validateSmtpConfig(config.id)).resolves.toStrictEqual({ ok: true });
    expect(lookupHost).toHaveBeenCalledWith("smtp.example.com", { all: true });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "203.0.114.10",
        port: 587,
        tls: expect.objectContaining({
          minVersion: "TLSv1.2",
          servername: "smtp.example.com",
        }),
      }),
    );
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("retries SMTP validation with the next resolved address after a network timeout", async () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    const config = upsertSmtpConfig(admin.id, "applicationAdmin", {
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

    const firstVerify = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("Connection timeout"), { code: "ETIMEDOUT" }));
    const secondVerify = vi.fn().mockResolvedValue(undefined);
    const createTransport = vi.fn((options) => {
      if (options.host === "2001:4860:4860::8888") {
        return { close: vi.fn(), sendMail: vi.fn(), verify: firstVerify };
      }

      return { close: vi.fn(), sendMail: vi.fn(), verify: secondVerify };
    });
    const lookupHost = vi.fn().mockResolvedValue([
      { address: "2001:4860:4860::8888", family: 6 },
      { address: "203.0.114.12", family: 4 },
    ]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    await expect(validateSmtpConfig(config.id)).resolves.toStrictEqual({ ok: true });
    expect(lookupHost).toHaveBeenCalledWith("smtp.example.com", { all: true });
    expect(createTransport).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        host: "2001:4860:4860::8888",
        tls: expect.objectContaining({ servername: "smtp.example.com" }),
      }),
    );
    expect(createTransport).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        host: "203.0.114.12",
        tls: expect.objectContaining({ servername: "smtp.example.com" }),
      }),
    );
    expect(firstVerify).toHaveBeenCalledTimes(1);
    expect(secondVerify).toHaveBeenCalledTimes(1);
  });

  it("returns structured SMTP validation diagnostics for failed attempts", async () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    const config = upsertSmtpConfig(admin.id, "applicationAdmin", {
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

    const createTransport = vi.fn((options) => ({
      close: vi.fn(),
      sendMail: vi.fn(),
      verify: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error(`Timeout ${options.host}`), { code: "ETIMEDOUT" }),
        ),
    }));
    const lookupHost = vi.fn().mockResolvedValue([
      { address: "2001:4860:4860::8888", family: 6 },
      { address: "203.0.114.12", family: 4 },
    ]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    await expect(validateSmtpConfig(config.id)).resolves.toMatchObject({
      category: "network",
      code: "ETIMEDOUT",
      debug: {
        attempts: [
          {
            address: "2001:4860:4860::8888",
            code: "ETIMEDOUT",
            family: 6,
            message: "Timeout 2001:4860:4860::8888",
            outcome: "failed",
            phase: "verify",
          },
          {
            address: "203.0.114.12",
            code: "ETIMEDOUT",
            family: 4,
            message: "Timeout 203.0.114.12",
            outcome: "failed",
            phase: "verify",
          },
        ],
        host: "smtp.example.com",
        minTlsVersion: "TLSv1.2",
        port: 587,
        requireTls: true,
        resolvedTargets: ["2001:4860:4860::8888", "203.0.114.12"],
        secure: false,
      },
      message: "Timeout 203.0.114.12",
      ok: false,
    });
  });

  it("binds queued mail delivery to the already validated resolved address", async () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    upsertSmtpConfig(admin.id, "applicationAdmin", {
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
    const token = createApplicationToken("system-admin-1", "systemAdmin", {
      applicationId: application.id,
      label: "App Token",
      retainAttachmentsDays: 30,
      retainErrorDetailsDays: 30,
      retainFailedJobsDays: 30,
      retainSentJobsDays: 30,
      scopes: ["send"],
    });
    const authToken = authenticateAccessToken(
      issueClientAccessToken({
        clientId: token.clientId,
        clientSecret: token.clientSecret,
      }).accessToken,
      "send",
    );

    const verify = vi.fn();
    const sendMail = vi.fn().mockResolvedValue({ messageId: "provider-1" });
    const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.20", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const job = enqueueMail(
      authToken,
      {
        attachments: [],
        from: "sender@example.com",
        headers: {},
        html: "<p>Hello</p>",
        messageId: "msg-1",
        subject: "Subject",
        text: "Hello",
        to: "recipient@example.com",
      },
      "queued",
    );

    const processed = await processJob(job.id);
    expect(processed.status).toBe("sent");
    expect(lookupHost).toHaveBeenCalledWith("smtp.example.com", { all: true });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "203.0.114.20",
        port: 587,
        tls: expect.objectContaining({
          minVersion: "TLSv1.2",
          servername: "smtp.example.com",
        }),
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "sender@example.com",
        messageId: "msg-1",
        subject: "Subject",
        to: "recipient@example.com",
      }),
    );
  });

  it("uses the SMTP config default from address when the API payload omits from", () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    upsertSmtpConfig(admin.id, "applicationAdmin", {
      applicationId: application.id,
      connectionTimeoutMs: 10_000,
      defaultFromAddress: "default@example.com",
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
    const token = createApplicationToken("system-admin-1", "systemAdmin", {
      applicationId: application.id,
      label: "App Token",
      retainAttachmentsDays: 30,
      retainErrorDetailsDays: 30,
      retainFailedJobsDays: 30,
      retainSentJobsDays: 30,
      scopes: ["send"],
    });
    const authToken = authenticateAccessToken(
      issueClientAccessToken({
        clientId: token.clientId,
        clientSecret: token.clientSecret,
      }).accessToken,
      "send",
    );

    const job = enqueueMail(
      authToken,
      {
        attachments: [],
        headers: {},
        html: "<p>Hello</p>",
        messageId: "msg-fallback",
        subject: "Subject",
        text: "Hello",
        to: "recipient@example.com",
      },
      "queued",
    );

    expect(job.from).toBe("default@example.com");
  });

  it("rejects invalid explicit from addresses in the API payload", () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    upsertSmtpConfig(admin.id, "applicationAdmin", {
      applicationId: application.id,
      connectionTimeoutMs: 10_000,
      defaultFromAddress: "default@example.com",
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
    const token = createApplicationToken("system-admin-1", "systemAdmin", {
      applicationId: application.id,
      label: "App Token",
      retainAttachmentsDays: 30,
      retainErrorDetailsDays: 30,
      retainFailedJobsDays: 30,
      retainSentJobsDays: 30,
      scopes: ["send"],
    });
    const authToken = authenticateAccessToken(
      issueClientAccessToken({
        clientId: token.clientId,
        clientSecret: token.clientSecret,
      }).accessToken,
      "send",
    );

    expect(() =>
      enqueueMail(
        authToken,
        {
          attachments: [],
          from: "invalid-address",
          headers: {},
          html: "<p>Hello</p>",
          messageId: "msg-invalid-from",
          subject: "Subject",
          text: "Hello",
          to: "recipient@example.com",
        },
        "queued",
      ),
    ).toThrowError("Must be a valid email address");
  });

  it("retries queued mail delivery with the next resolved address after a network timeout", async () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    upsertSmtpConfig(admin.id, "applicationAdmin", {
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
    const token = createApplicationToken("system-admin-1", "systemAdmin", {
      applicationId: application.id,
      label: "App Token",
      retainAttachmentsDays: 30,
      retainErrorDetailsDays: 30,
      retainFailedJobsDays: 30,
      retainSentJobsDays: 30,
      scopes: ["send"],
    });
    const authToken = authenticateAccessToken(
      issueClientAccessToken({
        clientId: token.clientId,
        clientSecret: token.clientSecret,
      }).accessToken,
      "send",
    );

    const firstSendMail = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("Connection timeout"), { code: "ETIMEDOUT" }));
    const secondSendMail = vi.fn().mockResolvedValue({ messageId: "provider-2" });
    const createTransport = vi.fn((options) => {
      if (options.host === "2001:4860:4860::8844") {
        return { close: vi.fn(), sendMail: firstSendMail, verify: vi.fn() };
      }

      return { close: vi.fn(), sendMail: secondSendMail, verify: vi.fn() };
    });
    const lookupHost = vi.fn().mockResolvedValue([
      { address: "2001:4860:4860::8844", family: 6 },
      { address: "203.0.114.22", family: 4 },
    ]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const job = enqueueMail(
      authToken,
      {
        attachments: [],
        from: "sender@example.com",
        headers: {},
        html: "<p>Hello</p>",
        messageId: "msg-2",
        subject: "Subject",
        text: "Hello",
        to: "recipient@example.com",
      },
      "queued",
    );

    const processed = await processJob(job.id);
    expect(processed.status).toBe("sent");
    expect(lookupHost).toHaveBeenCalledWith("smtp.example.com", { all: true });
    expect(createTransport).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        host: "2001:4860:4860::8844",
        tls: expect.objectContaining({ servername: "smtp.example.com" }),
      }),
    );
    expect(createTransport).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        host: "203.0.114.22",
        tls: expect.objectContaining({ servername: "smtp.example.com" }),
      }),
    );
    expect(firstSendMail).toHaveBeenCalledTimes(1);
    expect(secondSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "sender@example.com",
        messageId: "msg-2",
        subject: "Subject",
        to: "recipient@example.com",
      }),
    );
  });
});

describe("sendSystemAdminTestMail", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-backend-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    resetDatabase();
  });

  afterEach(() => {
    resetSmtpTestDependencies();
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("sends a direct test mail to the signed-in system admin email", async () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    const config = upsertSmtpConfig(admin.id, "applicationAdmin", {
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
      username: "mailer@example.com",
    });

    const verify = vi.fn();
    const sendMail = vi.fn().mockResolvedValue({ messageId: "provider-1" });
    const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.30", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const result = await sendSystemAdminTestMail("oidc-user-123", config.id, "admin@example.com");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected test mail to succeed");
    }

    expect(result.job.status).toBe("sent");
    expect(lookupHost).toHaveBeenCalledWith("smtp.example.com", { all: true });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "sender@example.com",
        subject: "Relanto SMTP test email",
        text: "This is a Relanto test email.",
        to: "admin@example.com",
      }),
    );
  });

  it("returns a classified failure when the direct test mail cannot be sent", async () => {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: "Admin One",
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App One",
    });
    const config = upsertSmtpConfig(admin.id, "applicationAdmin", {
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
      username: "mailer@example.com",
    });

    const verify = vi.fn();
    const sendMail = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("Invalid login"), { code: "EAUTH" }));
    const createTransport = vi.fn(() => ({ close: vi.fn(), sendMail, verify }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.31", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const result = await sendSystemAdminTestMail("oidc-user-123", config.id, "admin@example.com");

    expect(result).toMatchObject({
      category: "auth",
      debug: {
        attempts: [
          {
            address: "203.0.114.31",
            code: "EAUTH",
            family: 4,
            message: "Invalid login",
            outcome: "failed",
            phase: "send",
          },
        ],
        host: "smtp.example.com",
        minTlsVersion: "TLSv1.2",
        port: 587,
        requireTls: true,
        resolvedTargets: ["203.0.114.31"],
        secure: false,
      },
      message: "Invalid login",
      ok: false,
      permanent: true,
    });
  });
});

describe("renameApplicationAdmin and renameApplication", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-backend-rename-test-"));
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

  it("renames an application admin and writes an audit log with previous and next labels", () => {
    const admin = createApplicationAdmin("oidc-user-rename", "systemAdmin", {
      label: "Initial Admin",
    });

    const renamed = renameApplicationAdmin("oidc-user-rename", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "Updated Admin",
    });

    expect(renamed.label).toBe("Updated Admin");
    expect(getApplicationAdminById(admin.id).label).toBe("Updated Admin");

    const auditEntry = getDatabase()
      .prepare(
        `SELECT actor_type, actor_id, action, entity_type, entity_id, details_json
         FROM audit_logs
         WHERE action = 'application_admin.renamed'`,
      )
      .get();

    expect(auditEntry).toMatchObject({
      action: "application_admin.renamed",
      actor_id: "oidc-user-rename",
      actor_type: "systemAdmin",
      entity_id: admin.id,
      entity_type: "application_admin",
    });
    expect(JSON.parse(auditEntry.details_json)).toStrictEqual({
      nextLabel: "Updated Admin",
      previousLabel: "Initial Admin",
    });
  });

  it("rejects an empty label when renaming an application admin", () => {
    const admin = createApplicationAdmin("oidc-user-rename", "systemAdmin", {
      label: "Initial Admin",
    });

    expect(() =>
      renameApplicationAdmin("oidc-user-rename", "systemAdmin", {
        applicationAdminId: admin.id,
        label: "   ",
      }),
    ).toThrowError(/label is required/i);
  });

  it("throws when the application admin does not exist", () => {
    expect(() =>
      renameApplicationAdmin("oidc-user-rename", "systemAdmin", {
        applicationAdminId: "appadm_missing",
        label: "Updated Admin",
      }),
    ).toThrowError("Application admin not found");
  });

  it("renames an application and writes an audit log with previous and next labels", () => {
    const admin = createApplicationAdmin("oidc-user-rename", "systemAdmin", {
      label: "Renaming Admin",
    });
    const application = createApplication("oidc-user-rename", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "Initial App",
    });

    const renamed = renameApplication("oidc-user-rename", "systemAdmin", {
      applicationId: application.id,
      label: "Updated App",
    });

    expect(renamed.label).toBe("Updated App");
    expect(getApplicationById(application.id).label).toBe("Updated App");

    const auditEntry = getDatabase()
      .prepare(
        `SELECT actor_type, actor_id, action, entity_type, entity_id, details_json
         FROM audit_logs
         WHERE action = 'application.renamed'`,
      )
      .get();

    expect(auditEntry).toMatchObject({
      action: "application.renamed",
      actor_id: "oidc-user-rename",
      actor_type: "systemAdmin",
      entity_id: application.id,
      entity_type: "application",
    });
    expect(JSON.parse(auditEntry.details_json)).toStrictEqual({
      nextLabel: "Updated App",
      previousLabel: "Initial App",
    });
  });

  it("rejects an empty label when renaming an application", () => {
    const admin = createApplicationAdmin("oidc-user-rename", "systemAdmin", {
      label: "Renaming Admin",
    });
    const application = createApplication("oidc-user-rename", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "Initial App",
    });

    expect(() =>
      renameApplication("oidc-user-rename", "systemAdmin", {
        applicationId: application.id,
        label: "",
      }),
    ).toThrowError(/label is required/i);
  });

  it("throws when the application does not exist", () => {
    expect(() =>
      renameApplication("oidc-user-rename", "systemAdmin", {
        applicationId: "app_missing",
        label: "Updated App",
      }),
    ).toThrowError("Application not found");
  });
});

describe("list endpoint ownership filtering (no N+1)", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-backend-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    resetDatabase();
  });

  afterEach(() => {
    resetSmtpTestDependencies();
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    rmSync(tempDir, { force: true, recursive: true });
  });

  // Builds an application admin owning one application + config, an application (send) token,
  // and one enqueued job for that application.
  function createOwnerContext(label) {
    const admin = createApplicationAdmin("system-admin-1", "systemAdmin", {
      label: `Admin ${label}`,
    });
    const application = createApplication("system-admin-1", "systemAdmin", {
      applicationAdminId: admin.id,
      label: `App ${label}`,
    });
    const config = upsertSmtpConfig(admin.id, "applicationAdmin", {
      applicationId: application.id,
      connectionTimeoutMs: 10_000,
      defaultFromAddress: "sender@example.com",
      greetingTimeoutMs: 10_000,
      host: "smtp.example.com",
      minTlsVersion: "TLSv1.2",
      name: `SMTP ${label}`,
      password: "secret",
      port: 587,
      requireTls: true,
      secure: false,
      socketTimeoutMs: 20_000,
      username: "mailer@example.com",
    });
    const token = createApplicationToken("system-admin-1", "systemAdmin", {
      applicationId: application.id,
      label: `Token ${label}`,
      retainAttachmentsDays: 30,
      retainErrorDetailsDays: 30,
      retainFailedJobsDays: 30,
      retainSentJobsDays: 30,
      scopes: ["send"],
    });
    const authToken = authenticateAccessToken(
      issueClientAccessToken({
        clientId: token.clientId,
        clientSecret: token.clientSecret,
      }).accessToken,
      "send",
    );
    const job = enqueueTestMail(authToken, `msg-${label}`);

    return { admin, application, config, job };
  }

  // Mirrors the loader's ownership filter for the api.configs list endpoint.
  function configFiltersFor(authToken) {
    return {
      applicationAdminId:
        authToken.kind === "applicationAdmin" ? authToken.applicationAdminId : undefined,
      configId: authToken.kind === "application" ? authToken.configId : undefined,
    };
  }

  // Mirrors the loader's ownership filter for the api.jobs list endpoint.
  function jobFiltersFor(authToken) {
    return {
      applicationAdminId:
        authToken.kind === "applicationAdmin" ? authToken.applicationAdminId : undefined,
      applicationId: authToken.kind === "application" ? authToken.applicationId : undefined,
    };
  }

  it("returns configs for every token kind identically to per-element ownership filtering", () => {
    const owner = createOwnerContext("A");
    const foreign = createOwnerContext("B");

    const adminToken = {
      applicationAdminId: owner.admin.id,
      clientId: "client-admin",
      kind: "applicationAdmin",
      scopes: ["manageApplications"],
      tokenId: "admtok-a",
    };
    const applicationToken = {
      applicationId: owner.application.id,
      clientId: "client-app",
      configId: owner.config.id,
      kind: "application",
      scopes: ["manageApplications"],
      tokenId: "apptok-a",
    };

    // System admin: sees every config.
    const allConfigIds = listSmtpConfigs()
      .map((config) => config.id)
      .sort();
    expect(allConfigIds).toStrictEqual([owner.config.id, foreign.config.id].sort());

    // Application admin: only own application's config, never the foreign one.
    const adminConfigIds = listSmtpConfigs(configFiltersFor(adminToken)).map((config) => config.id);
    expect(adminConfigIds).toStrictEqual([owner.config.id]);
    expect(adminConfigIds).not.toContain(foreign.config.id);
    expect(adminConfigIds).toStrictEqual(
      listSmtpConfigs()
        .filter((config) => canTokenAccessConfig(adminToken, config.id))
        .map((config) => config.id),
    );

    // Application token: only its own config.
    const applicationConfigIds = listSmtpConfigs(configFiltersFor(applicationToken)).map(
      (config) => config.id,
    );
    expect(applicationConfigIds).toStrictEqual([owner.config.id]);
    expect(applicationConfigIds).toStrictEqual(
      listSmtpConfigs()
        .filter((config) => canTokenAccessConfig(applicationToken, config.id))
        .map((config) => config.id),
    );
  });

  it("returns jobs for every token kind identically to per-element ownership filtering", () => {
    const owner = createOwnerContext("A");
    const foreign = createOwnerContext("B");

    const adminToken = {
      applicationAdminId: owner.admin.id,
      clientId: "client-admin",
      kind: "applicationAdmin",
      scopes: ["readStatus"],
      tokenId: "admtok-a",
    };
    const applicationToken = {
      applicationId: owner.application.id,
      clientId: "client-app",
      configId: owner.config.id,
      kind: "application",
      scopes: ["readStatus"],
      tokenId: "apptok-a",
    };

    // System admin: sees every job.
    const allJobIds = listJobStatusViews()
      .map((job) => job.id)
      .sort();
    expect(allJobIds).toStrictEqual([owner.job.id, foreign.job.id].sort());

    // Application admin: only own application's jobs, never the foreign one.
    const adminJobIds = listJobStatusViews(jobFiltersFor(adminToken)).map((job) => job.id);
    expect(adminJobIds).toStrictEqual([owner.job.id]);
    expect(adminJobIds).not.toContain(foreign.job.id);
    expect(adminJobIds).toStrictEqual(
      listJobStatusViews()
        .filter((job) => canTokenAccessJob(adminToken, job.id))
        .map((job) => job.id),
    );

    // Application token: only its own application's jobs.
    const applicationJobIds = listJobStatusViews(jobFiltersFor(applicationToken)).map(
      (job) => job.id,
    );
    expect(applicationJobIds).toStrictEqual([owner.job.id]);
    expect(applicationJobIds).toStrictEqual(
      listJobStatusViews()
        .filter((job) => canTokenAccessJob(applicationToken, job.id))
        .map((job) => job.id),
    );
  });
});

describe("manual retry, resume, and SMTP transport lifecycle", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-backend-retry-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    resetDatabase();
  });

  afterEach(() => {
    resetSmtpTestDependencies();
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("resets retry_count to 0 on a manual retry so the backoff restarts", () => {
    const { authToken } = createSendContext();
    const job = enqueueTestMail(authToken, "msg-manual-retry");

    getDatabase()
      .prepare("UPDATE mail_jobs SET status = ?, retry_count = ? WHERE id = ?")
      .run("delivery_uncertain", 5, job.id);
    expect(getJob(job.id).retryCount).toBe(5);

    const retried = retryJob("system-admin-1", "systemAdmin", job.id);

    expect(retried.status).toBe("queued");
    expect(retried.retryCount).toBe(0);
    expect(retried.nextRetryAt).toBeUndefined();
  });

  it("preserves the accumulated retry_count when resuming a paused job", () => {
    const { authToken } = createSendContext();
    const job = enqueueTestMail(authToken, "msg-resume");

    getDatabase()
      .prepare("UPDATE mail_jobs SET status = ?, retry_count = ? WHERE id = ?")
      .run("paused", 3, job.id);

    const resumed = resumeJob("system-admin-1", "systemAdmin", job.id);

    expect(resumed.status).toBe("queued");
    expect(resumed.retryCount).toBe(3);
  });

  it("closes the SMTP transport after a successful send", async () => {
    const { authToken } = createSendContext();
    const close = vi.fn();
    const sendMail = vi.fn().mockResolvedValue({ messageId: "provider-close-1" });
    const createTransport = vi.fn(() => ({ close, sendMail, verify: vi.fn() }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.60", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const job = enqueueTestMail(authToken, "msg-close-ok");
    const processed = await processJob(job.id);

    expect(processed.status).toBe("sent");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes the SMTP transport even when the send fails", async () => {
    const { authToken } = createSendContext();
    const close = vi.fn();
    const sendMail = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("Connection timeout"), { code: "ETIMEDOUT" }));
    const createTransport = vi.fn(() => ({ close, sendMail, verify: vi.fn() }));
    const lookupHost = vi.fn().mockResolvedValue([{ address: "203.0.114.61", family: 4 }]);
    setSmtpTestDependencies({
      createMailerTransport: createTransport,
      lookupSmtpHost: lookupHost,
    });

    const job = enqueueTestMail(authToken, "msg-close-fail");
    await processJob(job.id);

    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("database read boundary validation (Zod)", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-backend-boundary-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    resetDatabase();
  });

  afterEach(() => {
    resetSmtpTestDependencies();
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("rejects a mail job whose stored attachments JSON violates the schema", () => {
    const { authToken } = createSendContext();
    const job = enqueueTestMail(authToken, "msg-bad-attachments");

    getDatabase()
      .prepare("UPDATE mail_jobs SET attachments_json = ? WHERE id = ?")
      .run(JSON.stringify([{ filename: "missing-content" }]), job.id);

    expect(() => getJob(job.id)).toThrow();
  });

  it("rejects a mail job whose stored headers JSON is not a string map", () => {
    const { authToken } = createSendContext();
    const job = enqueueTestMail(authToken, "msg-bad-headers");

    getDatabase()
      .prepare("UPDATE mail_jobs SET headers_json = ? WHERE id = ?")
      .run(JSON.stringify({ "X-Test": 42 }), job.id);

    expect(() => getJob(job.id)).toThrow();
  });

  it("rejects a mail job whose stored error_category is unknown", () => {
    const { authToken } = createSendContext();
    const job = enqueueTestMail(authToken, "msg-bad-category");

    getDatabase()
      .prepare("UPDATE mail_jobs SET error_category = ? WHERE id = ?")
      .run("not-a-real-category", job.id);

    expect(() => getJob(job.id)).toThrow();
  });

  it("rejects an SMTP config whose stored min_tls_version is invalid", () => {
    const { config } = createSendContext();

    getDatabase()
      .prepare("UPDATE smtp_configs SET min_tls_version = ? WHERE id = ?")
      .run("TLSv9.9", config.id);

    expect(() => getSmtpConfig(config.id)).toThrow();
  });

  it("round-trips a mail job with valid stored attachments", () => {
    const { authToken } = createSendContext();
    const job = enqueueMail(
      authToken,
      {
        attachments: [
          {
            contentBase64: Buffer.from("hello world").toString("base64"),
            contentType: "text/plain",
            filename: "hello.txt",
          },
        ],
        from: "sender@example.com",
        headers: { "X-Test": "value" },
        html: "<p>Hello</p>",
        messageId: "msg-valid-attachments",
        subject: "Subject",
        text: "Hello",
        to: "recipient@example.com",
      },
      "queued",
    );

    const stored = getJob(job.id);

    expect(stored.attachments).toHaveLength(1);
    expect(stored.attachments[0].filename).toBe("hello.txt");
    expect(stored.attachments[0].contentDisposition).toBe("attachment");
    expect(stored.headers).toStrictEqual({ "X-Test": "value" });
  });
});

describe("authenticateAccessToken with a non-writable database", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-auth-readonly-test-"));
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

  it("still authenticates when the best-effort last_used_at write fails", () => {
    const { application } = createSendContext();
    // Issue a fresh access token to authenticate against the read-only database.
    const token = createApplicationToken("system-admin-1", "systemAdmin", {
      applicationId: application.id,
      label: "Read Token",
      retainAttachmentsDays: 30,
      retainErrorDetailsDays: 30,
      retainFailedJobsDays: 30,
      retainSentJobsDays: 30,
      scopes: ["send"],
    });
    const accessToken = issueClientAccessToken({
      clientId: token.clientId,
      clientSecret: token.clientSecret,
    }).accessToken;

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // `query_only` makes every write throw "attempt to write a readonly database"
    // while reads keep working, exactly like the production read-only database.
    getDatabase().pragma("query_only = true");

    try {
      const authenticated = authenticateAccessToken(accessToken, "send");

      expect(authenticated.tokenId).toBe(token.id);
      expect(authenticated.scopes).toContain("send");
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("failed to update last_used_at"),
      );
    } finally {
      getDatabase().pragma("query_only = false");
      consoleError.mockRestore();
    }
  });
});
