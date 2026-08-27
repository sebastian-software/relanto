/* eslint-disable @typescript-eslint/only-throw-error -- Tests exercise React Router handlers that intentionally throw non-Error validation objects. */
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
    getTokenRateLimitPerMinute: () => 30,
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

describe("api.token action", () => {
  beforeEach(() => {
    issueClientAccessToken.mockReset();
    logApiFailureMock.mockReset();
  });

  it("returns a signed access token response for valid client credentials", async () => {
    issueClientAccessToken.mockReturnValue({
      accessToken: "jwt-token",
      expiresIn: 900,
      ok: true,
      tokenType: "Bearer",
    });

    const { action } = await import("./api.token");
    const response = await action({
      request: new Request("http://localhost/api/v1/token", {
        body: JSON.stringify({
          clientId: "appcli_123",
          clientSecret: "mlr_secret",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(issueClientAccessToken).toHaveBeenCalledWith({
      clientId: "appcli_123",
      clientSecret: "mlr_secret",
    });
    await expect(response.json()).resolves.toStrictEqual({
      accessToken: "jwt-token",
      expiresIn: 900,
      ok: true,
      tokenType: "Bearer",
    });
  });

  it("returns 401 for invalid client credentials", async () => {
    issueClientAccessToken.mockImplementation(() => {
      throw new Error("Invalid or revoked client credentials");
    });

    const { action } = await import("./api.token");
    const response = await action({
      request: new Request("http://localhost/api/v1/token", {
        body: JSON.stringify({
          clientId: "appcli_123",
          clientSecret: "wrong",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Invalid or revoked client credentials",
      ok: false,
    });
  });

  it("returns 400 with issues for a validation failure", async () => {
    issueClientAccessToken.mockImplementation(() => {
      throw {
        issues: [{ message: "clientId is required", path: ["clientId"] }],
      };
    });

    const { action } = await import("./api.token");
    const response = await action({
      request: new Request("http://localhost/api/v1/token", {
        body: JSON.stringify({ clientSecret: "mlr_secret" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Validation failed",
      issues: [{ message: "clientId is required", path: ["clientId"] }],
      ok: false,
    });
  });

  it("rejects a primitive number body with 400 before reaching token issuance", async () => {
    // readJsonBody rejects non-object payloads with a 400 Response, so the client
    // never reaches issueClientAccessToken and cannot trigger a generic 500.
    const { action } = await import("./api.token");
    const response = await action({
      request: new Request("http://localhost/api/v1/token", {
        body: "123",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    expect(issueClientAccessToken).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toStrictEqual({
      error: "Request body must be a JSON object",
      ok: false,
    });
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({ reasonCategory: "other", status: 400 }),
    );
  });

  it("rejects a null body with 400 before reaching token issuance", async () => {
    const { action } = await import("./api.token");
    const response = await action({
      request: new Request("http://localhost/api/v1/token", {
        body: "null",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    expect(issueClientAccessToken).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toStrictEqual({
      error: "Request body must be a JSON object",
      ok: false,
    });
  });

  it("returns 400 when the request body is malformed JSON", async () => {
    // readJsonBody translates the SyntaxError from request.json() into a 400
    // Response instead of letting it fall through to a generic 500.
    const { action } = await import("./api.token");
    const response = await action({
      request: new Request("http://localhost/api/v1/token", {
        body: "{ not json",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(400);
    expect(issueClientAccessToken).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toStrictEqual({
      error: "Invalid JSON in request body",
      ok: false,
    });
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({ reasonCategory: "other", status: 400 }),
    );
  });
});
