import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetDatabase } from "./db.ts";
import {
  checkDatabase,
  checkWorker,
  getActivity,
  getErrorsLastHour,
  getQueueCounts,
  getSmtpConfigStatus,
} from "./metrics.ts";

describe("metrics", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-metrics-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    process.env.MAILER_WORKER_INTERVAL_MS = "30000";
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    delete process.env.MAILER_WORKER_INTERVAL_MS;
    rmSync(tempDir, { force: true, recursive: true });
  });

  describe("checkDatabase()", () => {
    it("returns status healthy with non-negative latency and positive size when database is reachable", () => {
      const result = checkDatabase();

      expect(result.status).toBe("healthy");
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
      expect(result.size_bytes).toBeGreaterThan(0);
    });

    it("returns all required fields", () => {
      const result = checkDatabase();

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("latency_ms");
      expect(result).toHaveProperty("size_bytes");
    });
  });

  describe("checkWorker()", () => {
    it("returns status unhealthy when the worker has never run", () => {
      const result = checkWorker();

      expect(result.status).toBe("unhealthy");
    });

    it("returns null timestamps when the worker has never run", () => {
      const result = checkWorker();

      expect(result.last_tick_at).toBeNull();
      expect(result.last_tick_age_ms).toBeNull();
    });

    it("returns the configured interval_ms", () => {
      const result = checkWorker();

      expect(result.interval_ms).toBe(30_000);
    });
  });

  describe("getQueueCounts()", () => {
    it("returns all 8 statuses with count 0 when queue is empty", () => {
      const result = getQueueCounts();

      expect(result).toEqual({
        cancelled: 0,
        delivery_uncertain: 0,
        failed: 0,
        paused: 0,
        processing: 0,
        queued: 0,
        retry_scheduled: 0,
        sent: 0,
      });
    });

    it("returns exactly the 8 expected status keys", () => {
      const result = getQueueCounts();
      const keys = Object.keys(result).sort();

      expect(keys).toEqual([
        "cancelled",
        "delivery_uncertain",
        "failed",
        "paused",
        "processing",
        "queued",
        "retry_scheduled",
        "sent",
      ]);
    });
  });

  describe("getActivity()", () => {
    it("returns zero counts and null timestamps when database is empty", () => {
      const result = getActivity();

      expect(result).toEqual({
        failed_last_hour: 0,
        last_sent_at: null,
        oldest_pending_at: null,
        sent_last_hour: 0,
      });
    });

    it("returns all required fields", () => {
      const result = getActivity();

      expect(result).toHaveProperty("failed_last_hour");
      expect(result).toHaveProperty("last_sent_at");
      expect(result).toHaveProperty("oldest_pending_at");
      expect(result).toHaveProperty("sent_last_hour");
    });
  });

  describe("getSmtpConfigStatus()", () => {
    it("returns zeros for all counters when no SMTP configs exist", () => {
      const result = getSmtpConfigStatus();

      expect(result).toEqual({
        total: 0,
        active: 0,
        degraded: 0,
      });
    });

    it("returns all required fields", () => {
      const result = getSmtpConfigStatus();

      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("active");
      expect(result).toHaveProperty("degraded");
    });
  });

  describe("getErrorsLastHour()", () => {
    it("returns an empty object when no failed jobs exist", () => {
      const result = getErrorsLastHour();

      expect(result).toEqual({});
    });

    it("returns a plain object", () => {
      const result = getErrorsLastHour();

      expect(typeof result).toBe("object");
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(false);
    });
  });
});
