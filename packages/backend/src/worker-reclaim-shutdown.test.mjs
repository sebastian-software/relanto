import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDatabase, resetDatabase } from "./db.ts";
import {
  createApplication,
  createApplicationAdmin,
  createApplicationToken,
  enqueueMail,
  getJob,
  reapTimedOutProcessingJobs,
  reclaimStuckProcessingJobs,
  resetSmtpTestDependencies,
  setSmtpTestDependencies,
  upsertSmtpConfig,
} from "./service.ts";
import { shutdownWorker, startWorkerLoop, stopWorkerLoop } from "./worker.ts";

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

function markProcessing(jobId, processingStartedAt) {
  getDatabase()
    .prepare(
      "UPDATE mail_jobs SET status = 'processing', processing_started_at = ?, updated_at = ? WHERE id = ?",
    )
    .run(processingStartedAt, processingStartedAt, jobId);
}

function jobEvents(jobId) {
  return getDatabase()
    .prepare("SELECT status, details_json FROM job_events WHERE job_id = ? ORDER BY created_at ASC")
    .all(jobId);
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

describe("worker reclaim and graceful shutdown", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-reclaim-test-"));
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
    delete process.env.MAILER_PROCESSING_TIMEOUT_MS;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("reclaims stuck processing jobs back to queued and records a job event", () => {
    const { authToken } = createFixture();
    const job = enqueueMail(authToken, createSendMailInput(), "queued");
    markProcessing(job.id, new Date().toISOString());

    const reclaimed = reclaimStuckProcessingJobs();

    expect(reclaimed).toBe(1);

    const reloaded = getJob(job.id);
    expect(reloaded.status).toBe("queued");
    expect(reloaded.processingStartedAt).toBeUndefined();

    const reclaimEvents = jobEvents(job.id).filter(
      (event) =>
        event.status === "queued" && String(event.details_json).includes("reclaimedOnStartup"),
    );
    expect(reclaimEvents).toHaveLength(1);
  });

  it("processes a job that was orphaned in processing when the worker boots", async () => {
    const { authToken } = createFixture();
    const job = enqueueMail(authToken, createSendMailInput(), "queued");
    markProcessing(job.id, new Date().toISOString());

    startWorkerLoop();

    await expect(waitForJobStatus(job.id, "sent")).resolves.toMatchObject({
      id: job.id,
      status: "sent",
    });
  });

  it("reaps jobs stuck in processing past the timeout but leaves fresh ones alone", () => {
    const { authToken } = createFixture();
    const staleJob = enqueueMail(
      authToken,
      createSendMailInput({ idempotencyKey: "stale", messageId: "msg-stale" }),
      "queued",
    );
    const freshJob = enqueueMail(
      authToken,
      createSendMailInput({ idempotencyKey: "fresh", messageId: "msg-fresh" }),
      "queued",
    );

    const now = new Date();
    const stale = new Date(now.getTime() - 10 * 60_000).toISOString();
    markProcessing(staleJob.id, stale);
    markProcessing(freshJob.id, now.toISOString());

    const reaped = reapTimedOutProcessingJobs(now.toISOString(), 60_000);

    expect(reaped).toBe(1);

    const reloadedStale = getJob(staleJob.id);
    expect(reloadedStale.status).toBe("retry_scheduled");
    expect(reloadedStale.nextRetryAt).toBeTruthy();
    expect(getJob(freshJob.id).status).toBe("processing");

    const reapEvents = jobEvents(staleJob.id).filter(
      (event) =>
        event.status === "retry_scheduled" &&
        String(event.details_json).includes("reapedAfterTimeoutMs"),
    );
    expect(reapEvents).toHaveLength(1);
  });

  it("stops starting new ticks after shutdown", async () => {
    const { authToken } = createFixture();

    startWorkerLoop();
    await shutdownWorker({ exit: false, timeoutMs: 1_000 });

    const job = enqueueMail(authToken, createSendMailInput({ messageId: "msg-after" }), "queued");

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(getJob(job.id).status).toBe("queued");
  });

  it("waits for an in-flight tick to settle before completing shutdown", async () => {
    let releaseSend = () => {};
    const sendGate = new Promise((resolve) => {
      releaseSend = resolve;
    });

    setSmtpTestDependencies({
      createMailerTransport: vi.fn(() => ({
        close: vi.fn(),
        sendMail: vi.fn(async () => {
          await sendGate;
          return { messageId: "provider-msg-slow" };
        }),
      })),
      lookupSmtpHost: vi.fn().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]),
    });

    const { authToken } = createFixture();
    const job = enqueueMail(authToken, createSendMailInput({ messageId: "msg-slow" }), "queued");

    startWorkerLoop();
    await waitForJobStatus(job.id, "processing");

    let shutdownResolved = false;
    const shutdownPromise = shutdownWorker({ exit: false, timeoutMs: 2_000 }).then(() => {
      shutdownResolved = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(shutdownResolved).toBe(false);

    releaseSend();
    await shutdownPromise;

    expect(shutdownResolved).toBe(true);
    expect(getJob(job.id).status).toBe("sent");
  });

  it("registers shutdown signal handlers idempotently", () => {
    const before = process.listenerCount("SIGTERM");

    startWorkerLoop();
    startWorkerLoop();

    expect(process.listenerCount("SIGTERM")).toBe(before + 1);
    expect(process.listenerCount("SIGINT")).toBeGreaterThanOrEqual(1);

    stopWorkerLoop();

    expect(process.listenerCount("SIGTERM")).toBe(before);
  });
});
