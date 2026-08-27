import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDatabase, resetDatabase } from "./db.ts";
import {
  createApplication,
  createApplicationAdmin,
  createApplicationToken,
  enqueueMail,
  getJob,
  processJob,
  resetSmtpTestDependencies,
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

function countMailJobs() {
  return Number(getDatabase().prepare("SELECT COUNT(*) AS count FROM mail_jobs").get().count);
}

// Removing the job_events table makes writeJobEvent throw, letting us assert that the
// coupled writes surrounding it are rolled back as a unit instead of leaving partial rows.
function dropJobEventsTable() {
  getDatabase().exec("DROP TABLE job_events");
}

describe("crash-consistent database writes", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-tx-test-"));
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

  it("rolls back the mail job insert when writing the queued job event fails", () => {
    const { authToken } = createFixture();
    dropJobEventsTable();

    expect(() => enqueueMail(authToken, createSendMailInput(), "queued")).toThrow();

    // The insert, event and audit log share one transaction, so a failing event write
    // must leave no orphaned mail_jobs row behind.
    expect(countMailJobs()).toBe(0);
  });

  it("rolls back the atomic claim when writing the processing job event fails", async () => {
    const { authToken } = createFixture();
    const job = enqueueMail(authToken, createSendMailInput(), "queued");

    dropJobEventsTable();

    await expect(processJob(job.id)).rejects.toThrow();

    // Recreate job_events so getJob (and its downstream reads) can observe the row again.
    getDatabase().exec(
      `CREATE TABLE job_events (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES mail_jobs(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
    );

    const reloaded = getJob(job.id);
    expect(reloaded.status).toBe("queued");
    expect(reloaded.processingStartedAt).toBeUndefined();
  });
});
