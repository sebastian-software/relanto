import { beforeEach, describe, expect, it, vi } from "vitest";

const getSmtpConfig = vi.fn();
const requireAdminOrScope = vi.fn();

vi.mock("./api._shared", () => ({
  mailerApi: {
    getSmtpConfig,
  },
  methodNotAllowedHandler: () => () => new Response(null, { status: 405 }),
  requireAdminOrScope,
  withDomainErrorJson: async (_request: Request, handler: () => Promise<Response>) => handler(),
}));

const smtpConfig = {
  applicationAdminId: "adm_1",
  applicationId: "app_1",
  applicationLabel: "Mailer App",
  connectionTimeoutMs: 10_000,
  createdAt: "2026-01-01T00:00:00.000Z",
  defaultFromAddress: "sender@example.com",
  disabledAt: undefined,
  greetingTimeoutMs: 10_000,
  hasPassword: true,
  host: "smtp.example.com",
  id: "cfg_1",
  lockedAt: undefined,
  minTlsVersion: "TLSv1.2",
  name: "Primary SMTP",
  password: "plain-secret",
  passwordEncrypted: "encrypted-secret",
  port: 587,
  requireTls: true,
  secure: false,
  sendRateLimitPerMinute: 60,
  socketTimeoutMs: 20_000,
  updatedAt: "2026-01-01T00:00:00.000Z",
  username: "mailer",
};

describe("api.config loader", () => {
  beforeEach(() => {
    getSmtpConfig.mockReset();
    requireAdminOrScope.mockReset();
  });

  it("returns the current application SMTP config without username or password fields", async () => {
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
    getSmtpConfig.mockReturnValue(smtpConfig);

    const { loader } = await import("./api.config");
    const response = await loader({ request: new Request("http://localhost/api/v1/config") });
    const body = await response.json();

    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "readConfig");
    expect(getSmtpConfig).toHaveBeenCalledWith("cfg_1");
    expect(body).toStrictEqual({
      config: {
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
        sendRateLimitPerMinute: 60,
        socketTimeoutMs: 20_000,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      ok: true,
    });
    expect(body.config).not.toHaveProperty("username");
    expect(body.config).not.toHaveProperty("password");
    expect(body.config).not.toHaveProperty("passwordEncrypted");
  });

  it("rejects application admin tokens", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationAdminId: "adm_1",
        kind: "applicationAdmin",
        scopes: ["readConfig"],
        tokenId: "tok_1",
      },
    });

    const { loader } = await import("./api.config");

    await expect(
      loader({ request: new Request("http://localhost/api/v1/config") }),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "",
    });
  });

  it("rejects system admin sessions", async () => {
    requireAdminOrScope.mockResolvedValue({ kind: "systemAdmin", principalId: "sys_1" });

    const { loader } = await import("./api.config");

    await expect(
      loader({ request: new Request("http://localhost/api/v1/config") }),
    ).rejects.toMatchObject({
      status: 403,
      statusText: "",
    });
  });
});
