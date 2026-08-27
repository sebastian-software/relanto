import { afterEach, describe, expect, it } from "vitest";

import {
  getMailerDbPath,
  getMailerSecret,
  getMaxRequestBodyBytes,
  getRetentionIntervalMs,
  getSendMaxRequestBodyBytes,
  getSendRateLimitPerMinute,
  getTokenMaxRequestBodyBytes,
  getTokenRateLimitPerMinute,
} from "./env.ts";

const originalMailerDbPath = process.env.MAILER_DB_PATH;
const originalMailerSecretKey = process.env.MAILER_SECRET_KEY;
const originalNodeEnv = process.env.NODE_ENV;
const originalRetentionIntervalMs = process.env.MAILER_RETENTION_INTERVAL_MS;
const originalTokenRateLimit = process.env.MAILER_TOKEN_RATE_LIMIT_PER_MINUTE;
const originalSendRateLimit = process.env.MAILER_SEND_RATE_LIMIT_PER_MINUTE;
const originalMaxBodyBytes = process.env.MAILER_MAX_REQUEST_BODY_BYTES;
const originalSendMaxBodyBytes = process.env.MAILER_SEND_MAX_BODY_BYTES;
const originalTokenMaxBodyBytes = process.env.MAILER_TOKEN_MAX_BODY_BYTES;

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  process.env.MAILER_DB_PATH = originalMailerDbPath;
  process.env.MAILER_SECRET_KEY = originalMailerSecretKey;
  process.env.NODE_ENV = originalNodeEnv;

  restoreEnv("MAILER_RETENTION_INTERVAL_MS", originalRetentionIntervalMs);
  restoreEnv("MAILER_TOKEN_RATE_LIMIT_PER_MINUTE", originalTokenRateLimit);
  restoreEnv("MAILER_SEND_RATE_LIMIT_PER_MINUTE", originalSendRateLimit);
  restoreEnv("MAILER_MAX_REQUEST_BODY_BYTES", originalMaxBodyBytes);
  restoreEnv("MAILER_SEND_MAX_BODY_BYTES", originalSendMaxBodyBytes);
  restoreEnv("MAILER_TOKEN_MAX_BODY_BYTES", originalTokenMaxBodyBytes);
});

describe("getMailerDbPath", () => {
  it("allows the default SQLite path in local development", () => {
    delete process.env.MAILER_DB_PATH;
    process.env.NODE_ENV = "development";

    expect(getMailerDbPath()).toBe(`${process.cwd()}/tmp/mailer.sqlite`);
  });

  it("rejects a missing MAILER_DB_PATH outside local development", () => {
    delete process.env.MAILER_DB_PATH;
    process.env.NODE_ENV = "production";

    expect(() => getMailerDbPath()).toThrowError(
      "MAILER_DB_PATH is required outside local development. Configure a persistent path such as /var/lib/relanto/mailer.sqlite.",
    );
  });

  it("accepts an explicit MAILER_DB_PATH outside local development", () => {
    process.env.MAILER_DB_PATH = "/tmp/relanto-mailer.sqlite";
    process.env.NODE_ENV = "production";

    expect(getMailerDbPath()).toBe("/tmp/relanto-mailer.sqlite");
  });
});

describe("getMailerSecret", () => {
  it("rejects missing MAILER_SECRET_KEY", () => {
    delete process.env.MAILER_SECRET_KEY;

    expect(() => getMailerSecret()).toThrowError(
      "MAILER_SECRET_KEY is required and must be a strong random secret.",
    );
  });

  it("rejects short configured MAILER_SECRET_KEY", () => {
    process.env.MAILER_SECRET_KEY = "short-secret";

    expect(() => getMailerSecret()).toThrowError(
      "MAILER_SECRET_KEY must be at least 32 characters long.",
    );
  });

  it("rejects placeholder MAILER_SECRET_KEY values", () => {
    process.env.MAILER_SECRET_KEY = "__REPLACE_WITH_OPENSSL_RAND_HEX_32__";

    expect(() => getMailerSecret()).toThrowError(
      "MAILER_SECRET_KEY must not use a placeholder value. Generate a strong random secret.",
    );
  });

  it("accepts a strong random MAILER_SECRET_KEY", () => {
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";

    expect(getMailerSecret()).toBe("test-mailer-secret-with-at-least-32-chars");
  });
});

describe("getRetentionIntervalMs", () => {
  it("defaults to one hour when unset", () => {
    delete process.env.MAILER_RETENTION_INTERVAL_MS;

    expect(getRetentionIntervalMs()).toBe(3_600_000);
  });

  it("honours a configured interval", () => {
    process.env.MAILER_RETENTION_INTERVAL_MS = "60000";

    expect(getRetentionIntervalMs()).toBe(60_000);
  });

  it("falls back to the default for invalid or too-small values", () => {
    process.env.MAILER_RETENTION_INTERVAL_MS = "not-a-number";
    expect(getRetentionIntervalMs()).toBe(3_600_000);

    process.env.MAILER_RETENTION_INTERVAL_MS = "500";
    expect(getRetentionIntervalMs()).toBe(3_600_000);
  });
});

