/* cspell:ignore oxlint */
/* oxlint-disable no-magic-numbers -- Migration versions are historical SQLite schema constants. */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, max-lines, max-lines-per-function, unicorn/prevent-abbreviations -- Legacy SQLite schema and migrations stay together; better-sqlite3 returns untyped rows at the database boundary. */
import BetterSqlite3 from "better-sqlite3";

import { getMailerDbPath as getMailerDatabasePath, getSendRateLimitPerMinute } from "./env.js";

type DatabaseSync = InstanceType<typeof BetterSqlite3>;

let database: DatabaseSync | undefined;

function execute(databaseInstance: DatabaseSync, sql: string): void {
  databaseInstance.exec(sql);
}

function getUserVersion(databaseInstance: DatabaseSync): number {
  const result = databaseInstance.prepare("PRAGMA user_version").get() as
    | { user_version?: number }
    | undefined;

  return result?.user_version ?? 0;
}

function setUserVersion(databaseInstance: DatabaseSync, version: number): void {
  execute(databaseInstance, `PRAGMA user_version = ${version}`);
}

function tableExists(databaseInstance: DatabaseSync, tableName: string): boolean {
  const row = databaseInstance
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;

  return row?.name === tableName;
}

function hasColumn(databaseInstance: DatabaseSync, tableName: string, columnName: string): boolean {
  if (!tableExists(databaseInstance, tableName)) {
    return false;
  }

  const rows = databaseInstance.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name?: string;
  }>;

  return rows.some((row) => row.name === columnName);
}

function hasPrimaryKeyColumn(
  databaseInstance: DatabaseSync,
  tableName: string,
  columnName: string,
): boolean {
  if (!tableExists(databaseInstance, tableName)) {
    return false;
  }

  const rows = databaseInstance.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name?: string;
    pk?: number;
  }>;

  return rows.some((row) => row.name === columnName && (row.pk ?? 0) > 0);
}

function initializeSchema(databaseInstance: DatabaseSync): void {
  const sendRateLimitPerMinute = getSendRateLimitPerMinute();

  execute(
    databaseInstance,
    `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS application_admins (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        application_admin_id TEXT REFERENCES application_admins(id) ON DELETE SET NULL,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS smtp_configs (
        id TEXT PRIMARY KEY,
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
        send_rate_limit_per_minute INTEGER NOT NULL DEFAULT ${sendRateLimitPerMinute},
        disabled_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS application_admin_tokens (
        id TEXT PRIMARY KEY,
        application_admin_id TEXT NOT NULL REFERENCES application_admins(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL UNIQUE,
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

      CREATE TABLE IF NOT EXISTS application_tokens (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL UNIQUE,
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

      CREATE TABLE IF NOT EXISTS mail_jobs (
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

      CREATE UNIQUE INDEX IF NOT EXISTS mail_jobs_application_idempotency_key
      ON mail_jobs(application_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;

      CREATE TABLE IF NOT EXISTS job_events (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES mail_jobs(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_request_failures (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        http_status INTEGER NOT NULL,
        request_method TEXT NOT NULL,
        request_path TEXT NOT NULL,
        reason_category TEXT NOT NULL,
        reason_message TEXT NOT NULL,
        client_id TEXT,
        token_id TEXT,
        token_kind TEXT,
        application_id TEXT,
        details_json TEXT
      );

      CREATE INDEX IF NOT EXISTS api_request_failures_created_at
      ON api_request_failures(created_at);

      CREATE INDEX IF NOT EXISTS api_request_failures_application_created_at
      ON api_request_failures(application_id, created_at);

      CREATE INDEX IF NOT EXISTS api_request_failures_reason_created_at
      ON api_request_failures(reason_category, created_at);
    `,
  );
}

