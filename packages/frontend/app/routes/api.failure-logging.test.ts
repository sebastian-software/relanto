/* eslint-disable @typescript-eslint/only-throw-error -- API helpers throw Response objects as React Router control flow. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { originalAppSessionSecret } = vi.hoisted(() => {
  const original = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
  return { originalAppSessionSecret: original };
});

const authenticateAccessToken = vi.fn();
const logApiFailureMock = vi.fn();

vi.mock("@relanto/backend", async () => {
  const actual = await vi.importActual<typeof import("@relanto/backend")>("@relanto/backend");

  return {
    ...actual,
    authenticateAccessToken,
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

vi.mock("../lib/server/bootstrap.server", () => ({
  ensureRuntimeStarted: () => undefined,
}));

vi.mock("../lib/server/session.server", () => ({
  commitSession: vi.fn(),
  destroySession: vi.fn(),
  getSession: vi.fn().mockResolvedValue({
    get: () => undefined,
    set: () => undefined,
  }),
}));

describe("requireApiAccess failure classification", () => {
  beforeEach(() => {
    vi.resetModules();
    authenticateAccessToken.mockReset();
    logApiFailureMock.mockReset();
  });

  afterAll(() => {
    process.env.APP_SESSION_SECRET = originalAppSessionSecret;
  });

  it("logs auth_missing when no bearer token is present", async () => {
    const { requireApiAccess } = await import("../lib/server/auth.server");

    await expect(
      requireApiAccess(new Request("http://localhost/api/v1/config"), "readConfig"),
    ).rejects.toMatchObject({ status: 401 });

    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/api/v1/config",
        reasonCategory: "auth_missing",
        status: 401,
      }),
    );
  });

  it("logs scope_missing with expectedScope when the scope check fails", async () => {
    authenticateAccessToken.mockImplementation(() => {
      throw new Error("Token is missing required scope: readConfig");
    });

    const { requireApiAccess } = await import("../lib/server/auth.server");

    await expect(
      requireApiAccess(
        new Request("http://localhost/api/v1/config", {
          headers: { authorization: "Bearer abc.def.ghi" },
        }),
        "readConfig",
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { expectedScope: "readConfig" },
        path: "/api/v1/config",
        reasonCategory: "scope_missing",
        status: 403,
      }),
    );
  });

  it("logs auth_invalid for arbitrary credential failures", async () => {
    authenticateAccessToken.mockImplementation(() => {
      throw new Error("Invalid or revoked token");
    });

    const { requireApiAccess } = await import("../lib/server/auth.server");

    await expect(
      requireApiAccess(
        new Request("http://localhost/api/v1/jobs", {
          headers: { authorization: "Bearer abc.def.ghi" },
        }),
        "readStatus",
      ),
    ).rejects.toMatchObject({ status: 401 });

    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/jobs",
        reasonCategory: "auth_invalid",
        reasonMessage: "Invalid or revoked token",
        status: 401,
      }),
    );
  });

  it("surfaces an infrastructure fault as a generic 503 instead of a 401 with a leaked message", async () => {
    // A read-only database makes the `last_used_at` write inside
    // `authenticateAccessToken` throw. This must not be reported as an auth
    // failure, and the raw SQLite message must not reach the client.
    authenticateAccessToken.mockImplementation(() => {
      throw new Error("attempt to write a readonly database");
    });

    const { requireApiAccess } = await import("../lib/server/auth.server");
    const { withDomainErrorJson } = await import("./api._shared");

    const request = new Request("http://localhost/api/v1/send", {
      headers: { authorization: "Bearer abc.def.ghi" },
      method: "POST",
    });
    const response = await withDomainErrorJson(request, async () => {
      await requireApiAccess(request, "send");
      return Response.json({ ok: true });
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Service temporarily unavailable",
      ok: false,
    });

    // The raw database error stays in the server-side failure log only.
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/send",
        reasonCategory: "other",
        reasonMessage: "attempt to write a readonly database",
        status: 503,
      }),
    );
    expect(logApiFailureMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ reasonCategory: "auth_invalid" }),
    );
  });
});

describe("withDomainErrorJson failure classification", () => {
  beforeEach(() => {
    vi.resetModules();
    logApiFailureMock.mockReset();
  });

  it("logs domain_error for known domain error messages", async () => {
    const { withDomainErrorJson } = await import("./api._shared");

    const response = await withDomainErrorJson(
      new Request("http://localhost/api/v1/jobs/job_1"),
      () => {
        throw new Error("Job not found");
      },
    );

    expect(response.status).toBe(404);
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/jobs/job_1",
        reasonCategory: "domain_error",
        reasonMessage: "Job not found",
        status: 404,
      }),
    );
  });

  it("logs validation with issuePaths for Zod errors", async () => {
    const { withDomainErrorJson } = await import("./api._shared");

    const response = await withDomainErrorJson(
      new Request("http://localhost/api/v1/send", { method: "POST" }),
      () => {
        throw {
          issues: [
            { message: "Required", path: ["text"] },
            { message: "Required", path: ["html"] },
          ],
        };
      },
    );

    expect(response.status).toBe(400);
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { issueCount: 2, issuePaths: ["text", "html"] },
        path: "/api/v1/send",
        reasonCategory: "validation",
        reasonMessage: "Required",
        status: 400,
      }),
    );
  });

  it("logs method_not_allowed for 405 Response throws", async () => {
    const { withDomainErrorJson } = await import("./api._shared");

    const response = await withDomainErrorJson(
      new Request("http://localhost/api/v1/jobs", { method: "PUT" }),
      () => {
        throw new Response("Method PUT not allowed", { status: 405 });
      },
    );

    expect(response.status).toBe(405);
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/jobs",
        reasonCategory: "method_not_allowed",
        status: 405,
      }),
    );
  });

  it("does not double-log a Response that was already marked as logged", async () => {
    const { markResponseAsLogged } = await import("../lib/server/api-failure-log.server");
    const { withDomainErrorJson } = await import("./api._shared");

    const preLogged = markResponseAsLogged(
      Response.json({ error: "Missing authorization" }, { status: 401 }),
    );

    const response = await withDomainErrorJson(
      new Request("http://localhost/api/v1/config"),
      () => {
        throw preLogged;
      },
    );

    expect(response.status).toBe(401);
    expect(logApiFailureMock).not.toHaveBeenCalled();
  });

  it("returns a generic 500 and logs the raw cause for unmapped errors", async () => {
    const { withDomainErrorJson } = await import("./api._shared");

    const response = await withDomainErrorJson(
      new Request("http://localhost/api/v1/send", { method: "POST" }),
      () => {
        throw new Error("attempt to write a readonly database");
      },
    );

    // The client sees a generic message; the raw cause stays server-side only.
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Internal server error",
      ok: false,
    });
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/send",
        reasonCategory: "other",
        reasonMessage: "attempt to write a readonly database",
        status: 500,
      }),
    );
  });
});
