/* cspell:ignore oxlint */
/* oxlint-disable no-magic-numbers, unicorn/numeric-separators-style, unicorn/prefer-spread -- Defaults and numeric parsing stay close to process.env handling. */
/* eslint-disable @typescript-eslint/strict-boolean-expressions, security/detect-non-literal-fs-filename, unicorn/prevent-abbreviations -- Environment variables and configured database paths are process-boundary inputs; exported names match existing MAILER_DB terminology. */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const MINIMUM_SECRET_LENGTH = 32;
const PLACEHOLDER_MARKERS = [
  "replace",
  "changeme",
  "placeholder",
  "example",
  "generate",
  "developmentonlysecretchangeme",
  "developmentonlysessionsecretchangeme",
];

function isLocalDevelopmentMode(): boolean {
  return process.env.NODE_ENV === "development";
}

export function assertMailerDbPathConfigured(): void {
  if (!process.env.MAILER_DB_PATH && !isLocalDevelopmentMode()) {
    throw new Error(
      "MAILER_DB_PATH is required outside local development. Configure a persistent path such as /var/lib/relanto/mailer.sqlite.",
    );
  }
}

export function getMailerDbPath(): string {
  assertMailerDbPathConfigured();

  const configured = process.env.MAILER_DB_PATH;
  const filePath = configured
    ? resolve(configured)
    : resolve(process.cwd(), "tmp", "mailer.sqlite");

  mkdirSync(dirname(filePath), { recursive: true });

  return filePath;
}

function isAsciiLetterOrDigit(character: string): boolean {
  return (character >= "a" && character <= "z") || (character >= "0" && character <= "9");
}

function looksLikePlaceholderSecret(secret: string): boolean {
  const normalized = Array.from(secret.trim().toLowerCase())
    .filter((character) => isAsciiLetterOrDigit(character))
    .join("");
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

export function getMailerSecret(): string {
  const configured = process.env.MAILER_SECRET_KEY?.trim();

  if (!configured) {
    throw new Error("MAILER_SECRET_KEY is required and must be a strong random secret.");
  }

  if (configured.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("MAILER_SECRET_KEY must be at least 32 characters long.");
  }

  if (looksLikePlaceholderSecret(configured)) {
    throw new Error(
      "MAILER_SECRET_KEY must not use a placeholder value. Generate a strong random secret.",
    );
  }

  return configured;
}

export function getWorkerIntervalMs(): number {
  const raw = process.env.MAILER_WORKER_INTERVAL_MS;
  const parsed = raw ? Number(raw) : 2_500;

  if (!Number.isFinite(parsed) || parsed < 250) {
    return 2_500;
  }

  return parsed;
}

export function getRetentionIntervalMs(): number {
  const raw = process.env.MAILER_RETENTION_INTERVAL_MS;
  const parsed = raw ? Number(raw) : 3_600_000;

  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return 3_600_000;
  }

  return parsed;
}

export function getProcessingTimeoutMs(): number {
  const raw = process.env.MAILER_PROCESSING_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : 120_000;

  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return 120_000;
  }

  return parsed;
}

export function getShutdownTimeoutMs(): number {
  const raw = process.env.MAILER_SHUTDOWN_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : 10_000;

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 10_000;
  }

  return parsed;
}

export function getTokenRateLimitPerMinute(): number {
  const raw = process.env.MAILER_TOKEN_RATE_LIMIT_PER_MINUTE?.trim();
  const parsed = raw ? Number(raw) : 30;

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return 30;
  }

  return parsed;
}

export function getSendRateLimitPerMinute(): number {
  const raw = process.env.MAILER_SEND_RATE_LIMIT_PER_MINUTE?.trim();
  const parsed = raw ? Number(raw) : 60;

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return 60;
  }

  return parsed;
}

/**
 * Maximum accepted request body size (in bytes) for the generic API routes
 * (SMTP config and token-scope endpoints). Guards `request.json()` against
 * buffering unbounded payloads. Defaults to 1 MiB.
 *
 * @returns The configured maximum body size in bytes.
 */
export function getMaxRequestBodyBytes(): number {
  const raw = process.env.MAILER_MAX_REQUEST_BODY_BYTES?.trim();
  const parsed = raw ? Number(raw) : 1_048_576;

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return 1_048_576;
  }

  return parsed;
}

/**
 * Maximum accepted request body size (in bytes) for `POST /api/v1/send`.
 * Sized generously to fit the base64-encoded attachment ceiling (~27 MB for a
 * 20 MB decoded total plus envelope fields). Defaults to 30 MiB.
 *
 * @returns The configured maximum body size in bytes.
 */
export function getSendMaxRequestBodyBytes(): number {
  const raw = process.env.MAILER_SEND_MAX_BODY_BYTES?.trim();
  const parsed = raw ? Number(raw) : 31_457_280;

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return 31_457_280;
  }

  return parsed;
}

/**
 * Maximum accepted request body size (in bytes) for `POST /api/v1/token`.
 * This endpoint is reachable without authentication, so the limit is kept
 * small to blunt memory-exhaustion attacks. Defaults to 32 KiB.
 *
 * @returns The configured maximum body size in bytes.
 */
export function getTokenMaxRequestBodyBytes(): number {
  const raw = process.env.MAILER_TOKEN_MAX_BODY_BYTES?.trim();
  const parsed = raw ? Number(raw) : 32_768;

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return 32_768;
  }

  return parsed;
}

export function getApiFailureRetentionDays(): number {
  const raw = process.env.API_FAILURE_RETENTION_DAYS?.trim();
  const parsed = raw ? Number(raw) : 30;

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return 30;
  }

  return parsed;
}
