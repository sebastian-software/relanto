/* eslint-disable @typescript-eslint/only-throw-error -- Tests exercise React Router handlers that intentionally throw Response objects. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.APP_SESSION_SECRET ??= "test-session-secret-with-at-least-32-chars";
});

const enqueueMail = vi.fn();
const getSendRateLimitPerMinuteForConfig = vi.fn();
const requireAdminOrScope = vi.fn();
const processJob = vi.fn();
const logApiFailureMock = vi.fn();

vi.mock("../lib/server/api-failure-log.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/server/api-failure-log.server")>(
    "../lib/server/api-failure-log.server",
  );

  return {
    ...actual,
    logApiFailure: logApiFailureMock,
  };
});

vi.mock("./api._shared", async () => {
  const actual = await vi.importActual<typeof import("./api._shared")>("./api._shared");

  return {
    ...actual,
    mailerApi: {
      enqueueMail,
    },
    requireAdminOrScope,
  };
});

vi.mock("@relanto/backend", async () => {
  const actual = await vi.importActual<typeof import("@relanto/backend")>("@relanto/backend");

  return {
    ...actual,
    getSendRateLimitPerMinuteForConfig,
    processJob,
  };
});

describe("api.send action", () => {
  beforeEach(() => {
    enqueueMail.mockReset();
    getSendRateLimitPerMinuteForConfig.mockReset();
    getSendRateLimitPerMinuteForConfig.mockReturnValue(1_000);
    processJob.mockReset();
    requireAdminOrScope.mockReset();
    logApiFailureMock.mockReset();
  });

  it("returns a 413 response with a business message for oversized attachments", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["send"],
        tokenId: "tok_1",
      },
    });
    enqueueMail.mockImplementation(() => {
      throw {
        issues: [
          {
            message: "Attachments must not exceed 20971520 bytes in total",
            path: ["attachments"],
          },
        ],
      };
    });

    const { action } = await import("./api.send");
    const response = await action({
      request: new Request("http://localhost/api/v1/send", {
        body: JSON.stringify({
          attachments: [{ contentBase64: "YQ==", contentType: "text/plain", filename: "a.txt" }],
          deliveryMode: "queued",
          from: "sender@example.com",
          html: "<p>Hello</p>",
          messageId: "msg-1",
          subject: "Subject",
          text: "Hello",
          to: "recipient@example.com",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Validation failed",
      issues: [
        {
          message: "Attachments must not exceed 20971520 bytes in total",
          path: ["attachments"],
        },
      ],
      ok: false,
    });
  });

  it("returns a 400 response with issues for oversized HTML", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["send"],
        tokenId: "tok_1",
      },
    });
    enqueueMail.mockImplementation(() => {
      throw {
        issues: [
          {
            message: "HTML body must not exceed 200000 characters",
            path: ["html"],
          },
        ],
      };
    });

    const { action } = await import("./api.send");
    const response = await action({
      request: new Request("http://localhost/api/v1/send", {
        body: JSON.stringify({
          attachments: [],
          deliveryMode: "queued",
          from: "sender@example.com",
          html: "<p>Hello</p>",
          messageId: "msg-1",
          subject: "Subject",
          text: "Hello",
          to: "recipient@example.com",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Validation failed",
      issues: [
        {
          message: "HTML body must not exceed 200000 characters",
          path: ["html"],
        },
      ],
      ok: false,
    });
  });

  it("returns a mapped domain error response for send-specific business failures", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["send"],
        tokenId: "tok_1",
      },
    });
    enqueueMail.mockImplementation(() => {
      throw new Error("Application requires an SMTP config before tokens can be issued");
    });

    const { action } = await import("./api.send");
    const response = await action({
      request: new Request("http://localhost/api/v1/send", {
        body: JSON.stringify({
          attachments: [],
          deliveryMode: "queued",
          from: "sender@example.com",
          html: "<p>Hello</p>",
          messageId: "msg-1",
          subject: "Subject",
          text: "Hello",
          to: "recipient@example.com",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Application requires an SMTP config before tokens can be issued",
      ok: false,
    });
  });

  it("returns a stable JSON 500 response for unexpected runtime failures", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["send"],
        tokenId: "tok_1",
      },
    });
    enqueueMail.mockImplementation(() => {
      throw new Error("boom");
    });

    const { action } = await import("./api.send");
    const response = await action({
      request: new Request("http://localhost/api/v1/send", {
        body: JSON.stringify({
          attachments: [],
          deliveryMode: "queued",
          from: "sender@example.com",
          html: "<p>Hello</p>",
          messageId: "msg-1",
          subject: "Subject",
          text: "Hello",
          to: "recipient@example.com",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Internal server error",
      ok: false,
    });
  });

  it("rejects OPTIONS requests on /api/v1/send with 405 and no CORS headers", async () => {
    const { action } = await import("./api.send");
    const response = await action({
      request: new Request("http://localhost/api/v1/send", {
        method: "OPTIONS",
      }),
    });

    expect(requireAdminOrScope).not.toHaveBeenCalled();
    expect(response.status).toBe(405);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Headers")).toBeNull();
    await expect(response.json()).resolves.toStrictEqual({
      error: "Method OPTIONS not allowed",
      ok: false,
    });
  });

  it("returns a 400 response for a syntactically invalid JSON body", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["send"],
        tokenId: "tok_1",
      },
    });

    const { action } = await import("./api.send");
    const response = await action({
      request: new Request("http://localhost/api/v1/send", {
        body: "{ not valid json",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    expect(enqueueMail).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toStrictEqual({
      error: "Invalid JSON in request body",
      ok: false,
    });
  });

  it("returns a 400 response for a non-object JSON body", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["send"],
        tokenId: "tok_1",
      },
    });

    const { action } = await import("./api.send");
    const response = await action({
      request: new Request("http://localhost/api/v1/send", {
        body: "null",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    expect(enqueueMail).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toStrictEqual({
      error: "Request body must be a JSON object",
      ok: false,
    });
  });

  it("returns ok true for a successful direct send", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["send"],
        tokenId: "tok_1",
      },
    });
    enqueueMail.mockReturnValue({
      acceptedAt: "2026-03-31T00:00:00.000Z",
      id: "job_1",
      status: "queued",
    });
    processJob.mockResolvedValue({
      acceptedAt: "2026-03-31T00:00:00.000Z",
      id: "job_1",
      status: "sent",
    });

    const { action } = await import("./api.send");
    const response = await action({
      request: new Request("http://localhost/api/v1/send", {
        body: JSON.stringify({
          deliveryMode: "direct",
          from: "sender@example.com",
          html: "<p>Hello</p>",
          messageId: "msg-1",
          subject: "Subject",
          text: "Hello",
          to: "recipient@example.com",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      acceptedAt: "2026-03-31T00:00:00.000Z",
      jobId: "job_1",
      ok: true,
      status: "sent",
    });
  });

  it.each(["failed", "retry_scheduled", "delivery_uncertain"] as const)(
    "returns ok false for a direct send ending in %s",
    async (status) => {
      requireAdminOrScope.mockResolvedValue({
        kind: "token",
        token: {
          applicationId: "app_1",
          configId: "cfg_1",
          kind: "application",
          scopes: ["send"],
          tokenId: "tok_1",
        },
      });
      enqueueMail.mockReturnValue({
        acceptedAt: "2026-03-31T00:00:00.000Z",
        id: "job_1",
        status: "queued",
      });
      processJob.mockResolvedValue({
        acceptedAt: "2026-03-31T00:00:00.000Z",
        id: "job_1",
        status,
      });

      const { action } = await import("./api.send");
      const response = await action({
        request: new Request("http://localhost/api/v1/send", {
          body: JSON.stringify({
            deliveryMode: "direct",
            from: "sender@example.com",
            html: "<p>Hello</p>",
            messageId: "msg-1",
            subject: "Subject",
            text: "Hello",
            to: "recipient@example.com",
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toStrictEqual({
        acceptedAt: "2026-03-31T00:00:00.000Z",
        jobId: "job_1",
        ok: false,
        status,
      });
    },
  );
});
