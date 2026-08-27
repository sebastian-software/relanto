import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { originalAppSessionSecret } = vi.hoisted(() => {
  const original = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
  return { originalAppSessionSecret: original };
});

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

vi.mock("../lib/server/bootstrap.server", () => ({
  ensureRuntimeStarted: () => undefined,
}));

describe("framework 405 gap closed via logged method_not_allowed", () => {
  beforeEach(() => {
    vi.resetModules();
    logApiFailureMock.mockReset();
  });

  afterAll(() => {
    process.env.APP_SESSION_SECRET = originalAppSessionSecret;
  });

  it("logs a 405 with { ok: false } for POST on a loader-only route", async () => {
    const { action } = await import("./api.config");

    const response = await action({
      request: new Request("http://localhost/api/v1/config", { method: "POST" }),
    });

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/api/v1/config",
        reasonCategory: "method_not_allowed",
        status: 405,
      }),
    );
  });

  it("logs a 405 with { ok: false } for GET on an action-only route", async () => {
    const { loader } = await import("./api.send");

    const response = await loader({
      request: new Request("http://localhost/api/v1/send"),
    });

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/api/v1/send",
        reasonCategory: "method_not_allowed",
        status: 405,
      }),
    );
  });
});
