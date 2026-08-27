import { beforeEach, describe, expect, it, vi } from "vitest";

const canTokenAccessConfig = vi.fn();
const canTokenAccessToken = vi.fn();
const getSmtpConfig = vi.fn();
const getTokenById = vi.fn();
const listSmtpConfigs = vi.fn();
const listTokensByConfig = vi.fn();
const requireAdminOrScope = vi.fn();

vi.mock("./api._shared", () => ({
  mailerApi: {
    canTokenAccessConfig,
    canTokenAccessToken,
    getSmtpConfig,
    getTokenById,
    listSmtpConfigs,
    listTokensByConfig,
  },
  methodNotAllowedHandler: () => () => new Response(null, { status: 405 }),
  requireAdminOrScope,
  withDomainErrorJson: async (_request: Request, handler: () => Promise<Response>) => handler(),
}));

describe("API scope matrix", () => {
  beforeEach(() => {
    vi.resetModules();
    canTokenAccessConfig.mockReset();
    canTokenAccessToken.mockReset();
    getSmtpConfig.mockReset();
    getTokenById.mockReset();
    listSmtpConfigs.mockReset();
    listTokensByConfig.mockReset();
    requireAdminOrScope.mockReset();
  });

  it("requires manageApplications for listing SMTP configs", async () => {
    listSmtpConfigs.mockReturnValue([]);
    requireAdminOrScope.mockResolvedValue({ kind: "systemAdmin", principalId: "sys_1" });

    const { loader } = await import("./api.configs");
    const response = await loader({ request: new Request("http://localhost/api/v1/configs") });

    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "manageApplications");
    expect(response.status).toBe(200);
  });

  it("requires readConfig for reading the current application SMTP config", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["readConfig"],
        tokenId: "tok_1",
      },
    });
    getSmtpConfig.mockReturnValue({
      applicationAdminId: "adm_1",
      applicationId: "app_1",
      applicationLabel: "Mailer App",
      connectionTimeoutMs: 10_000,
      createdAt: "2026-01-01T00:00:00.000Z",
      defaultFromAddress: "sender@example.com",
      greetingTimeoutMs: 10_000,
      hasPassword: true,
      host: "smtp.example.com",
      id: "cfg_1",
      minTlsVersion: "TLSv1.2",
      name: "Primary SMTP",
      port: 587,
      requireTls: true,
      secure: false,
      socketTimeoutMs: 20_000,
      updatedAt: "2026-01-01T00:00:00.000Z",
      username: "mailer",
    });

    const { loader } = await import("./api.config");
    const response = await loader({ request: new Request("http://localhost/api/v1/config") });

    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "readConfig");
    expect(response.status).toBe(200);
  });

  it("requires manageApplications for reading a single SMTP config and keeps ownership checks", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationAdminId: "adm_1",
        kind: "applicationAdmin",
        scopes: ["manageApplications"],
        tokenId: "tok_1",
      },
    });
    canTokenAccessConfig.mockReturnValue(false);

    const { loader } = await import("./api.configs.$configId");

    await expect(
      loader({
        params: { configId: "cfg_foreign" },
        request: new Request("http://localhost/api/v1/configs/cfg_foreign"),
      }),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "",
    });
    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "manageApplications");
    expect(canTokenAccessConfig).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "applicationAdmin" }),
      "cfg_foreign",
    );
  });

  it("requires manageTokens for listing config tokens and keeps ownership checks", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["manageTokens"],
        tokenId: "tok_1",
      },
    });
    canTokenAccessConfig.mockReturnValue(false);

    const { loader } = await import("./api.configs.$configId.tokens");

    await expect(
      loader({
        params: { configId: "cfg_foreign" },
        request: new Request("http://localhost/api/v1/configs/cfg_foreign/tokens"),
      }),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "",
    });
    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "manageTokens");
    expect(canTokenAccessConfig).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "application" }),
      "cfg_foreign",
    );
  });

  it("requires manageTokens for reading a token and keeps ownership checks", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["manageTokens"],
        tokenId: "tok_1",
      },
    });
    canTokenAccessToken.mockReturnValue(false);

    const { loader } = await import("./api.tokens.$tokenId");

    await expect(
      loader({
        params: { tokenId: "tok_foreign" },
        request: new Request("http://localhost/api/v1/tokens/tok_foreign"),
      }),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "",
    });
    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "manageTokens");
    expect(canTokenAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "application" }),
      "tok_foreign",
    );
  });
});
