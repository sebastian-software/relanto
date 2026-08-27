import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.APP_SESSION_SECRET ??= "test-session-secret-with-at-least-32-chars";
});

const canTokenAccessToken = vi.fn();
const updateTokenScopes = vi.fn();
const requireAdminOrScope = vi.fn();

vi.mock("./api._shared", async () => {
  const actual = await vi.importActual<typeof import("./api._shared")>("./api._shared");

  return {
    ...actual,
    mailerApi: {
      canTokenAccessToken,
      updateTokenScopes,
    },
    requireAdminOrScope,
    withDomainErrorJson: async (_request: Request, handler: () => Promise<Response>) => handler(),
  };
});

function scopesRequest(method: string): Request {
  return new Request("http://localhost/api/v1/tokens/tok_1/scopes", {
    body: JSON.stringify({ scopes: ["send", "readStatus"] }),
    headers: { "content-type": "application/json" },
    method,
  });
}

describe("api.tokens.$tokenId.scopes action", () => {
  beforeEach(() => {
    canTokenAccessToken.mockReset();
    updateTokenScopes.mockReset();
    requireAdminOrScope.mockReset();
  });

  it("updates token scopes on PATCH", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["manageTokens"],
        tokenId: "tok_admin",
      },
    });
    canTokenAccessToken.mockReturnValue(true);
    updateTokenScopes.mockReturnValue({ id: "tok_1", scopes: ["send", "readStatus"] });

    const { action } = await import("./api.tokens.$tokenId.scopes");
    const response = await action({
      params: { tokenId: "tok_1" },
      request: scopesRequest("PATCH"),
    });

    expect(requireAdminOrScope).toHaveBeenCalledWith(expect.any(Request), "manageTokens");
    expect(updateTokenScopes).toHaveBeenCalledWith("app_1", "application", "tok_1", {
      scopes: ["send", "readStatus"],
    });
    await expect(response.json()).resolves.toStrictEqual({
      ok: true,
      token: { id: "tok_1", scopes: ["send", "readStatus"] },
    });
  });

  it("rejects PUT with 405", async () => {
    const { action } = await import("./api.tokens.$tokenId.scopes");

    await expect(
      action({ params: { tokenId: "tok_1" }, request: scopesRequest("PUT") }),
    ).rejects.toMatchObject({ status: 405 });
    expect(requireAdminOrScope).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON bodies with 400 before touching backend logic", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["manageTokens"],
        tokenId: "tok_admin",
      },
    });
    canTokenAccessToken.mockReturnValue(true);

    const { action } = await import("./api.tokens.$tokenId.scopes");

    await expect(
      action({
        params: { tokenId: "tok_1" },
        request: new Request("http://localhost/api/v1/tokens/tok_1/scopes", {
          body: "{ not valid json",
          headers: { "content-type": "application/json" },
          method: "PATCH",
        }),
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(updateTokenScopes).not.toHaveBeenCalled();
  });

  it("rejects a non-object JSON body with 400", async () => {
    requireAdminOrScope.mockResolvedValue({
      kind: "token",
      token: {
        applicationId: "app_1",
        configId: "cfg_1",
        kind: "application",
        scopes: ["manageTokens"],
        tokenId: "tok_admin",
      },
    });
    canTokenAccessToken.mockReturnValue(true);

    const { action } = await import("./api.tokens.$tokenId.scopes");

    await expect(
      action({
        params: { tokenId: "tok_1" },
        request: new Request("http://localhost/api/v1/tokens/tok_1/scopes", {
          body: "[]",
          headers: { "content-type": "application/json" },
          method: "PATCH",
        }),
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(updateTokenScopes).not.toHaveBeenCalled();
  });
});
