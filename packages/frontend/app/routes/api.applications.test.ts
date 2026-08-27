import { beforeEach, describe, expect, it, vi } from "vitest";

const createApplication = vi.fn();
const listApplications = vi.fn();
const requireAdminOrScope = vi.fn();

vi.mock("./api._shared", () => ({
  mailerApi: {
    createApplication,
    listApplications,
  },
  methodNotAllowedHandler: () => () => new Response(null, { status: 405 }),
  requireAdminOrScope,
  withDomainErrorJson: async (_request: Request, handler: () => Promise<Response>) => handler(),
}));

describe("api.applications loader", () => {
  beforeEach(() => {
    vi.resetModules();
    createApplication.mockReset();
    listApplications.mockReset();
    requireAdminOrScope.mockReset();
  });

  it("returns all applications for a systemAdmin", async () => {
    requireAdminOrScope.mockResolvedValue({ kind: "systemAdmin", principalId: "sys_1" });
    listApplications.mockReturnValue([
      { applicationAdminId: "adm_1", id: "app_1", label: "App One" },
      { applicationAdminId: "adm_2", id: "app_2", label: "App Two" },
    ]);

    const { loader } = await import("./api.applications");
    const response = await loader({
      request: new Request("http://localhost/api/v1/applications"),
    });

    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "manageApplications");
    expect(listApplications).toHaveBeenCalledWith(undefined);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      applications: [
        { applicationAdminId: "adm_1", id: "app_1", label: "App One" },
        { applicationAdminId: "adm_2", id: "app_2", label: "App Two" },
      ],
      ok: true,
    });
  });

  it("returns only own applications for an applicationAdmin token", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationAdminId: "adm_1",
        kind: "applicationAdmin",
        scopes: ["manageApplications"],
        tokenId: "tok_1",
      },
    });
    listApplications.mockReturnValue([
      { applicationAdminId: "adm_1", id: "app_1", label: "App One" },
    ]);

    const { loader } = await import("./api.applications");
    const response = await loader({
      request: new Request("http://localhost/api/v1/applications"),
    });

    expect(listApplications).toHaveBeenCalledWith("adm_1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      applications: [{ applicationAdminId: "adm_1", id: "app_1", label: "App One" }],
      ok: true,
    });
  });

  it("rejects with 403 for an application token", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["manageApplications"],
        tokenId: "tok_1",
      },
    });

    const { loader } = await import("./api.applications");

    await expect(
      loader({ request: new Request("http://localhost/api/v1/applications") }),
    ).rejects.toMatchObject({ status: 403 });

    expect(listApplications).not.toHaveBeenCalled();
  });
});

describe("api.applications action", () => {
  beforeEach(() => {
    vi.resetModules();
    createApplication.mockReset();
    listApplications.mockReset();
    requireAdminOrScope.mockReset();
  });

  it("creates an application as systemAdmin with applicationAdminId from payload", async () => {
    requireAdminOrScope.mockResolvedValue({ kind: "systemAdmin", principalId: "sys_1" });
    createApplication.mockReturnValue({
      applicationAdminId: "adm_2",
      id: "app_new",
      label: "New App",
    });

    const { action } = await import("./api.applications");
    const response = await action({
      request: new Request("http://localhost/api/v1/applications", {
        body: JSON.stringify({ applicationAdminId: "adm_2", label: "New App" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "manageApplications");
    expect(createApplication).toHaveBeenCalledWith("sys_1", "systemAdmin", {
      applicationAdminId: "adm_2",
      label: "New App",
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toStrictEqual({
      application: { applicationAdminId: "adm_2", id: "app_new", label: "New App" },
      ok: true,
    });
  });

  it("creates an application as applicationAdmin token using own id", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationAdminId: "adm_1",
        kind: "applicationAdmin",
        scopes: ["manageApplications"],
        tokenId: "tok_1",
      },
    });
    createApplication.mockReturnValue({
      applicationAdminId: "adm_1",
      id: "app_new",
      label: "My App",
    });

    const { action } = await import("./api.applications");
    const response = await action({
      request: new Request("http://localhost/api/v1/applications", {
        body: JSON.stringify({ label: "My App" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(createApplication).toHaveBeenCalledWith("adm_1", "applicationAdmin", {
      applicationAdminId: "adm_1",
      label: "My App",
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toStrictEqual({
      application: { applicationAdminId: "adm_1", id: "app_new", label: "My App" },
      ok: true,
    });
  });

  it("ignores applicationAdminId in payload for applicationAdmin token and uses own id", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationAdminId: "adm_1",
        kind: "applicationAdmin",
        scopes: ["manageApplications"],
        tokenId: "tok_1",
      },
    });
    createApplication.mockReturnValue({
      applicationAdminId: "adm_1",
      id: "app_new",
      label: "My App",
    });

    const { action } = await import("./api.applications");
    await action({
      request: new Request("http://localhost/api/v1/applications", {
        body: JSON.stringify({ applicationAdminId: "adm_foreign", label: "My App" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(createApplication).toHaveBeenCalledWith("adm_1", "applicationAdmin", {
      applicationAdminId: "adm_1",
      label: "My App",
    });
  });

  it("rejects with 403 for an application token on POST", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["manageApplications"],
        tokenId: "tok_1",
      },
    });

    const { action } = await import("./api.applications");

    await expect(
      action({
        request: new Request("http://localhost/api/v1/applications", {
          body: JSON.stringify({ label: "Sneaky App" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(createApplication).not.toHaveBeenCalled();
  });

  it("coerces missing applicationAdminId to empty string for systemAdmin", async () => {
    requireAdminOrScope.mockResolvedValue({ kind: "systemAdmin", principalId: "sys_1" });
    createApplication.mockReturnValue({
      applicationAdminId: "",
      id: "app_new",
      label: "No Admin App",
    });

    const { action } = await import("./api.applications");
    await action({
      request: new Request("http://localhost/api/v1/applications", {
        body: JSON.stringify({ label: "No Admin App" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(createApplication).toHaveBeenCalledWith("sys_1", "systemAdmin", {
      applicationAdminId: "",
      label: "No Admin App",
    });
  });
});
