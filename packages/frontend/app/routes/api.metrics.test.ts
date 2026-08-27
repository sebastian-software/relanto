import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const originalMetricsToken = process.env.METRICS_TOKEN;

describe("api.metrics auth failure logging", () => {
  beforeEach(() => {
    vi.resetModules();
    logApiFailureMock.mockReset();
  });

  afterEach(() => {
    if (originalMetricsToken === undefined) {
      delete process.env.METRICS_TOKEN;
    } else {
      process.env.METRICS_TOKEN = originalMetricsToken;
    }
  });

  afterAll(() => {
    process.env.APP_SESSION_SECRET = originalAppSessionSecret;
  });

  it("logs and returns 404 when METRICS_TOKEN is not configured", async () => {
    delete process.env.METRICS_TOKEN;

    const { loader } = await import("./api.metrics");
    const response = await loader({ request: new Request("http://localhost/metrics") });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/metrics",
        reasonCategory: "other",
        status: 404,
      }),
    );
  });

  it("logs auth_missing and returns 401 when the Authorization header is absent", async () => {
    process.env.METRICS_TOKEN = "secret-metrics-token";

    const { loader } = await import("./api.metrics");
    const response = await loader({ request: new Request("http://localhost/metrics") });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/metrics",
        reasonCategory: "auth_missing",
        status: 401,
      }),
    );
  });

  it("logs auth_invalid and returns 403 for a wrong bearer token", async () => {
    process.env.METRICS_TOKEN = "secret-metrics-token";

    const { loader } = await import("./api.metrics");
    const response = await loader({
      request: new Request("http://localhost/metrics", {
        headers: { Authorization: "Bearer wrong-token" },
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/metrics",
        reasonCategory: "auth_invalid",
        status: 403,
      }),
    );
  });

  it("logs method_not_allowed and returns 405 for unsupported verbs", async () => {
    process.env.METRICS_TOKEN = "secret-metrics-token";

    const { action } = await import("./api.metrics");
    const response = await action({
      request: new Request("http://localhost/metrics", { method: "POST" }),
    });

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
    expect(logApiFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/metrics",
        reasonCategory: "method_not_allowed",
        status: 405,
      }),
    );
  });
});
