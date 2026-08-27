import { createCipheriv, createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  hashToken,
  signJwt,
  verifyJwt,
  verifyTokenHash,
} from "./security.ts";

const originalMailerSecretKey = process.env.MAILER_SECRET_KEY;

function encryptLegacySecret(value) {
  const iv = Buffer.alloc(12, 1);
  const legacyKey = createHash("sha256").update(process.env.MAILER_SECRET_KEY).digest();
  const cipher = createCipheriv("aes-256-gcm", legacyKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

describe("secret encryption", () => {
  beforeEach(() => {
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
  });

  afterEach(() => {
    if (originalMailerSecretKey === undefined) {
      delete process.env.MAILER_SECRET_KEY;
    } else {
      process.env.MAILER_SECRET_KEY = originalMailerSecretKey;
    }
  });

  it("encrypts new SMTP secrets with a versioned HKDF-derived key", () => {
    const encrypted = encryptSecret("smtp-password");

    expect(encrypted.split(".")).toHaveLength(4);
    expect(encrypted.startsWith("v2.")).toBe(true);
    expect(decryptSecret(encrypted)).toBe("smtp-password");
  });

  it("keeps legacy SHA-256 encrypted SMTP secrets readable", () => {
    const encrypted = encryptLegacySecret("legacy-smtp-password");

    expect(encrypted.split(".")).toHaveLength(3);
    expect(decryptSecret(encrypted)).toBe("legacy-smtp-password");
  });

  it("signs and verifies JWTs with the derived JWT key", () => {
    const token = signJwt({ aud: "relanto-api", sub: "client-1" });

    expect(verifyJwt(token)).toMatchObject({
      aud: "relanto-api",
      sub: "client-1",
    });
  });
});

describe("token hash verification", () => {
  it("compares token digests with a timing-safe Buffer comparison", () => {
    expect(verifyTokenHash("client-secret", hashToken("client-secret"))).toBe(true);
    expect(verifyTokenHash("wrong-secret", hashToken("client-secret"))).toBe(false);
    expect(verifyTokenHash("client-secret")).toBe(false);
    expect(verifyTokenHash("client-secret", "not-a-sha256-hex-digest")).toBe(false);
  });
});
