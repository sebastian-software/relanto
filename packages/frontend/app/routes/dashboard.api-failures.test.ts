import { beforeEach, describe, expect, it, vi } from "vitest";

const { originalAppSessionSecret } = vi.hoisted(() => {
  const original = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
  return { originalAppSessionSecret: original };
});

const listApiFailures = vi.fn();
const requireSystemAdminUser = vi.fn();

vi.mock("@relanto/backend", async () => {
  const actual = await vi.importActual<typeof import("@relanto/backend")>("@relanto/backend");
  return {
    ...actual,
    listApiFailures,
  };
});

vi.mock("../lib/server/auth.server", () => ({
  requireSystemAdminUser,
}));

vi.mock("../lib/server/bootstrap.server", () => ({
  ensureRuntimeStarted: () => undefined,
}));

vi.mock("../lib/i18n", () => ({
  activateServerI18n: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/i18n/detectLocale.server", () => ({
  resolveLocaleFromRequest: vi.fn(() => "en"),
}));

describe("dashboard.api-failures loader", () => {
  beforeEach(() => {
    vi.resetModules();
    listApiFailures.mockReset();
    requireSystemAdminUser.mockReset();
  });

  process.env.APP_SESSION_SECRET = originalAppSessionSecret ?? process.env.APP_SESSION_SECRET;

  it("redirects unauthenticated users via requireSystemAdminUser", async () => {
    requireSystemAdminUser.mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router redirects throw Response objects as control flow.
      throw new Response(null, { headers: { Location: "/login" }, status: 302 });
    });

    const { loader } = await import("./dashboard.api-failures");

    await expect(
      loader({
        request: new Request("http://localhost/api-failures"),
      }),
    ).rejects.toMatchObject({ status: 302 });

    expect(listApiFailures).not.toHaveBeenCalled();
  });

  it("parses filters from search params and forwards them to listApiFailures", async () => {
    requireSystemAdminUser.mockResolvedValue({
      groups: ["superadmin"],
      label: "Admin",
      oidcSubject: "sys_1",
    });
    listApiFailures.mockReturnValue([]);

    const { loader } = await import("./dashboard.api-failures");

    const url =
      "http://localhost/api-failures?from=2026-06-01T00:00:00Z&to=2026-06-30T23:59:59Z&httpStatus=401&reasonCategory=scope_missing&applicationId=app_1";
    await loader({
      request: new Request(url),
    });

    expect(listApiFailures).toHaveBeenCalledWith({
      applicationId: "app_1",
      fromTimestamp: "2026-06-01T00:00:00.000Z",
      httpStatus: 401,
      limit: 100,
      reasonCategory: "scope_missing",
      toTimestamp: "2026-06-30T23:59:59.000Z",
    });
  });

  it("returns failures and raw filter values for empty result sets", async () => {
    requireSystemAdminUser.mockResolvedValue({
      groups: ["superadmin"],
      label: "Admin",
      oidcSubject: "sys_1",
    });
    listApiFailures.mockReturnValue([]);

    const { loader } = await import("./dashboard.api-failures");
    const result = await loader({
      request: new Request("http://localhost/api-failures"),
    });

    expect(result.failures).toStrictEqual([]);
    expect(result.filters).toStrictEqual({
      applicationId: "",
      fromTimestamp: "",
      httpStatus: "",
      reasonCategory: "",
      toTimestamp: "",
    });
  });

  it("rejects invalid reason categories and HTTP status values silently", async () => {
    requireSystemAdminUser.mockResolvedValue({
      groups: ["superadmin"],
      label: "Admin",
      oidcSubject: "sys_1",
    });
    listApiFailures.mockReturnValue([]);

    const { loader } = await import("./dashboard.api-failures");
    await loader({
      request: new Request("http://localhost/api-failures?reasonCategory=unknown&httpStatus=abc"),
    });

    expect(listApiFailures).toHaveBeenCalledWith({
      applicationId: undefined,
      fromTimestamp: undefined,
      httpStatus: undefined,
      limit: 100,
      reasonCategory: undefined,
      toTimestamp: undefined,
    });
  });
});