function migrateRetentionPolicySchema(databaseInstance: DatabaseSync): void {
  const userVersion = getUserVersion(databaseInstance);

  if (userVersion >= 4) {
    return;
  }

  if (!hasColumn(databaseInstance, "mail_jobs", "retain_sent_jobs_days")) {
    execute(
      databaseInstance,
      "ALTER TABLE mail_jobs ADD COLUMN retain_sent_jobs_days INTEGER NOT NULL DEFAULT 30",
    );
  }

  if (!hasColumn(databaseInstance, "mail_jobs", "retain_failed_jobs_days")) {
    execute(
      databaseInstance,
      "ALTER TABLE mail_jobs ADD COLUMN retain_failed_jobs_days INTEGER NOT NULL DEFAULT 30",
    );
  }

  if (!hasColumn(databaseInstance, "mail_jobs", "retain_attachments_days")) {
    execute(
      databaseInstance,
      "ALTER TABLE mail_jobs ADD COLUMN retain_attachments_days INTEGER NOT NULL DEFAULT 30",
    );
  }

  if (!hasColumn(databaseInstance, "mail_jobs", "retain_error_details_days")) {
    execute(
      databaseInstance,
      "ALTER TABLE mail_jobs ADD COLUMN retain_error_details_days INTEGER NOT NULL DEFAULT 30",
    );
  }

  execute(
    databaseInstance,
    `
      UPDATE mail_jobs
      SET
        retain_sent_jobs_days = COALESCE(
          (
            SELECT application_tokens.retain_sent_jobs_days
            FROM application_tokens
            WHERE mail_jobs.token_kind = 'application'
              AND application_tokens.id = mail_jobs.token_id
          ),
          (
            SELECT application_admin_tokens.retain_sent_jobs_days
            FROM application_admin_tokens
            WHERE mail_jobs.token_kind = 'applicationAdmin'
              AND application_admin_tokens.id = mail_jobs.token_id
          ),
          retain_sent_jobs_days
        ),
        retain_failed_jobs_days = COALESCE(
          (
            SELECT application_tokens.retain_failed_jobs_days
            FROM application_tokens
            WHERE mail_jobs.token_kind = 'application'
              AND application_tokens.id = mail_jobs.token_id
          ),
          (
            SELECT application_admin_tokens.retain_failed_jobs_days
            FROM application_admin_tokens
            WHERE mail_jobs.token_kind = 'applicationAdmin'
              AND application_admin_tokens.id = mail_jobs.token_id
          ),
          retain_failed_jobs_days
        ),
        retain_attachments_days = COALESCE(
          (
            SELECT application_tokens.retain_attachments_days
            FROM application_tokens
            WHERE mail_jobs.token_kind = 'application'
              AND application_tokens.id = mail_jobs.token_id
          ),
          (
            SELECT application_admin_tokens.retain_attachments_days
            FROM application_admin_tokens
            WHERE mail_jobs.token_kind = 'applicationAdmin'
              AND application_admin_tokens.id = mail_jobs.token_id
          ),
          retain_attachments_days
        ),
        retain_error_details_days = COALESCE(
          (
            SELECT application_tokens.retain_error_details_days
            FROM application_tokens
            WHERE mail_jobs.token_kind = 'application'
              AND application_tokens.id = mail_jobs.token_id
          ),
          (
            SELECT application_admin_tokens.retain_error_details_days
            FROM application_admin_tokens
            WHERE mail_jobs.token_kind = 'applicationAdmin'
              AND application_admin_tokens.id = mail_jobs.token_id
          ),
          retain_error_details_days
        )
    `,
  );

  setUserVersion(databaseInstance, 4);
}

function migrateDefaultFromAddressSchema(databaseInstance: DatabaseSync): void {
  const userVersion = getUserVersion(databaseInstance);

  if (userVersion >= 5) {
    return;
  }

  if (!hasColumn(databaseInstance, "smtp_configs", "default_from_address")) {
    execute(
      databaseInstance,
      "ALTER TABLE smtp_configs ADD COLUMN default_from_address TEXT NOT NULL DEFAULT ''",
    );
  }

  execute(
    databaseInstance,
    `
      UPDATE smtp_configs
      SET default_from_address = username
      WHERE TRIM(COALESCE(default_from_address, '')) = ''
    `,
  );

  setUserVersion(databaseInstance, 5);
}

