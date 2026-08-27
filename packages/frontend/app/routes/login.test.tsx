/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- Tests narrow thrown React Router responses and mocked values. */
import { afterEach, describe, expect, it } from "vitest";

const originalAppSessionSecret = process.env.APP_SESSION_SECRET;
const originalClientId = process.env.POCKET_ID_CLIENT_ID;
const originalIssuer = process.env.POCKET_ID_ISSUER;
const originalRedirectUri = process.env.POCKET_ID_REDIRECT_URI;
const originalNodeEnv = process.env.NODE_ENV;

describe("login loader", () => {
  afterEach(() => {
    process.env.APP_SESSION_SECRET = originalAppSessionSecret;
    process.env.POCKET_ID_CLIENT_ID = originalClientId;
    process.env.POCKET_ID_ISSUER = originalIssuer;
    process.env.POCKET_ID_REDIRECT_URI = originalRedirectUri;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("treats OIDC as not fully configured in production when POCKET_ID_REDIRECT_URI is missing", async () => {
    process.env.APP_SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
    process.env.NODE_ENV = "production";
    process.env.POCKET_ID_ISSUER = "https://pocket-id.example.com";
    process.env.POCKET_ID_CLIENT_ID = "mailer";
    delete process.env.POCKET_ID_REDIRECT_URI;

    const { loader } = await import("./login");

    await expect(
      loader({
        context: {},
        params: {},
        request: new Request("https://mailer.example.com/login"),
      } as never),
    ).resolves.toStrictEqual({ issuerConfigured: false, loginError: undefined });
  });

  it("allows local development without an explicit POCKET_ID_REDIRECT_URI", async () => {
    process.env.APP_SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
    process.env.NODE_ENV = "development";
    process.env.POCKET_ID_ISSUER = "https://pocket-id.example.com";
    process.env.POCKET_ID_CLIENT_ID = "mailer";
    delete process.env.POCKET_ID_REDIRECT_URI;

    const { loader } = await import("./login");

    await expect(
      loader({
        context: {},
        params: {},
        request: new Request("http://localhost:3000/login"),
      } as never),
    ).resolves.toStrictEqual({ issuerConfigured: true, loginError: undefined });
  });

  it("shows loginError only once and clears the flashed cookie afterwards", async () => {
    process.env.APP_SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
    process.env.NODE_ENV = "production";
    process.env.POCKET_ID_ISSUER = "https://pocket-id.example.com";
    process.env.POCKET_ID_CLIENT_ID = "mailer";
    process.env.POCKET_ID_REDIRECT_URI = "https://mailer.example.com/auth/callback";

    const { loader } = await import("./login");
    const { commitSession, getSession } = await import("../lib/server/session.server");

    const initialSession = await getSession(null);
    initialSession.flash("loginError", "loginFailed");

    const initialCookie = await commitSession(initialSession);

    const firstResponse = await loader({
      context: {},
      params: {},
      request: new Request("https://mailer.example.com/login", {
        headers: {
          cookie: initialCookie,
        },
      }),
    } as never);

    expect(firstResponse).toBeInstanceOf(Response);

    const firstPayload = await (firstResponse as Response).json();
    expect(firstPayload).toStrictEqual({
      issuerConfigured: true,
      loginError: "loginFailed",
    });

    const clearedCookie = (firstResponse as Response).headers.get("Set-Cookie");
    expect(clearedCookie).toBeTruthy();

    await expect(
      loader({
        context: {},
        params: {},
        request: new Request("https://mailer.example.com/login", {
          headers: {
            cookie: String(clearedCookie),
          },
        }),
      } as never),
    ).resolves.toStrictEqual({ issuerConfigured: true, loginError: undefined });
  });
});