describe("getTokenRateLimitPerMinute", () => {
  it("defaults to 30 when unset", () => {
    delete process.env.MAILER_TOKEN_RATE_LIMIT_PER_MINUTE;

    expect(getTokenRateLimitPerMinute()).toBe(30);
  });

  it("honours a configured limit", () => {
    process.env.MAILER_TOKEN_RATE_LIMIT_PER_MINUTE = "10";

    expect(getTokenRateLimitPerMinute()).toBe(10);
  });

  it("falls back to the default for invalid or non-positive values", () => {
    process.env.MAILER_TOKEN_RATE_LIMIT_PER_MINUTE = "not-a-number";
    expect(getTokenRateLimitPerMinute()).toBe(30);

    process.env.MAILER_TOKEN_RATE_LIMIT_PER_MINUTE = "0";
    expect(getTokenRateLimitPerMinute()).toBe(30);

    process.env.MAILER_TOKEN_RATE_LIMIT_PER_MINUTE = "1.5";
    expect(getTokenRateLimitPerMinute()).toBe(30);
  });
});

describe("getSendRateLimitPerMinute", () => {
  it("defaults to 60 when unset", () => {
    delete process.env.MAILER_SEND_RATE_LIMIT_PER_MINUTE;

    expect(getSendRateLimitPerMinute()).toBe(60);
  });

  it("honours a configured limit", () => {
    process.env.MAILER_SEND_RATE_LIMIT_PER_MINUTE = "120";

    expect(getSendRateLimitPerMinute()).toBe(120);
  });

  it("falls back to the default for invalid or non-positive values", () => {
    process.env.MAILER_SEND_RATE_LIMIT_PER_MINUTE = "not-a-number";
    expect(getSendRateLimitPerMinute()).toBe(60);

    process.env.MAILER_SEND_RATE_LIMIT_PER_MINUTE = "0";
    expect(getSendRateLimitPerMinute()).toBe(60);
  });
});

describe("getMaxRequestBodyBytes", () => {
  it("defaults to 1 MiB when unset", () => {
    delete process.env.MAILER_MAX_REQUEST_BODY_BYTES;

    expect(getMaxRequestBodyBytes()).toBe(1_048_576);
  });

  it("honours a configured limit", () => {
    process.env.MAILER_MAX_REQUEST_BODY_BYTES = "4096";

    expect(getMaxRequestBodyBytes()).toBe(4096);
  });

  it("falls back to the default for invalid or non-positive values", () => {
    process.env.MAILER_MAX_REQUEST_BODY_BYTES = "not-a-number";
    expect(getMaxRequestBodyBytes()).toBe(1_048_576);

    process.env.MAILER_MAX_REQUEST_BODY_BYTES = "0";
    expect(getMaxRequestBodyBytes()).toBe(1_048_576);
  });
});

describe("getSendMaxRequestBodyBytes", () => {
  it("defaults to 30 MiB when unset", () => {
    delete process.env.MAILER_SEND_MAX_BODY_BYTES;

    expect(getSendMaxRequestBodyBytes()).toBe(31_457_280);
  });

  it("honours a configured limit", () => {
    process.env.MAILER_SEND_MAX_BODY_BYTES = "1000000";

    expect(getSendMaxRequestBodyBytes()).toBe(1_000_000);
  });

  it("falls back to the default for invalid or non-positive values", () => {
    process.env.MAILER_SEND_MAX_BODY_BYTES = "not-a-number";
    expect(getSendMaxRequestBodyBytes()).toBe(31_457_280);

    process.env.MAILER_SEND_MAX_BODY_BYTES = "0";
    expect(getSendMaxRequestBodyBytes()).toBe(31_457_280);
  });
});

describe("getTokenMaxRequestBodyBytes", () => {
  it("defaults to 32 KiB when unset", () => {
    delete process.env.MAILER_TOKEN_MAX_BODY_BYTES;

    expect(getTokenMaxRequestBodyBytes()).toBe(32_768);
  });

  it("honours a configured limit", () => {
    process.env.MAILER_TOKEN_MAX_BODY_BYTES = "16384";

    expect(getTokenMaxRequestBodyBytes()).toBe(16_384);
  });

  it("falls back to the default for invalid or non-positive values", () => {
    process.env.MAILER_TOKEN_MAX_BODY_BYTES = "not-a-number";
    expect(getTokenMaxRequestBodyBytes()).toBe(32_768);

    process.env.MAILER_TOKEN_MAX_BODY_BYTES = "0";
    expect(getTokenMaxRequestBodyBytes()).toBe(32_768);
  });
});