function migrateClientCredentialsSchema(databaseInstance: DatabaseSync): void {
  const userVersion = getUserVersion(databaseInstance);

  if (userVersion >= 6) {
    return;
  }

  if (!hasColumn(databaseInstance, "application_tokens", "client_id")) {
    execute(
      databaseInstance,
      "ALTER TABLE application_tokens ADD COLUMN client_id TEXT NOT NULL DEFAULT ''",
    );
  }

  if (!hasColumn(databaseInstance, "application_admin_tokens", "client_id")) {
    execute(
      databaseInstance,
      "ALTER TABLE application_admin_tokens ADD COLUMN client_id TEXT NOT NULL DEFAULT ''",
    );
  }

  execute(
    databaseInstance,
    `
      UPDATE application_tokens
      SET client_id = id
      WHERE TRIM(COALESCE(client_id, '')) = ''
    `,
  );

  execute(
    databaseInstance,
    `
      UPDATE application_admin_tokens
      SET client_id = id
      WHERE TRIM(COALESCE(client_id, '')) = ''
    `,
  );

  execute(
    databaseInstance,
    "CREATE UNIQUE INDEX IF NOT EXISTS application_tokens_client_id ON application_tokens(client_id)",
  );
  execute(
    databaseInstance,
    "CREATE UNIQUE INDEX IF NOT EXISTS application_admin_tokens_client_id ON application_admin_tokens(client_id)",
  );

  setUserVersion(databaseInstance, 6);
}

function migrateLockedAtSchema(databaseInstance: DatabaseSync): void {
  if (!hasColumn(databaseInstance, "smtp_configs", "locked_at")) {
    execute(databaseInstance, "ALTER TABLE smtp_configs ADD COLUMN locked_at TEXT");
  }
}

function migrateApiRequestFailuresSchema(databaseInstance: DatabaseSync): void {
  const userVersion = getUserVersion(databaseInstance);

  if (userVersion >= 7) {
    return;
  }

  if (!tableExists(databaseInstance, "api_request_failures")) {
    execute(
      databaseInstance,
      `
        CREATE TABLE api_request_failures (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          http_status INTEGER NOT NULL,
          request_method TEXT NOT NULL,
          request_path TEXT NOT NULL,
          reason_category TEXT NOT NULL,
          reason_message TEXT NOT NULL,
          client_id TEXT,
          token_id TEXT,
          token_kind TEXT,
          application_id TEXT,
          details_json TEXT
        );

        CREATE INDEX IF NOT EXISTS api_request_failures_created_at
        ON api_request_failures(created_at);

        CREATE INDEX IF NOT EXISTS api_request_failures_application_created_at
        ON api_request_failures(application_id, created_at);

        CREATE INDEX IF NOT EXISTS api_request_failures_reason_created_at
        ON api_request_failures(reason_category, created_at);
      `,
    );
  }

  setUserVersion(databaseInstance, 7);
}

function migrateMailJobsIndexesSchema(databaseInstance: DatabaseSync): void {
  const userVersion = getUserVersion(databaseInstance);

  if (userVersion >= 8) {
    return;
  }

  execute(
    databaseInstance,
    `
      -- Claim query (claimNextDueJob), queue counts (getQueueCounts) and the
      -- oldest-pending lookup (getActivity) filter on status with deleted_at IS NULL
      -- and order by created_at.
      CREATE INDEX IF NOT EXISTS mail_jobs_status_created_at
      ON mail_jobs(status, created_at)
      WHERE deleted_at IS NULL;

      -- Failure metrics (getActivity failed count, getErrorsLastHour) filter on
      -- status with an updated_at lower bound and deleted_at IS NULL.
      CREATE INDEX IF NOT EXISTS mail_jobs_status_updated_at
      ON mail_jobs(status, updated_at)
      WHERE deleted_at IS NULL;

      -- listJobs / listJobStatusViews filter by application_id and order by created_at.
      CREATE INDEX IF NOT EXISTS mail_jobs_application_created_at
      ON mail_jobs(application_id, created_at);

      -- listJobs / listJobStatusViews look up jobs by message_id.
      CREATE INDEX IF NOT EXISTS mail_jobs_message_id
      ON mail_jobs(message_id);
    `,
  );

  setUserVersion(databaseInstance, 8);
}

function migrateSmtpConfigSendRateLimitSchema(databaseInstance: DatabaseSync): void {
  const userVersion = getUserVersion(databaseInstance);

  if (userVersion >= 9) {
    return;
  }

  if (!hasColumn(databaseInstance, "smtp_configs", "send_rate_limit_per_minute")) {
    execute(
      databaseInstance,
      `ALTER TABLE smtp_configs
       ADD COLUMN send_rate_limit_per_minute INTEGER NOT NULL DEFAULT ${getSendRateLimitPerMinute()}`,
    );
  }

  setUserVersion(databaseInstance, 9);
}

