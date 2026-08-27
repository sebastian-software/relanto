import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDatabase, resetDatabase } from "./db.ts";
import {
  createApplication,
  createApplicationAdmin,
  createApplicationToken,
  enqueueMail,
  getJob,
  processDueJobs,
  resetSmtpTestDependencies,
  runRetention,
  setSmtpTestDependencies,
  upsertSmtpConfig,
} from "./service.ts";
import { startWorkerLoop, stopWorkerLoop } from "./worker.ts";

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
  const token = createApplicationToken("system", "systemAdmin", {
    applicationId: application.id,
    label: "Application token",
    retainAttachmentsDays: 30,
    retainErrorDetailsDays: 30,
    retainFailedJobsDays: 30,
    retainSentJobsDays: 30,
    scopes: ["send", "readStatus"],
  });

  return {
    authToken: {
      applicationId: application.id,
      configId: config.id,
      kind: "application",
      scopes: ["send", "readStatus"],
      tokenId: token.id,
    },
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

async function waitForJobStatus(jobId, expectedStatus) {
  const deadline = Date.now() + 1_500;

  while (Date.now() < deadline) {
    const current = getJob(jobId);

    if (current.status === expectedStatus) {
      return current;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for job ${jobId} to reach status ${expectedStatus}`);
}

describe("worker loop", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-worker-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    process.env.MAILER_WORKER_INTERVAL_MS = "25";
    resetDatabase();
    stopWorkerLoop();
    setSmtpTestDependencies({
      createMailerTransport: vi.fn(() => ({
        close: vi.fn(),
        sendMail: vi.fn().mockResolvedValue({ messageId: "provider-msg-1" }),
      })),
      lookupSmtpHost: vi.fn().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]),
    });
  });

  afterEach(() => {
    stopWorkerLoop();
    resetSmtpTestDependencies();
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    delete process.env.MAILER_WORKER_INTERVAL_MS;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("processes queued jobs immediately after the worker loop starts", async () => {
    const { authToken } = createFixture();
    const job = enqueueMail(authToken, createSendMailInput(), "queued");

    startWorkerLoop();

    await expect(waitForJobStatus(job.id, "sent")).resolves.toMatchObject({
      id: job.id,
      status: "sent",
    });
  });

  it("resumes queued job processing after a worker restart", async () => {
    const { authToken } = createFixture();
    const firstJob = enqueueMail(
      authToken,
      createSendMailInput({ messageId: "msg-first" }),
      "queued",
    );

    startWorkerLoop();
    await waitForJobStatus(firstJob.id, "sent");

    stopWorkerLoop();

    const secondJob = enqueueMail(
      authToken,
      createSendMailInput({ idempotencyKey: "job-restart", messageId: "msg-second" }),
      "queued",
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(getJob(secondJob.id).status).toBe("queued");

    startWorkerLoop();

    await expect(waitForJobStatus(secondJob.id, "sent")).resolves.toMatchObject({
      id: secondJob.id,
      status: "sent",
    });
  });

  it("does not run retention on the processDueJobs hot loop", async () => {
    const { authToken } = createFixture();
    const expiredSentJob = enqueueMail(
      authToken,
      createSendMailInput({ idempotencyKey: "retention-decoupled" }),
      "queued",
    );

    getDatabase()
      .prepare(
        `UPDATE mail_jobs
        SET
          status = 'sent',
          sent_at = ?,
          updated_at = ?,
          retain_sent_jobs_days = 1
        WHERE id = ?`,
      )
      .run("2000-01-01T00:00:00.000Z", "2000-01-01T00:00:00.000Z", expiredSentJob.id);

    // The worker main tick must leave the expired job untouched: retention no longer
    // runs on every processDueJobs call.
    await processDueJobs();
    await processDueJobs();

    expect(getJob(expiredSentJob.id).status).toBe("sent");

    // The dedicated retention entry point still enforces the same cutoff semantics.
    runRetention();

    expect(() => getJob(expiredSentJob.id)).toThrowError();
  });

  it("does not start overlapping processDueJobs runs when one tick is slow", async () => {
    vi.useFakeTimers();

    const activeRuns = { current: 0 };
    const callCount = { current: 0 };
    const releaseResolvers = [];
    const releasePromises = [];

    setSmtpTestDependencies({
      createMailerTransport: vi.fn(() => ({
        close: vi.fn(),
        sendMail: vi.fn(async () => {
          callCount.current += 1;
          activeRuns.current += 1;
          const releasePromise = new Promise((resolve) => {
            releaseResolvers.push(resolve);
          });
          releasePromises.push(releasePromise);
          await releasePromise;
          activeRuns.current -= 1;
          return { messageId: `provider-msg-${String(callCount.current)}` };
        }),
      })),
      lookupSmtpHost: vi.fn().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]),
    });

    const { authToken } = createFixture();
    const firstJob = enqueueMail(
      authToken,
      createSendMailInput({ idempotencyKey: "slow-job-1", messageId: "msg-slow-1" }),
      "queued",
    );
    const secondJob = enqueueMail(
      authToken,
      createSendMailInput({ idempotencyKey: "slow-job-2", messageId: "msg-slow-2" }),
      "queued",
    );

    startWorkerLoop();
    await vi.advanceTimersByTimeAsync(80);

    expect(callCount.current).toBe(1);
    expect(activeRuns.current).toBe(1);
    expect(getJob(firstJob.id).status).toBe("processing");
    expect(getJob(secondJob.id).status).toBe("queued");

    releaseResolvers.shift()?.();
    await Promise.all(releasePromises.splice(0));
    await vi.advanceTimersByTimeAsync(30);

    expect(callCount.current).toBe(2);
    expect(activeRuns.current).toBe(1);
    expect(getJob(secondJob.id).status).toBe("processing");

    releaseResolvers.shift()?.();
    await Promise.all(releasePromises.splice(0));
    await vi.advanceTimersByTimeAsync(30);

    expect(getJob(firstJob.id).status).toBe("sent");
    expect(getJob(secondJob.id).status).toBe("sent");

    vi.useRealTimers();
  });
});
