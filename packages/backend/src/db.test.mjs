import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDatabase, resetDatabase } from "./db.ts";

const EXPECTED_USER_VERSION = 12;

const EXPECTED_MAIL_JOBS_INDEXES = [
  "mail_jobs_status_created_at",
  "mail_jobs_status_updated_at",
  "mail_jobs_application_created_at",
  "mail_jobs_message_id",
];

describe("db migrations", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-db-test-"));
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

  it("bumps user_version to the expected migration version", () => {
    const database = getDatabase();

    const { user_version: userVersion } = database.prepare("PRAGMA user_version").get();

    expect(userVersion).toBe(EXPECTED_USER_VERSION);
  });

  it("creates the performance indexes on mail_jobs", () => {
    const database = getDatabase();

    const indexNames = database
      .prepare("PRAGMA index_list('mail_jobs')")
      .all()
      .map((row) => row.name);

    for (const expected of EXPECTED_MAIL_JOBS_INDEXES) {
      expect(indexNames).toContain(expected);
    }
  });

  it("registers the mail_jobs indexes in sqlite_master", () => {
    const database = getDatabase();

    const rows = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'mail_jobs'")
      .all()
      .map((row) => row.name);

    for (const expected of EXPECTED_MAIL_JOBS_INDEXES) {
      expect(rows).toContain(expected);
    }
  });

  it("enables WAL journal mode, busy_timeout and synchronous NORMAL on the connection", () => {
    const database = getDatabase();

    const journalMode = database.pragma("journal_mode", { simple: true });
    const busyTimeout = database.pragma("busy_timeout", { simple: true });
    const synchronous = database.pragma("synchronous", { simple: true });

    expect(journalMode).toBe("wal");
    expect(busyTimeout).toBe(5000);
    expect(synchronous).toBe(1);
  });
});