function migrateSmtpConfigsPrimaryKeySchema(databaseInstance: DatabaseSync): void {
  const userVersion = getUserVersion(databaseInstance);

  if (userVersion >= 10) {
    return;
  }

  if (hasPrimaryKeyColumn(databaseInstance, "smtp_configs", "id")) {
    setUserVersion(databaseInstance, 10);
    return;
  }

  execute(
    databaseInstance,
    `
      PRAGMA foreign_keys = OFF;
      BEGIN;

      DROP TABLE IF EXISTS smtp_configs_v10;
      CREATE TABLE smtp_configs_v10 (
        id TEXT PRIMARY KEY,
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
        send_rate_limit_per_minute INTEGER NOT NULL DEFAULT ${getSendRateLimitPerMinute()},
        disabled_at TEXT,
        locked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO smtp_configs_v10 (
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
        locked_at,
        created_at,
        updated_at
      )
      SELECT
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
        locked_at,
        created_at,
        updated_at
      FROM smtp_configs;

      DROP TABLE smtp_configs;
      ALTER TABLE smtp_configs_v10 RENAME TO smtp_configs;

      COMMIT;
      PRAGMA foreign_keys = ON;
    `,
  );

  setUserVersion(databaseInstance, 10);
}

function migrateLegacyTokenScopesSchema(databaseInstance: DatabaseSync): void {
  const userVersion = getUserVersion(databaseInstance);

  if (userVersion >= 11) {
    return;
  }

  if (tableExists(databaseInstance, "application_tokens")) {
    execute(
      databaseInstance,
      `
        UPDATE application_tokens
        SET scopes_json = '["send"]'
        WHERE scopes_json = '["mail:send"]'
      `,
    );
  }

  if (tableExists(databaseInstance, "application_admin_tokens")) {
    execute(
      databaseInstance,
      `
        UPDATE application_admin_tokens
        SET scopes_json = '["manageApplications","manageTokens","readStatus","validate"]'
        WHERE scopes_json = '["admin"]'
      `,
    );
  }

  setUserVersion(databaseInstance, 11);
}

function migrateLegacyTlsVersionSchema(databaseInstance: DatabaseSync): void {
  const userVersion = getUserVersion(databaseInstance);

  if (userVersion >= 12) {
    return;
  }

  if (tableExists(databaseInstance, "smtp_configs")) {
    execute(
      databaseInstance,
      `
        UPDATE smtp_configs
        SET min_tls_version = 'TLSv1.2'
        WHERE min_tls_version NOT IN ('TLSv1.2', 'TLSv1.3')
      `,
    );
  }

  setUserVersion(databaseInstance, 12);
}

