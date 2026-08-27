/* cspell:ignore ciphertext oxlint sonarjs subkey */
/* oxlint-disable no-magic-numbers -- Token byte lengths are protocol/security constants. */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, complexity, max-statements, regexp/require-unicode-sets-regexp, require-unicode-regexp, sonarjs/no-duplicate-string -- JWT validation is a compact boundary parser; regexes are protocol checks and decoded JSON remains unknown until validated. */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { getMailerSecret } from "./env.js";

const SECRET_KEY_VERSION = "v2";
const TOKEN_HASH_BYTE_LENGTH = 32;
const DUMMY_TOKEN_HASH = createHash("sha256").update("relanto:dummy-client-secret").digest("hex");

function getLegacySecretKeyBuffer(): Buffer {
  return createHash("sha256").update(getMailerSecret()).digest();
}

function deriveMailerSubkey(info: string): Buffer {
  return Buffer.from(hkdfSync("sha256", getMailerSecret(), "relanto", info, 32));
}

function getEncryptionKeyBuffer(): Buffer {
  return deriveMailerSubkey("relanto:enc");
}

function getJwtKeyBuffer(): Buffer {
  return deriveMailerSubkey("relanto:jwt");
}

function decryptSecretParts(parts: string[], key: Buffer): string {
  const [iv, authTag, encrypted] = parts;

  if (!iv || !authTag || !encrypted) {
    throw new Error("Invalid encrypted value");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Encrypts a plaintext string with AES-256-GCM using a freshly generated 96-bit IV.
 *
 * The result is formatted as `v2.<iv>.<authTag>.<ciphertext>` in base64url. The
 * GCM authentication tag guarantees integrity: {@link decryptSecret} throws on
 * any tampering or key mismatch. Used exclusively to store SMTP passwords at rest.
 *
 * @param value - The plaintext to encrypt (typically an SMTP password).
 * @returns A dot-separated base64url string encoding the IV, GCM auth tag, and ciphertext.
 */
export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${SECRET_KEY_VERSION}.${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

/**
 * Decrypts a value produced by {@link encryptSecret}.
 *
 * Throws if the encoded format is invalid or the GCM authentication tag does not
 * match, catching both accidental corruption and deliberate tampering.
 *
 * @param value - A dot-separated base64url string in the form `v2.<iv>.<authTag>.<ciphertext>`.
 * @returns The original plaintext string.
 * @throws {Error} If the format is malformed or AES-GCM authentication fails.
 */
export function decryptSecret(value: string): string {
  const parts = value.split(".");

  if (parts.length === 4 && parts[0] === SECRET_KEY_VERSION) {
    return decryptSecretParts(parts.slice(1), getEncryptionKeyBuffer());
  }

  if (parts.length === 3) {
    return decryptSecretParts(parts, getLegacySecretKeyBuffer());
  }

  throw new Error("Invalid encrypted value");
}

export function createId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

/**
 * Generates a random `mlr_`-prefixed client secret token backed by 192 bits of entropy.
 *
 * The `mlr_` prefix lets scanners and log pipelines identify and redact these tokens.
 * Only the SHA-256 hash (see {@link hashToken}) is stored in the database; the plain
 * token is shown to the user exactly once at creation or rotation time.
 *
 * @returns A `mlr_<base64url>` token string.
 */
export function createPlainToken(): string {
  return `mlr_${randomBytes(24).toString("base64url")}`;
}

/**
 * Computes a SHA-256 hex digest of a plain token for safe database storage.
 *
 * Storing only the hash means a database leak does not expose usable credentials.
 * The hash is compared during client authentication in `issueClientAccessToken`
 * (see `service.ts`).
 *
 * @param token - The plaintext token to hash.
 * @returns A lowercase hex-encoded SHA-256 digest.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyTokenHash(token: string, expectedHash = DUMMY_TOKEN_HASH): boolean {
  const actualBuffer = Buffer.from(hashToken(token), "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (
    actualBuffer.length !== TOKEN_HASH_BYTE_LENGTH ||
    expectedBuffer.length !== TOKEN_HASH_BYTE_LENGTH
  ) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function getTokenPreview(token: string): string {
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replaceAll(/password=[^\s&]+/gi, "password=[redacted]")
    .replaceAll(/token=[^\s&]+/gi, "token=[redacted]")
    .replaceAll(/authorization:\s*bearer\s+\S+/gi, "authorization: bearer [redacted]");
}

function encodeBase64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeBase64UrlJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signJwtSegment(value: string): string {
  return createHmac("sha256", getJwtKeyBuffer()).update(value).digest("base64url");
}

/**
 * Signs a JSON payload as a compact HS256 JWT using the mailer secret as the HMAC key.
 *
 * The caller must include `exp`, `iat`, `aud`, and any domain-specific claims in
 * `payload` before signing. The resulting token is verified by {@link verifyJwt},
 * which checks structure and signature but leaves claim validation to the caller.
 *
 * @param payload - Plain-object claims to embed in the token body.
 * @returns A compact JWT string in the form `header.payload.signature`.
 */
export function signJwt(payload: Record<string, unknown>): string {
  const header = encodeBase64UrlJson({
    alg: "HS256",
    typ: "JWT",
  });
  const body = encodeBase64UrlJson(payload);
  const signingInput = `${header}.${body}`;

  return `${signingInput}.${signJwtSegment(signingInput)}`;
}

/**
 * Verifies the HS256 signature of a compact JWT and returns its decoded payload.
 *
 * Uses a constant-time byte comparison to prevent timing side-channel attacks on the
 * signature. Only validates structure and the `alg: "HS256"` header field; callers
 * must still verify `exp`, `aud`, and any domain-specific claims themselves.
 *
 * @param token - A compact JWT string to verify.
 * @returns The decoded payload as a plain object.
 * @throws {Error} If the token is malformed, the algorithm is not `HS256`, or the signature does not match.
 */
export function verifyJwt(token: string): Record<string, unknown> {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    throw new Error("Invalid or revoked token");
  }

  const signingInput = `${header}.${payload}`;
  const expectedSignature = signJwtSegment(signingInput);
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid or revoked token");
  }

  const parsedHeader = decodeBase64UrlJson(header);

  if (
    typeof parsedHeader !== "object" ||
    parsedHeader === null ||
    !("alg" in parsedHeader) ||
    parsedHeader.alg !== "HS256"
  ) {
    throw new Error("Invalid or revoked token");
  }

  const parsedPayload = decodeBase64UrlJson(payload);

  if (typeof parsedPayload !== "object" || parsedPayload === null) {
    throw new Error("Invalid or revoked token");
  }

  return parsedPayload as Record<string, unknown>;
}
