import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetDatabase } from "./db.ts";
import {
  createApplication,
  createApplicationAdmin,
  createApplicationToken,
  enqueueMail,
  upsertSmtpConfig,
} from "./service.ts";
import { sendMailPayloadLimits } from "./types.ts";

function createBase64Payload(byteLength) {
  return Buffer.alloc(byteLength, "a").toString("base64");
}

function createSendMailInput(overrides = {}) {
  return {
    attachments: [],
    from: "sender@example.com",
    headers: {},
    html: "<p>Hello</p>",
    messageId: "msg-1",
    subject: "Hello",
    text: "Hello",
    to: "recipient@example.com",
    ...overrides,
  };
}

describe("send mail payload limits", () => {
  let authToken;
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relanto-send-mail-test-"));
    process.env.MAILER_DB_PATH = join(tempDir, "mailer.sqlite");
    process.env.MAILER_SECRET_KEY = "test-mailer-secret-with-at-least-32-chars";
    resetDatabase();

    const admin = createApplicationAdmin("system", "systemAdmin", { label: "Admin" });
    const application = createApplication("system", "systemAdmin", {
      applicationAdminId: admin.id,
      label: "App",
    });
    const config = upsertSmtpConfig("system", "systemAdmin", {
      applicationId: application.id,
      connectionTimeoutMs: 10_000,
      defaultFromAddress: "sender@example.com",
      greetingTimeoutMs: 10_000,
      host: "smtp.example.com",
      minTlsVersion: "TLSv1.2",
      name: "Primary SMTP",
      password: "secret",
      port: 587,
      requireTls: true,
      secure: false,
      socketTimeoutMs: 20_000,
      username: "mailer",
    });
    const token = createApplicationToken("system", "systemAdmin", {
      applicationId: application.id,
      label: "Send token",
      retainAttachmentsDays: 30,
      retainErrorDetailsDays: 30,
      retainFailedJobsDays: 30,
      retainSentJobsDays: 30,
      scopes: ["send", "readStatus"],
    });

    authToken = {
      applicationId: application.id,
      configId: config.id,
      kind: "application",
      scopes: ["send", "readStatus"],
      tokenId: token.id,
    };
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.MAILER_DB_PATH;
    delete process.env.MAILER_SECRET_KEY;
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("accepts payloads at the configured boundaries", () => {
    const input = createSendMailInput({
      attachments: Array.from({ length: sendMailPayloadLimits.maxAttachmentCount }, (_, index) => ({
        contentBase64: createBase64Payload(1024),
        contentDisposition: "attachment",
        contentType: "text/plain",
        filename: `file-${index}.txt`,
      })),
      html: "h".repeat(sendMailPayloadLimits.maxHtmlLength),
      text: "t".repeat(sendMailPayloadLimits.maxTextLength),
    });

    const job = enqueueMail(authToken, input, "queued");

    expect(job.status).toBe("queued");
    expect(job.attachments).toHaveLength(sendMailPayloadLimits.maxAttachmentCount);
  });

  it("accepts payloads without an explicit from address", () => {
    const job = enqueueMail(
      authToken,
      createSendMailInput({
        from: undefined,
        messageId: "msg-default-from",
      }),
      "queued",
    );

    expect(job.from).toBe("sender@example.com");
  });

  it("rejects invalid from addresses", () => {
    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          from: "invalid-address",
          messageId: "msg-invalid-from",
        }),
        "queued",
      ),
    ).toThrowError("Must be a valid email address");
  });

  it("rejects invalid recipient addresses", () => {
    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          messageId: "msg-invalid-to",
          to: "invalid-recipient",
        }),
        "queued",
      ),
    ).toThrowError("Must be a valid email address");
  });

  it("rejects subjects with embedded line breaks", () => {
    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          messageId: "msg-subject-crlf",
          subject: "Hello\r\nBcc: victim@example.com",
        }),
        "queued",
      ),
    ).toThrowError("subject must not contain line breaks");
  });

  it("rejects message ids with embedded line breaks", () => {
    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          messageId: "msg-crlf\r\nBcc: victim@example.com",
        }),
        "queued",
      ),
    ).toThrowError("messageId must not contain line breaks");
  });

  it("rejects header values with embedded line breaks", () => {
    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          headers: { "X-Custom": "value\r\nBcc: victim@example.com" },
          messageId: "msg-header-value-crlf",
        }),
        "queued",
      ),
    ).toThrowError("Header names and values must not contain line breaks");
  });

  it("rejects header names with embedded line breaks", () => {
    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          headers: { "X-Custom\r\nBcc: victim@example.com": "value" },
          messageId: "msg-header-name-crlf",
        }),
        "queued",
      ),
    ).toThrowError("Header names and values must not contain line breaks");
  });

  it("accepts recipients and headers without line breaks", () => {
    const job = enqueueMail(
      authToken,
      createSendMailInput({
        headers: { "X-Custom": "safe-value" },
        messageId: "msg-safe-headers",
        subject: "Safe subject",
        to: "recipient@example.com",
      }),
      "queued",
    );

    expect(job.status).toBe("queued");
    expect(job.to).toBe("recipient@example.com");
  });

  it("rejects HTML bodies above the limit", () => {
    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          html: "h".repeat(sendMailPayloadLimits.maxHtmlLength + 1),
        }),
        "queued",
      ),
    ).toThrowError(`HTML body must not exceed ${sendMailPayloadLimits.maxHtmlLength} characters`);
  });

  it("rejects text bodies above the limit", () => {
    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          text: "t".repeat(sendMailPayloadLimits.maxTextLength + 1),
        }),
        "queued",
      ),
    ).toThrowError(`Text body must not exceed ${sendMailPayloadLimits.maxTextLength} characters`);
  });

  it("rejects too many attachments", () => {
    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          attachments: Array.from(
            { length: sendMailPayloadLimits.maxAttachmentCount + 1 },
            (_, index) => ({
              contentBase64: createBase64Payload(1024),
              contentDisposition: "attachment",
              contentType: "text/plain",
              filename: `file-${index}.txt`,
            }),
          ),
        }),
        "queued",
      ),
    ).toThrowError(`Attachments must not exceed ${sendMailPayloadLimits.maxAttachmentCount} items`);
  });

  it("rejects single attachments above the limit", () => {
    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          attachments: [
            {
              contentBase64: createBase64Payload(sendMailPayloadLimits.maxAttachmentBytes + 1),
              contentDisposition: "attachment",
              contentType: "application/octet-stream",
              filename: "too-large.bin",
            },
          ],
        }),
        "queued",
      ),
    ).toThrowError(
      `Each attachment must not exceed ${sendMailPayloadLimits.maxAttachmentBytes} bytes`,
    );
  });

  it("rejects total attachment size above the limit", () => {
    const chunkSize = Math.floor(sendMailPayloadLimits.maxTotalAttachmentBytes / 5) + 1;

    expect(() =>
      enqueueMail(
        authToken,
        createSendMailInput({
          attachments: Array.from({ length: 5 }, (_, index) => ({
            contentBase64: createBase64Payload(chunkSize),
            contentDisposition: "attachment",
            contentType: "application/octet-stream",
            filename: `chunk-${index}.bin`,
          })),
        }),
        "queued",
      ),
    ).toThrowError(
      `Attachments must not exceed ${sendMailPayloadLimits.maxTotalAttachmentBytes} bytes in total`,
    );
  });
});