function migrateLegacySchema(databaseInstance: DatabaseSync): void {
  const userVersion = getUserVersion(databaseInstance);

  if (userVersion >= 3) {
    return;
  }

  const needsLegacyMigration =
    tableExists(databaseInstance, "principals") ||
    (tableExists(databaseInstance, "smtp_configs") &&
      !hasColumn(databaseInstance, "smtp_configs", "application_id")) ||
    (tableExists(databaseInstance, "mail_jobs") &&
      !hasColumn(databaseInstance, "mail_jobs", "application_id"));

  if (!needsLegacyMigration) {
    setUserVersion(databaseInstance, 3);
    return;
  }

  execute(
    databaseInstance,
    `
      PRAGMA foreign_keys = OFF;
      BEGIN;

      CREATE TABLE IF NOT EXISTS application_admins (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        application_admin_id TEXT REFERENCES application_admins(id) ON DELETE SET NULL,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS application_admin_tokens (
        id TEXT PRIMARY KEY,
        application_admin_id TEXT NOT NULL REFERENCES application_admins(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL UNIQUE,
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

      CREATE TABLE IF NOT EXISTS application_tokens (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL UNIQUE,
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

      INSERT OR IGNORE INTO application_admins (id, label, created_at, updated_at)
      SELECT id, label, created_at, updated_at
      FROM principals
      WHERE type = 'applicationAdmin';

      INSERT OR IGNORE INTO applications (id, application_admin_id, label, created_at, updated_at)
      SELECT
        application_principal.id,
        COALESCE(
          (
            SELECT admin_principal.id
            FROM access_tokens admin_token
            INNER JOIN principals admin_principal ON admin_principal.id = admin_token.principal_id
            WHERE admin_principal.type = 'applicationAdmin'
              AND admin_token.config_id = app_token.config_id
            ORDER BY admin_token.created_at ASC
            LIMIT 1
          ),
          (
            SELECT admin_principal.id
            FROM principals admin_principal
            WHERE admin_principal.type = 'applicationAdmin'
            ORDER BY admin_principal.created_at ASC
            LIMIT 1
          )
        ),
        application_principal.label,
        application_principal.created_at,
        application_principal.updated_at
      FROM principals application_principal
      LEFT JOIN access_tokens app_token
        ON app_token.principal_id = application_principal.id
      WHERE application_principal.type = 'application';

      DROP TABLE IF EXISTS smtp_configs_v3;
      CREATE TABLE smtp_configs_v3 (
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

      INSERT INTO smtp_configs_v3 (
        id,
        application_id,
        name,
        host,
        port,
        username,
        password_encrypted,
        secure,
        require_tls,
        min_tls_version,
        connection_timeout_ms,
        greeting_timeout_ms,
        socket_timeout_ms,
        disabled_at,
        created_at,
        updated_at
      )
      SELECT
        smtp_configs.id,
        application_principal.id,
        smtp_configs.name,
        smtp_configs.host,
        smtp_configs.port,
        smtp_configs.username,
        smtp_configs.password_encrypted,
        smtp_configs.secure,
        smtp_configs.require_tls,
        smtp_configs.min_tls_version,
        smtp_configs.connection_timeout_ms,
        smtp_configs.greeting_timeout_ms,
        smtp_configs.socket_timeout_ms,
        smtp_configs.disabled_at,
        smtp_configs.created_at,
        smtp_configs.updated_at
      FROM smtp_configs
      INNER JOIN (
        SELECT principal_id, MIN(created_at) AS created_at, config_id
        FROM access_tokens
        GROUP BY principal_id, config_id
      ) token_map ON token_map.config_id = smtp_configs.id
      INNER JOIN principals application_principal
        ON application_principal.id = token_map.principal_id
       AND application_principal.type = 'application';

      DROP TABLE smtp_configs;
      ALTER TABLE smtp_configs_v3 RENAME TO smtp_configs;

      INSERT OR IGNORE INTO application_tokens (
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
        last_used_at,
        revoked_at,
        created_at,
        updated_at
      )
      SELECT
        access_tokens.id,
        access_tokens.principal_id,
        access_tokens.id,
        access_tokens.label,
        access_tokens.hashed_token,
        access_tokens.token_preview,
        access_tokens.scopes_json,
        access_tokens.retain_sent_jobs_days,
        access_tokens.retain_failed_jobs_days,
        access_tokens.retain_attachments_days,
        access_tokens.retain_error_details_days,
        access_tokens.last_used_at,
        access_tokens.revoked_at,
        access_tokens.created_at,
        access_tokens.updated_at
      FROM access_tokens
      INNER JOIN principals ON principals.id = access_tokens.principal_id
      WHERE principals.type = 'application';

      INSERT OR IGNORE INTO application_admin_tokens (
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
        last_used_at,
        revoked_at,
        created_at,
        updated_at
      )
      SELECT
        access_tokens.id,
        access_tokens.principal_id,
        access_tokens.id,
        access_tokens.label,
        access_tokens.hashed_token,
        access_tokens.token_preview,
        access_tokens.scopes_json,
        access_tokens.retain_sent_jobs_days,
        access_tokens.retain_failed_jobs_days,
        access_tokens.retain_attachments_days,
        access_tokens.retain_error_details_days,
        access_tokens.last_used_at,
        access_tokens.revoked_at,
        access_tokens.created_at,
        access_tokens.updated_at
      FROM access_tokens
      INNER JOIN principals ON principals.id = access_tokens.principal_id
      WHERE principals.type = 'applicationAdmin';

      DROP TABLE IF EXISTS mail_jobs_v3;
      CREATE TABLE mail_jobs_v3 (
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

      INSERT INTO mail_jobs_v3 (
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
      )
      SELECT
        legacy_jobs.id,
        COALESCE(app_tokens.application_id, apps_by_config.id),
        legacy_jobs.config_id,
        legacy_jobs.token_id,
        CASE
          WHEN app_tokens.id IS NOT NULL THEN 'application'
          WHEN admin_tokens.id IS NOT NULL THEN 'applicationAdmin'
          ELSE NULL
        END,
        legacy_jobs.idempotency_key,
        legacy_jobs.message_id,
        legacy_jobs.from_address,
        legacy_jobs.to_address,
        legacy_jobs.subject,
        legacy_jobs.html,
        legacy_jobs.text_body,
        legacy_jobs.headers_json,
        legacy_jobs.attachments_json,
        legacy_jobs.status,
        legacy_jobs.delivery_mode,
        legacy_jobs.retry_count,
        legacy_jobs.next_retry_at,
        legacy_jobs.last_error,
        legacy_jobs.error_category,
        legacy_jobs.error_permanent,
        legacy_jobs.error_code,
        legacy_jobs.provider_response_code,
        legacy_jobs.provider_message_id,
        legacy_jobs.created_at,
        legacy_jobs.updated_at,
        legacy_jobs.accepted_at,
        legacy_jobs.processing_started_at,
        legacy_jobs.sent_at,
        legacy_jobs.deleted_at
      FROM mail_jobs legacy_jobs
      LEFT JOIN application_tokens app_tokens ON app_tokens.id = legacy_jobs.token_id
      LEFT JOIN application_admin_tokens admin_tokens ON admin_tokens.id = legacy_jobs.token_id
      LEFT JOIN applications apps_by_config ON apps_by_config.id = (
        SELECT application_id FROM smtp_configs WHERE smtp_configs.id = legacy_jobs.config_id
      );

      DROP TABLE mail_jobs;
      ALTER TABLE mail_jobs_v3 RENAME TO mail_jobs;

      DROP INDEX IF EXISTS mail_jobs_config_idempotency_key;
      CREATE UNIQUE INDEX IF NOT EXISTS mail_jobs_application_idempotency_key
      ON mail_jobs(application_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL;

      DROP TABLE access_tokens;
      DROP TABLE principals;

      COMMIT;
      PRAGMA foreign_keys = ON;
    `,
  );

  setUserVersion(databaseInstance, 3);
}

