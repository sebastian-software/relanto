/* cspell:ignore oxlint */
/* oxlint-disable no-magic-numbers -- Metrics use fixed percentage and time-unit conversions. */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, security/detect-non-literal-fs-filename -- Metrics queries read aggregate SQLite rows and the database path is externally configured by deployment. */
import { statSync } from "node:fs";

import { getDatabase } from "./db.js";
import { getMailerDbPath as getMailerDatabasePath, getWorkerIntervalMs } from "./env.js";
import { getLastTickAt } from "./worker.js";

export function checkDatabase(): {
  latency_ms: number;
  size_bytes: null | number;
  status: "healthy" | "unhealthy";
} {
  let latencyMs = 0;
  let healthy = false;

  try {
    const start = performance.now();
    const database = getDatabase();
    database.prepare("SELECT 1 AS ok").get();
    latencyMs = Math.round((performance.now() - start) * 100) / 100;
    healthy = true;
  } catch {
    // Datenbank nicht erreichbar
  }

  let sizeBytes: null | number = null;

  try {
    const stat = statSync(getMailerDatabasePath());
    sizeBytes = stat.size;
  } catch {
    // Datei nicht erreichbar – size bleibt null
  }

  return {
    latency_ms: latencyMs,
    size_bytes: sizeBytes,
    status: healthy ? "healthy" : "unhealthy",
  };
}

export function checkWorker(): {
  interval_ms: number;
  last_tick_age_ms: null | number;
  last_tick_at: null | string;
  status: "healthy" | "unhealthy";
} {
  const intervalMs = getWorkerIntervalMs();
  const lastTick = getLastTickAt();

  if (lastTick === undefined) {
    return {
      interval_ms: intervalMs,
      last_tick_age_ms: null,
      last_tick_at: null,
      status: "unhealthy",
    };
  }

  const ageMs = Date.now() - lastTick;
  const status = ageMs <= intervalMs * 2 ? "healthy" : "unhealthy";

  return {
    interval_ms: intervalMs,
    last_tick_age_ms: ageMs,
    last_tick_at: new Date(lastTick).toISOString(),
    status,
  };
}

export function getQueueCounts(): Record<string, number> {
  const counts: Record<string, number> = {
    cancelled: 0,
    delivery_uncertain: 0,
    failed: 0,
    paused: 0,
    processing: 0,
    queued: 0,
    retry_scheduled: 0,
    sent: 0,
  };

  const database = getDatabase();
  const rows = database
    .prepare(
      "SELECT status, COUNT(*) AS count FROM mail_jobs WHERE deleted_at IS NULL GROUP BY status",
    )
    .all() as Array<{ count: number; status: string }>;

  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status] = row.count;
    }
  }

  return counts;
}

export function getActivity(): {
  failed_last_hour: number;
  last_sent_at: null | string;
  oldest_pending_at: null | string;
  sent_last_hour: number;
} {
  const database = getDatabase();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const lastSent = database
    .prepare(
      "SELECT sent_at AS ts FROM mail_jobs WHERE status = 'sent' AND deleted_at IS NULL ORDER BY sent_at DESC LIMIT 1",
    )
    .get() as { ts: null | string } | undefined;

  const sentCount = database
    .prepare(
      "SELECT COUNT(*) AS count FROM mail_jobs WHERE status = 'sent' AND sent_at >= ? AND deleted_at IS NULL",
    )
    .get(oneHourAgo) as { count: number };

  const failedCount = database
    .prepare(
      "SELECT COUNT(*) AS count FROM mail_jobs WHERE status = 'failed' AND updated_at >= ? AND deleted_at IS NULL",
    )
    .get(oneHourAgo) as { count: number };

  const oldestPending = database
    .prepare(
      "SELECT created_at AS ts FROM mail_jobs WHERE status IN ('queued','paused','retry_scheduled') AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1",
    )
    .get() as { ts: null | string } | undefined;

  return {
    failed_last_hour: failedCount.count,
    last_sent_at: lastSent?.ts ?? null,
    oldest_pending_at: oldestPending?.ts ?? null,
    sent_last_hour: sentCount.count,
  };
}

export function getSmtpConfigStatus(): {
  active: number;
  degraded: number;
  total: number;
} {
  const database = getDatabase();

  const row = database
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN disabled_at IS NULL AND locked_at IS NULL THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN disabled_at IS NOT NULL OR locked_at IS NOT NULL THEN 1 ELSE 0 END) AS degraded
      FROM smtp_configs`,
    )
    .get() as { active: null | number; degraded: null | number; total: number };

  return {
    active: row.active ?? 0,
    degraded: row.degraded ?? 0,
    total: row.total,
  };
}

export function getErrorsLastHour(): Record<string, number> {
  const database = getDatabase();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const rows = database
    .prepare(
      `SELECT error_category, COUNT(*) AS count
      FROM mail_jobs
      WHERE status = 'failed' AND updated_at >= ? AND deleted_at IS NULL AND error_category IS NOT NULL
      GROUP BY error_category`,
    )
    .all(oneHourAgo) as Array<{ count: number; error_category: string }>;

  const result: Record<string, number> = {};

  for (const row of rows) {
    if (row.count > 0) {
      result[row.error_category] = row.count;
    }
  }

  return result;
}
