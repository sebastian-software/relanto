import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDatabase, resetDatabase } from "./db.ts";

// These tests exercise the schema and data migrations run by getDatabase() against
// fixture databases that are written to disk in an old schema shape before the
// migrations run. This covers the legacy table-rewrite branch (DROP TABLE with
// foreign_keys = OFF) as well as the incremental ALTER/UPDATE migrations, none of
// which are reachable when a test starts from a fresh, already-current database.

let tempDir = "";
let databasePath = "";

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "relanto-db-migration-test-"));
  databasePath = join(tempDir, "mailer.sqlite");
  process.env.MAILER_DB_PATH = databasePath;
  process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
  resetDatabase();
});

afterEach(() => {
  resetDatabase();
  delete process.env.MAILER_DB_PATH;
  delete process.env.MAILER_SECRET_KEY;
  rmSync(tempDir, { force: true, recursive: true });
});

function tableExists(database, tableName) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  return row?.name === tableName;
}

function columnNames(database, tableName) {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all();

  return rows.map((row) => row.name);
}

function primaryKeyColumns(database, tableName) {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all();

  return rows.filter((row) => row.pk > 0).map((row) => row.name);
}

function userVersion(database) {
  return database.prepare("PRAGMA user_version").get().user_version;
}

// Builds a legacy (user_version = 2) database on disk: principals/access_tokens plus
// smtp_configs without application_id and mail_jobs without application_id. This is the
// exact shape that migrateLegacySchema() must rewrite with DROP TABLE while foreign
// keys are disabled.
function createLegacyDatabase(filePath) {
  const legacy = new BetterSqlite3(filePath);

  legacy.exec(`
    CREATE TABLE principals (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      oidc_subject TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE smtp_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL,
      password_encrypted TEXT,
      secure INTEGER NOT NULL,
      require_tls INTEGER NOT NULL,
      min_tls_version TEXT NOT NULL,
      connection_timeout_ms INTEGER NOT NULL,
      greeting_timeout_ms INTEGER NOT NULL,
      socket_timeout_ms INTEGER NOT NULL,
      disabled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE access_tokens (
      id TEXT PRIMARY KEY,
      config_id TEXT NOT NULL REFERENCES smtp_configs(id) ON DELETE CASCADE,
      principal_id TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      hashed_token TEXT NOT NULL UNIQUE,
      token_preview TEXT NOT NULL,
      scopes_json TEXT NOT NULL,
      retain_sent_jobs_days INTEGER NOT NULL,
      retain_failed_jobs_days INTEGER NOT NULL,
      retain_attachments_days INTEGER NOT NULL,
      retain_error_details_days INTEGER NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE mail_jobs (
      id TEXT PRIMARY KEY,
      config_id TEXT NOT NULL REFERENCES smtp_configs(id) ON DELETE RESTRICT,
      token_id TEXT REFERENCES access_tokens(id) ON DELETE SET NULL,
      idempotency_key TEXT,
      message_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      text_body TEXT NOT NULL,
      headers_json TEXT NOT NULL,
      attachments_json TEXT NOT NULL,
      status TEXT NOT NULL,
      delivery_mode TEXT NOT NULL,
      retry_count INTEGER NOT NULL,
      next_retry_at TEXT,
      last_error TEXT,
      error_category TEXT,
      error_permanent INTEGER,
      error_code TEXT,
      provider_response_code INTEGER,
      provider_message_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      accepted_at TEXT,
      processing_started_at TEXT,
      sent_at TEXT,
      deleted_at TEXT
    );

    CREATE UNIQUE INDEX mail_jobs_config_idempotency_key
    ON mail_jobs(config_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

    CREATE TABLE job_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES mail_jobs(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  legacy
    .prepare(
      `INSERT INTO principals (id, type, label, oidc_subject, created_at, updated_at)
       VALUES (@id, @type, @label, @oidc_subject, @created_at, @updated_at)`,
    )
    .run({
      id: "admin-1",
      type: "applicationAdmin",
      label: "Admin One",
      oidc_subject: null,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
    });
  legacy
    .prepare(
      `INSERT INTO principals (id, type, label, oidc_subject, created_at, updated_at)
       VALUES (@id, @type, @label, @oidc_subject, @created_at, @updated_at)`,
    )
    .run({
      id: "app-1",
      type: "application",
      label: "App One",
      oidc_subject: null,
      created_at: "2024-01-02T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
    });

  legacy
    .prepare(
      `INSERT INTO smtp_configs (
         id, name, host, port, username, password_encrypted, secure, require_tls,
         min_tls_version, connection_timeout_ms, greeting_timeout_ms, socket_timeout_ms,
         disabled_at, created_at, updated_at
       ) VALUES (
         'config-1', 'Primary', 'smtp.example.com', 587, 'smtp-user@example.com',
         'enc-secret', 0, 1, 'TLSv1', 10000, 10000, 20000, NULL,
         '2024-01-03T00:00:00.000Z', '2024-01-03T00:00:00.000Z'
       )`,
    )
    .run();

  const insertToken = legacy.prepare(
    `INSERT INTO access_tokens (
       id, config_id, principal_id, label, hashed_token, token_preview, scopes_json,
       retain_sent_jobs_days, retain_failed_jobs_days, retain_attachments_days,
       retain_error_details_days, last_used_at, revoked_at, created_at, updated_at
     ) VALUES (
       @id, 'config-1', @principal_id, @label, @hashed_token, @token_preview, @scopes_json,
       @sent, @failed, @attachments, @error_details, NULL, NULL,
       @created_at, @created_at
     )`,
  );
  insertToken.run({
    id: "token-app-1",
    principal_id: "app-1",
    label: "App Token",
    hashed_token: "hash-app",
    token_preview: "prev-app",
    scopes_json: '["mail:send"]',
    sent: 10,
    failed: 11,
    attachments: 12,
    error_details: 13,
    created_at: "2024-01-04T00:00:00.000Z",
  });
  insertToken.run({
    id: "token-admin-1",
    principal_id: "admin-1",
    label: "Admin Token",
    hashed_token: "hash-admin",
    token_preview: "prev-admin",
    scopes_json: '["admin"]',
    sent: 20,
    failed: 21,
    attachments: 22,
    error_details: 23,
    created_at: "2024-01-05T00:00:00.000Z",
  });

  const insertJob = legacy.prepare(
    `INSERT INTO mail_jobs (
       id, config_id, token_id, idempotency_key, message_id, from_address, to_address,
       subject, html, text_body, headers_json, attachments_json, status, delivery_mode,
       retry_count, next_retry_at, last_error, error_category, error_permanent, error_code,
       provider_response_code, provider_message_id, created_at, updated_at, accepted_at,
       processing_started_at, sent_at, deleted_at
     ) VALUES (
       @id, 'config-1', @token_id, @idempotency_key, @message_id, 'from@example.com',
       'to@example.com', @subject, '<p>body</p>', 'body', '{}', '[]', @status, 'queue',
       0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, @created_at, @created_at, NULL, NULL,
       @sent_at, NULL
     )`,
  );
  insertJob.run({
    id: "job-app",
    token_id: "token-app-1",
    idempotency_key: "idem-app",
    message_id: "msg-app",
    subject: "Application job",
    status: "sent",
    created_at: "2024-01-06T00:00:00.000Z",
    sent_at: "2024-01-06T01:00:00.000Z",
  });
  insertJob.run({
    id: "job-admin",
    token_id: "token-admin-1",
    idempotency_key: "idem-admin",
    message_id: "msg-admin",
    subject: "Admin job",
    status: "queued",
    created_at: "2024-01-07T00:00:00.000Z",
    sent_at: null,
  });
  insertJob.run({
    id: "job-none",
    token_id: null,
    idempotency_key: null,
    message_id: "msg-none",
    subject: "Tokenless job",
    status: "queued",
    created_at: "2024-01-08T00:00:00.000Z",
    sent_at: null,
  });

  legacy.exec("PRAGMA user_version = 2");
  legacy.close();
}

// Builds an intermediate (user_version = 3) database that already has the split
// application/admin ownership tables but predates the incremental ALTER/UPDATE
// migrations: mail_jobs lacks the retention columns, smtp_configs lacks
// default_from_address, and the token tables lack client_id.
function createPreAlterDatabase(filePath) {
  const database = new BetterSqlite3(filePath);

  database.exec(`
    CREATE TABLE application_admins (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE applications (
      id TEXT PRIMARY KEY,
      application_admin_id TEXT REFERENCES application_admins(id) ON DELETE SET NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE smtp_configs (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL,
      password_encrypted TEXT,
      secure INTEGER NOT NULL,
      require_tls INTEGER NOT NULL,
      min_tls_version TEXT NOT NULL,
      connection_timeout_ms INTEGER NOT NULL,
      greeting_timeout_ms INTEGER NOT NULL,
      socket_timeout_ms INTEGER NOT NULL,
      disabled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE application_admin_tokens (
      id TEXT PRIMARY KEY,
      application_admin_id TEXT NOT NULL REFERENCES application_admins(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      hashed_token TEXT NOT NULL UNIQUE,
      token_preview TEXT NOT NULL,
      scopes_json TEXT NOT NULL,
      retain_sent_jobs_days INTEGER NOT NULL,
      retain_failed_jobs_days INTEGER NOT NULL,
      retain_attachments_days INTEGER NOT NULL,
      retain_error_details_days INTEGER NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE application_tokens (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      hashed_token TEXT NOT NULL UNIQUE,
      token_preview TEXT NOT NULL,
      scopes_json TEXT NOT NULL,
      retain_sent_jobs_days INTEGER NOT NULL,
      retain_failed_jobs_days INTEGER NOT NULL,
      retain_attachments_days INTEGER NOT NULL,
      retain_error_details_days INTEGER NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE mail_jobs (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
      config_id TEXT NOT NULL REFERENCES smtp_configs(id) ON DELETE RESTRICT,
      token_id TEXT,
      token_kind TEXT,
      idempotency_key TEXT,
      message_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      text_body TEXT NOT NULL,
      headers_json TEXT NOT NULL,
      attachments_json TEXT NOT NULL,
      status TEXT NOT NULL,
      delivery_mode TEXT NOT NULL,
      retry_count INTEGER NOT NULL,
      next_retry_at TEXT,
      last_error TEXT,
      error_category TEXT,
      error_permanent INTEGER,
      error_code TEXT,
      provider_response_code INTEGER,
      provider_message_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      accepted_at TEXT,
      processing_started_at TEXT,
      sent_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE job_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES mail_jobs(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  database
    .prepare(
      `INSERT INTO application_admins (id, label, created_at, updated_at)
       VALUES ('admin-2', 'Admin Two', '2024-02-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z')`,
    )
    .run();
  database
    .prepare(
      `INSERT INTO applications (id, application_admin_id, label, created_at, updated_at)
       VALUES ('app-2', 'admin-2', 'App Two', '2024-02-02T00:00:00.000Z', '2024-02-02T00:00:00.000Z')`,
    )
    .run();
  database
    .prepare(
      `INSERT INTO smtp_configs (
         id, application_id, name, host, port, username, password_encrypted, secure,
         require_tls, min_tls_version, connection_timeout_ms, greeting_timeout_ms,
         socket_timeout_ms, disabled_at, created_at, updated_at
       ) VALUES (
         'config-2', 'app-2', 'Primary', 'smtp.example.com', 587, 'cfg2@example.com',
         'enc-secret', 0, 1, 'TLSv1.1', 10000, 10000, 20000, NULL,
         '2024-02-03T00:00:00.000Z', '2024-02-03T00:00:00.000Z'
       )`,
    )
    .run();
  database
    .prepare(
      `INSERT INTO application_tokens (
         id, application_id, label, hashed_token, token_preview, scopes_json,
         retain_sent_jobs_days, retain_failed_jobs_days, retain_attachments_days,
         retain_error_details_days, last_used_at, revoked_at, created_at, updated_at
       ) VALUES (
         'token-app-2', 'app-2', 'App Token', 'hash-app-2', 'prev-app-2', '["mail:send"]',
         5, 6, 7, 8, NULL, NULL, '2024-02-04T00:00:00.000Z', '2024-02-04T00:00:00.000Z'
       )`,
    )
    .run();
  database
    .prepare(
      `INSERT INTO application_admin_tokens (
         id, application_admin_id, label, hashed_token, token_preview, scopes_json,
         retain_sent_jobs_days, retain_failed_jobs_days, retain_attachments_days,
         retain_error_details_days, last_used_at, revoked_at, created_at, updated_at
       ) VALUES (
         'token-admin-2', 'admin-2', 'Admin Token', 'hash-admin-2', 'prev-admin-2', '["admin"]',
         15, 16, 17, 18, NULL, NULL, '2024-02-05T00:00:00.000Z', '2024-02-05T00:00:00.000Z'
       )`,
    )
    .run();
  database
    .prepare(
      `INSERT INTO mail_jobs (
         id, application_id, config_id, token_id, token_kind, idempotency_key, message_id,
         from_address, to_address, subject, html, text_body, headers_json, attachments_json,
         status, delivery_mode, retry_count, next_retry_at, last_error, error_category,
         error_permanent, error_code, provider_response_code, provider_message_id,
         created_at, updated_at, accepted_at, processing_started_at, sent_at, deleted_at
       ) VALUES (
         'job-2', 'app-2', 'config-2', 'token-app-2', 'application', 'idem-2', 'msg-2',
         'from@example.com', 'to@example.com', 'Subject', '<p>body</p>', 'body', '{}', '[]',
         'sent', 'queue', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
         '2024-02-06T00:00:00.000Z', '2024-02-06T00:00:00.000Z', NULL, NULL,
         '2024-02-06T01:00:00.000Z', NULL
       )`,
    )
    .run();

  database.exec("PRAGMA user_version = 3");
  database.close();
}

// Builds a database that already reports the latest pre-v10 migration version but
// has a broken smtp_configs table: mail_jobs references smtp_configs(id), while
// smtp_configs.id is not actually a primary or unique key. SQLite accepts that
// schema but later DML against mail_jobs fails with "foreign key mismatch".
function createBrokenSmtpConfigPrimaryKeyDatabase(filePath) {
  const database = new BetterSqlite3(filePath);

  database.exec(`
    CREATE TABLE application_admins (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE applications (
      id TEXT PRIMARY KEY,
      application_admin_id TEXT REFERENCES application_admins(id) ON DELETE SET NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE smtp_configs (
      id TEXT NOT NULL,
      application_id TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL,
      default_from_address TEXT NOT NULL,
      password_encrypted TEXT,
      secure INTEGER NOT NULL,
      require_tls INTEGER NOT NULL,
      min_tls_version TEXT NOT NULL,
      connection_timeout_ms INTEGER NOT NULL,
      greeting_timeout_ms INTEGER NOT NULL,
      socket_timeout_ms INTEGER NOT NULL,
      send_rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
      disabled_at TEXT,
      locked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE mail_jobs (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
      config_id TEXT NOT NULL REFERENCES smtp_configs(id) ON DELETE RESTRICT,
      token_id TEXT,
      token_kind TEXT,
      idempotency_key TEXT,
      message_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      text_body TEXT NOT NULL,
      headers_json TEXT NOT NULL,
      attachments_json TEXT NOT NULL,
      retain_sent_jobs_days INTEGER NOT NULL DEFAULT 30,
      retain_failed_jobs_days INTEGER NOT NULL DEFAULT 30,
      retain_attachments_days INTEGER NOT NULL DEFAULT 30,
      retain_error_details_days INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL,
      delivery_mode TEXT NOT NULL,
      retry_count INTEGER NOT NULL,
      next_retry_at TEXT,
      last_error TEXT,
      error_category TEXT,
      error_permanent INTEGER,
      error_code TEXT,
      provider_response_code INTEGER,
      provider_message_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      accepted_at TEXT,
      processing_started_at TEXT,
      sent_at TEXT,
      deleted_at TEXT
    );

    INSERT INTO application_admins (id, label, created_at, updated_at)
    VALUES ('admin-broken', 'Admin Broken', '2024-03-01T00:00:00.000Z', '2024-03-01T00:00:00.000Z');

    INSERT INTO applications (id, application_admin_id, label, created_at, updated_at)
    VALUES ('app-broken', 'admin-broken', 'App Broken', '2024-03-02T00:00:00.000Z', '2024-03-02T00:00:00.000Z');

    INSERT INTO smtp_configs (
      id, application_id, name, host, port, username, default_from_address,
      password_encrypted, secure, require_tls, min_tls_version, connection_timeout_ms,
      greeting_timeout_ms, socket_timeout_ms, send_rate_limit_per_minute, disabled_at,
      locked_at, created_at, updated_at
    ) VALUES (
      'config-broken', 'app-broken', 'Primary', 'smtp.example.com', 587,
      'smtp@example.com', 'smtp@example.com', 'enc-secret', 0, 1, 'TLSv1.2',
      10000, 10000, 20000, 60, NULL, NULL,
      '2024-03-03T00:00:00.000Z', '2024-03-03T00:00:00.000Z'
    );

    PRAGMA user_version = 9;
  `);

  database.close();
}

describe("legacy schema migration (table rewrite)", () => {
  it("rewrites the legacy principals/access_tokens schema and reaches the current version", () => {
    createLegacyDatabase(databasePath);

    const database = getDatabase();

    expect(userVersion(database)).toBe(12);

    // The table-rewrite branch drops the legacy tables entirely.
    expect(tableExists(database, "principals")).toBe(false);
    expect(tableExists(database, "access_tokens")).toBe(false);

    // The current ownership tables exist after the rewrite.
    for (const tableName of [
      "application_admins",
      "applications",
      "application_tokens",
      "application_admin_tokens",
      "smtp_configs",
      "mail_jobs",
      "api_request_failures",
    ]) {
      expect(tableExists(database, tableName)).toBe(true);
    }
  });

  it("migrates principals into application_admins and applications", () => {
    createLegacyDatabase(databasePath);

    const database = getDatabase();

    const admins = database.prepare("SELECT id, label FROM application_admins").all();
    expect(admins).toEqual([{ id: "admin-1", label: "Admin One" }]);

    const application = database
      .prepare("SELECT id, application_admin_id, label FROM applications")
      .get();
    expect(application).toEqual({
      id: "app-1",
      application_admin_id: "admin-1",
      label: "App One",
    });
  });

  it("migrates access_tokens into application and admin token tables with client_id backfill", () => {
    createLegacyDatabase(databasePath);

    const database = getDatabase();

    const applicationToken = database
      .prepare(
        "SELECT id, application_id, client_id, hashed_token, scopes_json FROM application_tokens",
      )
      .get();
    expect(applicationToken).toEqual({
      id: "token-app-1",
      application_id: "app-1",
      client_id: "token-app-1",
      hashed_token: "hash-app",
      scopes_json: '["send"]',
    });

    const adminToken = database
      .prepare(
        "SELECT id, application_admin_id, client_id, hashed_token, scopes_json FROM application_admin_tokens",
      )
      .get();
    expect(adminToken).toEqual({
      id: "token-admin-1",
      application_admin_id: "admin-1",
      client_id: "token-admin-1",
      hashed_token: "hash-admin",
      scopes_json: '["manageApplications","manageTokens","readStatus","validate"]',
    });
  });

  it("backfills smtp_configs.application_id and default_from_address from the legacy config", () => {
    createLegacyDatabase(databasePath);

    const database = getDatabase();

    expect(columnNames(database, "smtp_configs")).toContain("application_id");
    expect(columnNames(database, "smtp_configs")).toContain("default_from_address");
    expect(columnNames(database, "smtp_configs")).toContain("locked_at");

    const config = database
      .prepare(
        "SELECT id, application_id, username, default_from_address, min_tls_version FROM smtp_configs",
      )
      .get();
    expect(config).toEqual({
      id: "config-1",
      application_id: "app-1",
      username: "smtp-user@example.com",
      default_from_address: "smtp-user@example.com",
      min_tls_version: "TLSv1.2",
    });
  });

  it("backfills mail_jobs application_id, token_kind and retention from the owning token", () => {
    createLegacyDatabase(databasePath);

    const database = getDatabase();

    const rows = database
      .prepare(
        `SELECT id, application_id, token_id, token_kind,
                retain_sent_jobs_days, retain_failed_jobs_days,
                retain_attachments_days, retain_error_details_days
         FROM mail_jobs ORDER BY id`,
      )
      .all();

    expect(rows).toEqual([
      {
        id: "job-admin",
        application_id: "app-1",
        token_id: "token-admin-1",
        token_kind: "applicationAdmin",
        retain_sent_jobs_days: 20,
        retain_failed_jobs_days: 21,
        retain_attachments_days: 22,
        retain_error_details_days: 23,
      },
      {
        id: "job-app",
        application_id: "app-1",
        token_id: "token-app-1",
        token_kind: "application",
        retain_sent_jobs_days: 10,
        retain_failed_jobs_days: 11,
        retain_attachments_days: 12,
        retain_error_details_days: 13,
      },
      {
        id: "job-none",
        application_id: "app-1",
        token_id: null,
        token_kind: null,
        retain_sent_jobs_days: 30,
        retain_failed_jobs_days: 30,
        retain_attachments_days: 30,
        retain_error_details_days: 30,
      },
    ]);
  });
});

describe("incremental ALTER/UPDATE migrations", () => {
  it("adds and backfills retention, default_from_address and client_id columns", () => {
    createPreAlterDatabase(databasePath);

    const database = getDatabase();

    expect(userVersion(database)).toBe(12);

    // Retention columns added to mail_jobs and backfilled from the owning token.
    const job = database
      .prepare(
        `SELECT retain_sent_jobs_days, retain_failed_jobs_days,
                retain_attachments_days, retain_error_details_days
         FROM mail_jobs WHERE id = 'job-2'`,
      )
      .get();
    expect(job).toEqual({
      retain_sent_jobs_days: 5,
      retain_failed_jobs_days: 6,
      retain_attachments_days: 7,
      retain_error_details_days: 8,
    });

    // default_from_address added and backfilled from username.
    const config = database
      .prepare(
        "SELECT default_from_address, min_tls_version, send_rate_limit_per_minute FROM smtp_configs WHERE id = 'config-2'",
      )
      .get();
    expect(config).toEqual({
      default_from_address: "cfg2@example.com",
      min_tls_version: "TLSv1.2",
      send_rate_limit_per_minute: 60,
    });

    // client_id added and backfilled with the token id.
    const applicationToken = database
      .prepare("SELECT client_id, scopes_json FROM application_tokens WHERE id = 'token-app-2'")
      .get();
    expect(applicationToken).toEqual({ client_id: "token-app-2", scopes_json: '["send"]' });

    const adminToken = database
      .prepare(
        "SELECT client_id, scopes_json FROM application_admin_tokens WHERE id = 'token-admin-2'",
      )
      .get();
    expect(adminToken).toEqual({
      client_id: "token-admin-2",
      scopes_json: '["manageApplications","manageTokens","readStatus","validate"]',
    });

    // locked_at column added by migrateLockedAtSchema.
    expect(columnNames(database, "smtp_configs")).toContain("locked_at");
    expect(columnNames(database, "smtp_configs")).toContain("send_rate_limit_per_minute");
  });

  it("creates unique client_id indexes on the token tables", () => {
    createPreAlterDatabase(databasePath);

    const database = getDatabase();

    const indexes = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((row) => row.name);

    expect(indexes).toContain("application_tokens_client_id");
    expect(indexes).toContain("application_admin_tokens_client_id");
  });
});

describe("no-op migration path", () => {
  it("leaves an already-current database at the current version without legacy tables", () => {
    // First open creates a fresh, fully-migrated database on disk.
    getDatabase();
    resetDatabase();

    // Second open must take the no-op path for every migration.
    const database = getDatabase();

    expect(userVersion(database)).toBe(12);
    expect(tableExists(database, "principals")).toBe(false);
    expect(tableExists(database, "access_tokens")).toBe(false);
    expect(tableExists(database, "applications")).toBe(true);
  });
});

describe("smtp config primary-key repair migration", () => {
  it("rebuilds smtp_configs when id is not a primary key", () => {
    createBrokenSmtpConfigPrimaryKeyDatabase(databasePath);

    const database = getDatabase();

    expect(userVersion(database)).toBe(12);
    expect(primaryKeyColumns(database, "smtp_configs")).toContain("id");
    expect(
      database
        .prepare("SELECT id, application_id FROM smtp_configs WHERE id = ?")
        .get("config-broken"),
    ).toEqual({
      id: "config-broken",
      application_id: "app-broken",
    });

    expect(() => {
      database
        .prepare(
          `INSERT INTO mail_jobs (
            id, application_id, config_id, token_id, token_kind, idempotency_key,
            message_id, from_address, to_address, subject, html, text_body, headers_json,
            attachments_json, retain_sent_jobs_days, retain_failed_jobs_days,
            retain_attachments_days, retain_error_details_days, status, delivery_mode,
            retry_count, next_retry_at, last_error, error_category, error_permanent,
            error_code, provider_response_code, provider_message_id, created_at, updated_at,
            accepted_at, processing_started_at, sent_at, deleted_at
          ) VALUES (
            'job-broken', 'app-broken', 'config-broken', NULL, NULL, NULL,
            'msg-broken', 'from@example.com', 'to@example.com', 'Subject', '<p>body</p>',
            'body', '{}', '[]', 30, 30, 30, 30, 'sent', 'queue', 0, NULL, NULL, NULL,
            NULL, NULL, NULL, NULL, '2024-03-04T00:00:00.000Z',
            '2024-03-04T00:00:00.000Z', NULL, NULL, '2024-03-04T01:00:00.000Z', NULL
          )`,
        )
        .run();
      database.prepare("DELETE FROM mail_jobs WHERE id = ?").run("job-broken");
    }).not.toThrow();
  });
});
