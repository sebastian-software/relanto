/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, compat/compat -- Tests narrow thrown values and run in Node/jsdom, not the browser matrix targeted by compat. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const exchangeAuthorizationCode = vi.fn();
const originalAppSessionSecret = process.env.APP_SESSION_SECRET;

vi.mock("../lib/server/oidc.server", () => ({
  exchangeAuthorizationCode,
}));

describe("auth callback loader", () => {
  beforeEach(() => {
    exchangeAuthorizationCode.mockReset();
    process.env.APP_SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
  });

  afterAll(() => {
    process.env.APP_SESSION_SECRET = originalAppSessionSecret;
  });

  it("removes transient OIDC values from the session after a successful login", async () => {
    exchangeAuthorizationCode.mockResolvedValue({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "Admin",
      oidcSubject: "oidc-subject-1",
    });

    const { loader } = await import("./auth.callback");
    const { getSession } = await import("../lib/server/session.server");

    const initialRequest = new Request("http://localhost/login");
    const initialSession = await getSession(initialRequest.headers.get("cookie"));
    initialSession.set("oidcVerifier", "verifier-1");
    initialSession.set("oidcState", "state-1");
    initialSession.set("oidcNonce", "nonce-1");

    const { commitSession } = await import("../lib/server/session.server");
    const cookie = await commitSession(initialSession);

    const response = await loader({
      context: {},
      params: {},
      request: new Request("http://localhost/auth/callback?code=test&state=state-1", {
        headers: {
          cookie,
        },
      }),
      unstable_pattern: "/auth/callback",
      unstable_url: new URL("http://localhost/auth/callback?code=test&state=state-1"),
    } as never);

    expect(exchangeAuthorizationCode).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        codeVerifier: "verifier-1",
        expectedNonce: "nonce-1",
        expectedState: "state-1",
      }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");

    const committedCookie = response.headers.get("Set-Cookie");
    expect(committedCookie).toBeTruthy();

    const committedSession = await getSession(committedCookie);
    expect(committedSession.get("systemAdminUser")).toStrictEqual({
      email: "admin@example.com",
      groups: ["superadmin"],
      label: "Admin",
      oidcSubject: "oidc-subject-1",
    });
    expect(committedSession.get("oidcVerifier")).toBeUndefined();
    expect(committedSession.get("oidcState")).toBeUndefined();
    expect(committedSession.get("oidcNonce")).toBeUndefined();
  });

  it("removes transient OIDC values and redirects to /login with an error on exchange failure", async () => {
    exchangeAuthorizationCode.mockRejectedValue(new Error("OIDC exchange failed"));

    const { loader } = await import("./auth.callback");
    const { commitSession, getSession } = await import("../lib/server/session.server");

    const initialRequest = new Request("http://localhost/login");
    const initialSession = await getSession(initialRequest.headers.get("cookie"));
    initialSession.set("oidcVerifier", "verifier-1");
    initialSession.set("oidcState", "state-1");
    initialSession.set("oidcNonce", "nonce-1");

    const cookie = await commitSession(initialSession);

    const response = await loader({
      context: {},
      params: {},
      request: new Request("http://localhost/auth/callback?code=test&state=state-1", {
        headers: {
          cookie,
        },
      }),
      unstable_pattern: "/auth/callback",
      unstable_url: new URL("http://localhost/auth/callback?code=test&state=state-1"),
    } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");

    const committedCookie = response.headers.get("Set-Cookie");
    expect(committedCookie).toBeTruthy();

    const committedSession = await getSession(committedCookie);
    expect(committedSession.get("oidcVerifier")).toBeUndefined();
    expect(committedSession.get("oidcState")).toBeUndefined();
    expect(committedSession.get("oidcNonce")).toBeUndefined();
    expect(committedSession.get("loginError")).toBe("loginFailed");
  });
});
