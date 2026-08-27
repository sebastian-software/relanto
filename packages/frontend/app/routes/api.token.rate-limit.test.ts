import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.APP_SESSION_SECRET ??= "test-session-secret-with-at-least-32-chars";
});

const issueClientAccessToken = vi.fn();
const logApiFailureMock = vi.fn();

vi.mock("@relanto/backend", async () => {
  const actual = await vi.importActual<typeof import("@relanto/backend")>("@relanto/backend");

  return {
    ...actual,
    getTokenRateLimitPerMinute: () => 2,
    issueClientAccessToken,
  };
});

vi.mock("../lib/server/api-failure-log.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/server/api-failure-log.server")>(
    "../lib/server/api-failure-log.server",
  );

  return {
    ...actual,
    logApiFailure: logApiFailureMock,
  };
});

function tokenRequest(ip: string): Request {
  return new Request("http://localhost/api/v1/token", {
    body: JSON.stringify({ clientId: "appcli_123", clientSecret: "mlr_secret" }),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    method: "POST",
  });
}

describe("api.token IP rate limiting", () => {
  beforeEach(() => {
    vi.resetModules();
    issueClientAccessToken.mockReset();
    logApiFailureMock.mockReset();
    issueClientAccessToken.mockReturnValue({
      accessToken: "jwt-token",
      expiresIn: 900,
      ok: true,
      tokenType: "Bearer",
    });
  });

  it("allows requests under the limit and returns 429 with Retry-After once exceeded", async () => {
    const { action } = await import("./api.token");

    const first = await action({ request: tokenRequest("203.0.113.10") });
    const second = await action({ request: tokenRequest("203.0.113.10") });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const third = await action({ request: tokenRequest("203.0.113.10") });

    expect(third.status).toBe(429);
    expect(Number(third.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    await expect(third.json()).resolves.toStrictEqual({
      error: "Rate limit exceeded",
      ok: false,
    });

    // The rejected request must not have reached token issuance.
    expect(issueClientAccessToken).toHaveBeenCalledTimes(2);
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/token",
        reasonCategory: "rate_limited",
        status: 429,
      }),
    );
  });

  it("keeps separate counters per client IP", async () => {
    const { action } = await import("./api.token");

    await action({ request: tokenRequest("203.0.113.10") });
    await action({ request: tokenRequest("203.0.113.10") });
    const blocked = await action({ request: tokenRequest("203.0.113.10") });
    const otherIp = await action({ request: tokenRequest("198.51.100.20") });

    expect(blocked.status).toBe(429);
    expect(otherIp.status).toBe(200);
  });
});
