import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateRequiredEnvironment } from "./environment-validation.server";

const REQUIRED_KEYS = [
  "MAILER_SECRET_KEY",
  "MAILER_DB_PATH",
  "APP_SESSION_SECRET",
  "POCKET_ID_ISSUER",
  "POCKET_ID_CLIENT_ID",
  "POCKET_ID_REDIRECT_URI",
  "RELANTO_OPERATOR_ASSETS",
  "NPM_TOKEN",
  "NODE_AUTH_TOKEN",
  "NODE_ENV",
] as const;

const STRONG_MAILER_SECRET = "3f8a2c4e6b1d0f5709a8c7e6d5b4a3f2e1d0c9b8";
const STRONG_SESSION_SECRET = "9b8a7c6d5e4f30211a2b3c4d5e6f70819aabbccd";

const originalEnvironment = new Map<(typeof REQUIRED_KEYS)[number], string | undefined>();
const originalWorkingDirectory = process.cwd();
let temporaryDirectory: string | undefined;

function setValidProductionEnvironment(): void {
  process.env.NODE_ENV = "production";
  process.env.MAILER_SECRET_KEY = STRONG_MAILER_SECRET;
  process.env.MAILER_DB_PATH = "/var/lib/relanto/mailer.sqlite";
  process.env.APP_SESSION_SECRET = STRONG_SESSION_SECRET;
  process.env.POCKET_ID_ISSUER = "https://pocket-id.example.com";
  process.env.POCKET_ID_CLIENT_ID = "relanto-mailer";
  process.env.POCKET_ID_REDIRECT_URI = "https://mailer.example.com/auth/callback";
  delete process.env.RELANTO_OPERATOR_ASSETS;
}

describe("validateRequiredEnvironment", () => {
  beforeEach(() => {
    for (const key of REQUIRED_KEYS) {
      originalEnvironment.set(key, process.env[key]);
    }
  });

  afterEach(() => {
    process.chdir(originalWorkingDirectory);

    if (temporaryDirectory !== undefined) {
      rmSync(temporaryDirectory, { force: true, recursive: true });
      temporaryDirectory = undefined;
    }

    for (const key of REQUIRED_KEYS) {
      const value = originalEnvironment.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("requires neither private npm credentials nor an operator overlay by default", () => {
    setValidProductionEnvironment();
    delete process.env.NPM_TOKEN;
    delete process.env.NODE_AUTH_TOKEN;
    delete process.env.RELANTO_OPERATOR_ASSETS;

    expect(validateRequiredEnvironment()).toStrictEqual([]);
  });

  it("includes operator asset failures in production fail-fast validation", () => {
    setValidProductionEnvironment();
    process.env.RELANTO_OPERATOR_ASSETS = "true";
    temporaryDirectory = mkdtempSync(join(tmpdir(), "relanto-environment-validation-"));
    process.chdir(temporaryDirectory);

    expect(validateRequiredEnvironment()).toStrictEqual([
      "RELANTO_OPERATOR_ASSETS=true requires a readable file at build/client/operator-assets/theme.css.",
      "RELANTO_OPERATOR_ASSETS=true requires a readable file at build/client/operator-assets/logo-software.svg.",
      "RELANTO_OPERATOR_ASSETS=true requires a readable file at build/client/operator-assets/favicon.svg.",
    ]);
  });

  it("reports each required variable that is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.MAILER_SECRET_KEY;
    delete process.env.MAILER_DB_PATH;
    delete process.env.APP_SESSION_SECRET;
    delete process.env.POCKET_ID_ISSUER;
    delete process.env.POCKET_ID_CLIENT_ID;
    delete process.env.POCKET_ID_REDIRECT_URI;

    const errors = validateRequiredEnvironment();

    expect(errors).toContain("MAILER_SECRET_KEY is required and must be a strong random secret.");
    expect(errors).toContain(
      "MAILER_DB_PATH is required outside local development. Configure a persistent path such as /var/lib/relanto/mailer.sqlite.",
    );
    expect(errors).toContain("APP_SESSION_SECRET is required and must be a strong random secret.");
    expect(errors).toContain("POCKET_ID_ISSUER is not configured");
    expect(errors).toContain("POCKET_ID_CLIENT_ID is not configured");
    expect(errors).toContain(
      "POCKET_ID_REDIRECT_URI is required outside local development. Configure the canonical OIDC callback URL explicitly.",
    );
  });

  it("rejects placeholder and too-short secrets", () => {
    setValidProductionEnvironment();
    process.env.MAILER_SECRET_KEY = "short";
    process.env.APP_SESSION_SECRET = "changeme-changeme-changeme-changeme";

    const errors = validateRequiredEnvironment();

    expect(errors).toContain("MAILER_SECRET_KEY must be at least 32 characters long.");
    expect(errors).toContain(
      "APP_SESSION_SECRET must not use a placeholder value. Generate a strong random secret.",
    );
  });

  it("rejects a malformed OIDC issuer URL", () => {
    setValidProductionEnvironment();
    process.env.POCKET_ID_ISSUER = "not-a-url";

    const errors = validateRequiredEnvironment();

    expect(errors).toContain("POCKET_ID_ISSUER must be a valid URL: not-a-url");
  });

  it("does not require MAILER_DB_PATH or the redirect URI in local development", () => {
    process.env.NODE_ENV = "development";
    process.env.MAILER_SECRET_KEY = STRONG_MAILER_SECRET;
    process.env.APP_SESSION_SECRET = STRONG_SESSION_SECRET;
    process.env.POCKET_ID_ISSUER = "https://pocket-id.example.com";
    process.env.POCKET_ID_CLIENT_ID = "relanto-mailer";
    delete process.env.MAILER_DB_PATH;
    delete process.env.POCKET_ID_REDIRECT_URI;

    expect(validateRequiredEnvironment()).toStrictEqual([]);
  });
});
