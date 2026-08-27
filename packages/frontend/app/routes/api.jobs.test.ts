import { beforeEach, describe, expect, it, vi } from "vitest";

const canTokenAccessJob = vi.fn();
const getJobDeliveryStatus = vi.fn();
const getJobDeliveryStatusForToken = vi.fn();
const getJobStatusView = vi.fn();
const listJobDeliveryStatuses = vi.fn();
const listJobDeliveryStatusesForToken = vi.fn();
const listJobStatusViews = vi.fn();
const requireAdminOrScope = vi.fn();

vi.mock("./api._shared", () => ({
  mailerApi: {
    canTokenAccessJob,
    getJobDeliveryStatus,
    getJobDeliveryStatusForToken,
    getJobStatusView,
    listJobDeliveryStatuses,
    listJobDeliveryStatusesForToken,
    listJobStatusViews,
  },
  methodNotAllowedHandler: () => () => new Response(null, { status: 405 }),
  async readJsonBody(request: Request) {
    const parsed: unknown = await request.json();

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Request body must be a JSON object");
    }

    return parsed;
  },
  requireAdminOrScope,
  withDomainErrorJson: async (_request: Request, handler: () => Promise<Response>) => handler(),
}));

describe("api.jobs readStatus redaction", () => {
  beforeEach(() => {
    vi.resetModules();
    canTokenAccessJob.mockReset();
    getJobDeliveryStatus.mockReset();
    getJobDeliveryStatusForToken.mockReset();
    getJobStatusView.mockReset();
    listJobDeliveryStatuses.mockReset();
    listJobDeliveryStatusesForToken.mockReset();
    listJobStatusViews.mockReset();
    requireAdminOrScope.mockReset();
  });

  it("returns redacted job status views for /api/v1/jobs", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["readStatus"],
        tokenId: "tok_1",
      },
    });
    canTokenAccessJob.mockReturnValue(true);
    listJobStatusViews.mockReturnValue([
      {
        applicationId: "app_1",
        attachments: [
          {
            contentDisposition: "attachment",
            contentType: "text/plain",
            filename: "invoice.pdf",
          },
        ],
        configId: "cfg_1",
        createdAt: "2026-03-30T10:00:00.000Z",
        deliveryMode: "queued",
        from: "sender@example.com",
        id: "job_1",
        messageId: "msg_1",
        retryCount: 0,
        status: "queued",
        subject: "Subject",
        to: "recipient@example.com",
        tokenId: "tok_1",
        tokenKind: "application",
        updatedAt: "2026-03-30T10:00:00.000Z",
      },
    ]);

    const { loader } = await import("./api.jobs");
    const response = await loader({ request: new Request("http://localhost/api/v1/jobs") });

    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "readStatus");
    expect(listJobStatusViews).toHaveBeenCalledWith({
      applicationAdminId: undefined,
      applicationId: "app_1",
      configId: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
      messageId: undefined,
      status: undefined,
    });
    await expect(response.json()).resolves.toStrictEqual({
      jobs: [
        {
          applicationId: "app_1",
          attachments: [
            {
              contentDisposition: "attachment",
              contentType: "text/plain",
              filename: "invoice.pdf",
            },
          ],
          configId: "cfg_1",
          createdAt: "2026-03-30T10:00:00.000Z",
          deliveryMode: "queued",
          from: "sender@example.com",
          id: "job_1",
          messageId: "msg_1",
          retryCount: 0,
          status: "queued",
          subject: "Subject",
          to: "recipient@example.com",
          tokenId: "tok_1",
          tokenKind: "application",
          updatedAt: "2026-03-30T10:00:00.000Z",
        },
      ],
      ok: true,
    });
  });

  it("returns a redacted single job for /api/v1/jobs/:jobId", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["readStatus"],
        tokenId: "tok_1",
      },
    });
    canTokenAccessJob.mockReturnValue(true);
    getJobStatusView.mockReturnValue({
      applicationId: "app_1",
      attachments: [
        {
          contentDisposition: "attachment",
          contentType: "text/plain",
          filename: "invoice.pdf",
        },
      ],
      configId: "cfg_1",
      createdAt: "2026-03-30T10:00:00.000Z",
      deliveryMode: "queued",
      from: "sender@example.com",
      id: "job_1",
      messageId: "msg_1",
      retryCount: 0,
      status: "queued",
      subject: "Subject",
      to: "recipient@example.com",
      tokenId: "tok_1",
      tokenKind: "application",
      updatedAt: "2026-03-30T10:00:00.000Z",
    });

    const { loader } = await import("./api.jobs.$jobId");
    const response = await loader({
      params: { jobId: "job_1" },
      request: new Request("http://localhost/api/v1/jobs/job_1"),
    });

    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "readStatus");
    expect(canTokenAccessJob).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "application" }),
      "job_1",
    );
    expect(getJobStatusView).toHaveBeenCalledWith("job_1");
    await expect(response.json()).resolves.toStrictEqual({
      job: {
        applicationId: "app_1",
        attachments: [
          {
            contentDisposition: "attachment",
            contentType: "text/plain",
            filename: "invoice.pdf",
          },
        ],
        configId: "cfg_1",
        createdAt: "2026-03-30T10:00:00.000Z",
        deliveryMode: "queued",
        from: "sender@example.com",
        id: "job_1",
        messageId: "msg_1",
        retryCount: 0,
        status: "queued",
        subject: "Subject",
        to: "recipient@example.com",
        tokenId: "tok_1",
        tokenKind: "application",
        updatedAt: "2026-03-30T10:00:00.000Z",
      },
      ok: true,
    });
  });

  it("returns a client-facing delivery status for /api/v1/jobs/:jobId/delivery-status", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["readStatus"],
        tokenId: "tok_1",
      },
    });
    getJobDeliveryStatusForToken.mockReturnValue({
      deliveryStatus: "queued",
      jobId: "job_1",
      jobStatus: "queued",
      terminal: false,
      updatedAt: "2026-03-30T10:00:00.000Z",
    });

    const { loader } = await import("./api.jobs.$jobId.delivery-status");
    const response = await loader({
      params: { jobId: "job_1" },
      request: new Request("http://localhost/api/v1/jobs/job_1/delivery-status"),
    });

    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "readStatus");
    expect(getJobDeliveryStatusForToken).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "application" }),
      "job_1",
    );
    await expect(response.json()).resolves.toStrictEqual({
      ok: true,
      status: {
        deliveryStatus: "queued",
        jobId: "job_1",
        jobStatus: "queued",
        terminal: false,
        updatedAt: "2026-03-30T10:00:00.000Z",
      },
    });
  });

  it("returns batch delivery statuses in request order for /api/v1/jobs/delivery-status", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["readStatus"],
        tokenId: "tok_1",
      },
    });
    listJobDeliveryStatusesForToken.mockReturnValue([
      {
        deliveryStatus: "delivered",
        jobId: "job_1",
        jobStatus: "sent",
        terminal: true,
        updatedAt: "2026-03-30T10:00:02.000Z",
      },
      {
        deliveryStatus: "unknown",
        failureCategory: "expired_or_unknown",
        jobId: "job_missing",
        terminal: true,
      },
    ]);

    const { action } = await import("./api.jobs.delivery-status");
    const response = await action({
      request: new Request("http://localhost/api/v1/jobs/delivery-status", {
        body: JSON.stringify({ jobIds: ["job_1", "job_missing"] }),
        method: "POST",
      }),
    });

    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "readStatus");
    expect(listJobDeliveryStatusesForToken).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "application" }),
      ["job_1", "job_missing"],
    );
    await expect(response.json()).resolves.toStrictEqual({
      ok: true,
      statuses: [
        {
          deliveryStatus: "delivered",
          jobId: "job_1",
          jobStatus: "sent",
          terminal: true,
          updatedAt: "2026-03-30T10:00:02.000Z",
        },
        {
          deliveryStatus: "unknown",
          failureCategory: "expired_or_unknown",
          jobId: "job_missing",
          terminal: true,
        },
      ],
    });
  });

  it("rejects delivery status batches above the documented limit", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "systemAdmin",
      principalId: "system-admin-1",
    });

    const { action } = await import("./api.jobs.delivery-status");

    await expect(
      action({
        request: new Request("http://localhost/api/v1/jobs/delivery-status", {
          body: JSON.stringify({
            jobIds: Array.from({ length: 51 }, (_, index) => `job_${index}`),
          }),
          method: "POST",
        }),
      }),
    ).rejects.toMatchObject({ issues: expect.any(Array) });
    expect(listJobDeliveryStatuses).not.toHaveBeenCalled();
  });
});