/**
 * Applies connection-level PRAGMAs that harden concurrency and crash behavior.
 *
 * - `journal_mode = WAL` enables the write-ahead log for better concurrency and
 *   more robust crash recovery. It returns the resulting mode as a value.
 * - `busy_timeout = 5000` makes a busy connection wait up to 5 seconds for a lock
 *   instead of failing immediately with `SQLITE_BUSY`.
 * - `synchronous = NORMAL` is the recommended durability level when using WAL.
 *
 * @param databaseInstance - The freshly opened SQLite connection to configure.
 */
function configureConnection(databaseInstance: DatabaseSync): void {
  databaseInstance.pragma("journal_mode = WAL");
  databaseInstance.pragma("busy_timeout = 5000");
  databaseInstance.pragma("synchronous = NORMAL");
}

function migrateDatabase(databaseInstance: DatabaseSync): void {
  migrateLegacySchema(databaseInstance);
  initializeSchema(databaseInstance);
  migrateRetentionPolicySchema(databaseInstance);
  migrateDefaultFromAddressSchema(databaseInstance);
  migrateClientCredentialsSchema(databaseInstance);
  migrateLockedAtSchema(databaseInstance);
  migrateApiRequestFailuresSchema(databaseInstance);
  migrateMailJobsIndexesSchema(databaseInstance);
  migrateSmtpConfigSendRateLimitSchema(databaseInstance);
  migrateSmtpConfigsPrimaryKeySchema(databaseInstance);
  migrateLegacyTokenScopesSchema(databaseInstance);
  migrateLegacyTlsVersionSchema(databaseInstance);
}

export function getDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  database = new BetterSqlite3(getMailerDatabasePath());
  configureConnection(database);
  migrateDatabase(database);

  return database;
}

export function closeDatabase(): void {
  if (!database) {
    return;
  }

  database.close();
  database = undefined;
}

export function resetDatabase(): void {
  closeDatabase();
}
