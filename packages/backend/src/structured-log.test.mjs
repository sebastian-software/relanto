import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logApiRequestRejected, logJobResult } from "./structured-log.ts";

const PII_FIELDS = [
  "to",
  "from",
  "recipient",
  "subject",
  "body",
  "html",
  "text",
  "headers",
  "password",
  "secret",
  "token",
  "clientSecret",
  "authorization",
];

describe("structured-log", () => {
  let logSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function captureSingleJsonLog() {
    expect(logSpy).toHaveBeenCalledTimes(1);
    const [line] = logSpy.mock.calls[0];
    expect(typeof line).toBe("string");
    return JSON.parse(line);
  }

  function expectNoPii(record) {
    for (const field of PII_FIELDS) {
      expect(record).not.toHaveProperty(field);
    }
  }

  describe("logJobResult()", () => {
    it("writes exactly one JSON object with the terminal status and no PII", () => {
      logJobResult({ jobId: "job_1", retryCount: 0, status: "sent" });

      const record = captureSingleJsonLog();

      expect(record.event).toBe("job_result");
      expect(record.jobId).toBe("job_1");
      expect(record.status).toBe("sent");
      expect(record.retryCount).toBe(0);
      expect(typeof record.ts).toBe("string");
      expectNoPii(record);
    });

    it("includes error category and code for a failed job", () => {
      logJobResult({
        errorCategory: "auth",
        errorCode: "EAUTH",
        jobId: "job_2",
        retryCount: 3,
        status: "failed",
      });

      const record = captureSingleJsonLog();

      expect(record).toMatchObject({
        errorCategory: "auth",
        errorCode: "EAUTH",
        event: "job_result",
        jobId: "job_2",
        retryCount: 3,
        status: "failed",
      });
      expectNoPii(record);
    });

    it("omits optional error fields when they are not provided", () => {
      logJobResult({ jobId: "job_3", status: "retry_scheduled" });

      const record = captureSingleJsonLog();

      expect(record).not.toHaveProperty("errorCategory");
      expect(record).not.toHaveProperty("errorCode");
      expect(record).not.toHaveProperty("retryCount");
    });
  });

  describe("logApiRequestRejected()", () => {
    it("writes exactly one JSON object with request metadata and no PII", () => {
      logApiRequestRejected({
        clientId: "appcli_123",
        method: "POST",
        path: "/api/v1/send",
        reasonCategory: "validation",
        status: 400,
      });

      const record = captureSingleJsonLog();

      expect(record).toMatchObject({
        clientId: "appcli_123",
        event: "api_request_rejected",
        method: "POST",
        path: "/api/v1/send",
        reasonCategory: "validation",
        status: 400,
      });
      expect(typeof record.ts).toBe("string");
      expectNoPii(record);
    });

    it("omits clientId when it is not provided", () => {
      logApiRequestRejected({
        method: "GET",
        path: "/api/v1/config",
        reasonCategory: "auth_missing",
        status: 401,
      });

      const record = captureSingleJsonLog();

      expect(record).not.toHaveProperty("clientId");
      expect(record.reasonCategory).toBe("auth_missing");
    });
  });
});
