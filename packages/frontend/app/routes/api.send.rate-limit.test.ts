import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.APP_SESSION_SECRET ??= "test-session-secret-with-at-least-32-chars";
});

const enqueueMail = vi.fn();
const mapDomainErrorToJsonResponse = vi.fn();
const requireAdminOrScope = vi.fn();
const processJob = vi.fn();
const logApiFailureMock = vi.fn();
const getSendRateLimitPerMinuteForConfig = vi.fn();

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
    mailerApi: { enqueueMail },
    mapDomainErrorToJsonResponse,
    requireAdminOrScope,
  };
});

vi.mock("@relanto/backend", async () => {
  const actual = await vi.importActual<typeof import("@relanto/backend")>("@relanto/backend");

  return {
    ...actual,
    getSendRateLimitPerMinute: () => 2,
    getSendRateLimitPerMinuteForConfig,
    processJob,
  };
});

function sendRequest(): Request {
  return new Request("http://localhost/api/v1/send", {
    body: JSON.stringify({
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
  });
}

function authAs(tokenId: string, applicationId = "app_1", configId = "cfg_1"): void {
  requireAdminOrScope.mockResolvedValue({
    kind: "token",
    token: {
      applicationId,
      configId,
      kind: "application",
      scopes: ["send"],
      tokenId,
    },
  });
}

describe("api.send per-application rate limiting", () => {
  beforeEach(() => {
    vi.resetModules();
    enqueueMail.mockReset();
    getSendRateLimitPerMinuteForConfig.mockReset();
    mapDomainErrorToJsonResponse.mockReset();
    processJob.mockReset();
    requireAdminOrScope.mockReset();
    logApiFailureMock.mockReset();
    getSendRateLimitPerMinuteForConfig.mockReturnValue(2);

    enqueueMail.mockReturnValue({
      acceptedAt: "2026-07-06T00:00:00.000Z",
      id: "job_1",
      status: "queued",
    });
  });

  it("allows requests under the limit and returns 429 with Retry-After once exceeded", async () => {
    authAs("tok_rate_1");
    const { action } = await import("./api.send");

    const first = await action({ request: sendRequest() });
    const second = await action({ request: sendRequest() });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const third = await action({ request: sendRequest() });

    expect(third.status).toBe(429);
    expect(Number(third.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    await expect(third.json()).resolves.toStrictEqual({
      error: "Rate limit exceeded",
      ok: false,
    });

    // The rejected request must not have been enqueued.
    expect(enqueueMail).toHaveBeenCalledTimes(2);
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/send",
        reasonCategory: "rate_limited",
        status: 429,
        tokenId: "tok_rate_1",
        tokenKind: "application",
      }),
    );
  });

  it("shares counters across tokens for the same application", async () => {
    const { action } = await import("./api.send");

    authAs("tok_a");
    await action({ request: sendRequest() });
    await action({ request: sendRequest() });

    authAs("tok_b");
    const blocked = await action({ request: sendRequest() });

    expect(blocked.status).toBe(429);
  });

  it("keeps separate counters per application", async () => {
    const { action } = await import("./api.send");

    authAs("tok_a", "app_a", "cfg_a");
    await action({ request: sendRequest() });
    await action({ request: sendRequest() });
    const blocked = await action({ request: sendRequest() });

    authAs("tok_b", "app_b", "cfg_b");
    const otherToken = await action({ request: sendRequest() });

    expect(blocked.status).toBe(429);
    expect(otherToken.status).toBe(200);
  });

  it("disables the send rate limit when the config limit is 0", async () => {
    getSendRateLimitPerMinuteForConfig.mockReturnValue(0);
    authAs("tok_unlimited");
    const { action } = await import("./api.send");

    const responses = await Promise.all([
      action({ request: sendRequest() }),
      action({ request: sendRequest() }),
      action({ request: sendRequest() }),
    ]);

    expect(responses.map((response) => response.status)).toStrictEqual([200, 200, 200]);
    expect(enqueueMail).toHaveBeenCalledTimes(3);
  });
});
