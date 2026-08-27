import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { originalAppSessionSecret } = vi.hoisted(() => {
  const original = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
  return { originalAppSessionSecret: original };
});

const deleteJob = vi.fn();
const getJobStatusView = vi.fn();
const getSmtpConfig = vi.fn();
const getTokenById = vi.fn();
const pauseJob = vi.fn();
const requireAdminOrScope = vi.fn();
const resumeJob = vi.fn();
const retryJob = vi.fn();
const upsertSmtpConfig = vi.fn();
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
      deleteJob,
      getJobStatusView,
      getSmtpConfig,
      getTokenById,
      pauseJob,
      resumeJob,
      retryJob,
      upsertSmtpConfig,
    },
    requireAdminOrScope,
  };
});

describe("API domain error mapping", () => {
  beforeEach(() => {
    vi.resetModules();
    deleteJob.mockReset();
    getJobStatusView.mockReset();
    getSmtpConfig.mockReset();
    getTokenById.mockReset();
    pauseJob.mockReset();
    requireAdminOrScope.mockReset();
    resumeJob.mockReset();
    retryJob.mockReset();
    upsertSmtpConfig.mockReset();
    logApiFailureMock.mockReset();

    requireAdminOrScope.mockResolvedValue({
      kind: "systemAdmin",
      principalId: "sys_1",
    });
  });

  afterAll(() => {
    process.env.APP_SESSION_SECRET = originalAppSessionSecret;
  });

  it("maps unknown job IDs to 404 JSON responses", async () => {
    getJobStatusView.mockImplementation(() => {
      throw new Error("Job not found");
    });

    const { loader } = await import("./api.jobs.$jobId");
    const response = await loader({
      params: { jobId: "job_missing" },
      request: new Request("http://localhost/api/v1/jobs/job_missing"),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Job not found",
      ok: false,
    });
  });

  it("maps unknown token IDs to 404 JSON responses", async () => {
    getTokenById.mockImplementation(() => {
      throw new Error("Token not found");
    });

    const { loader } = await import("./api.tokens.$tokenId");
    const response = await loader({
      params: { tokenId: "tok_missing" },
      request: new Request("http://localhost/api/v1/tokens/tok_missing"),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Token not found",
      ok: false,
    });
  });

  it("maps unknown config IDs to 404 JSON responses", async () => {
    getSmtpConfig.mockImplementation(() => {
      throw new Error("SMTP config not found");
    });

    const { loader } = await import("./api.configs.$configId");
    const response = await loader({
      params: { configId: "cfg_missing" },
      request: new Request("http://localhost/api/v1/configs/cfg_missing"),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toStrictEqual({
      error: "SMTP config not found",
      ok: false,
    });
  });

  it("maps invalid pause transitions to 409 JSON responses", async () => {
    pauseJob.mockImplementation(() => {
      throw new Error("Only pending jobs can be paused");
    });

    const { action } = await import("./api.jobs.$jobId.pause");
    const response = await action({
      params: { jobId: "job_1" },
      request: new Request("http://localhost/api/v1/jobs/job_1/pause", { method: "POST" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Only pending jobs can be paused",
      ok: false,
    });
  });

  it("maps invalid resume transitions to 409 JSON responses", async () => {
    resumeJob.mockImplementation(() => {
      throw new Error("Only paused jobs can be resumed");
    });

    const { action } = await import("./api.jobs.$jobId.resume");
    const response = await action({
      params: { jobId: "job_1" },
      request: new Request("http://localhost/api/v1/jobs/job_1/resume", { method: "POST" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Only paused jobs can be resumed",
      ok: false,
    });
  });

  it("maps invalid retry transitions to 409 JSON responses", async () => {
    retryJob.mockImplementation(() => {
      throw new Error("Only failed or uncertain jobs can be retried manually");
    });

    const { action } = await import("./api.jobs.$jobId.retry");
    const response = await action({
      params: { jobId: "job_1" },
      request: new Request("http://localhost/api/v1/jobs/job_1/retry", { method: "POST" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Only failed or uncertain jobs can be retried manually",
      ok: false,
    });
  });

  it("maps invalid delete transitions to 409 JSON responses", async () => {
    deleteJob.mockImplementation(() => {
      throw new Error("Sent jobs cannot be deleted");
    });

    const { action } = await import("./api.jobs.$jobId");
    const response = await action({
      params: { jobId: "job_1" },
      request: new Request("http://localhost/api/v1/jobs/job_1", { method: "DELETE" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Sent jobs cannot be deleted",
      ok: false,
    });
  });

  it("maps SMTP config reassignment attempts to 409 JSON responses", async () => {
    upsertSmtpConfig.mockImplementation(() => {
      throw new Error("SMTP config application cannot be changed");
    });

    const { action } = await import("./api.configs.$configId");
    const response = await action({
      params: { configId: "cfg_1" },
      request: new Request("http://localhost/api/v1/configs/cfg_1", {
        body: JSON.stringify({
          applicationId: "app_2",
          connectionTimeoutMs: 10_000,
          greetingTimeoutMs: 10_000,
          host: "smtp.example.com",
          minTlsVersion: "TLSv1.2",
          name: "Primary SMTP",
          port: 587,
          requireTls: true,
          secure: false,
          socketTimeoutMs: 20_000,
          username: "mailer",
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toStrictEqual({
      error: "SMTP config application cannot be changed",
      ok: false,
    });
  });
});
