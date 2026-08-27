/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- Tests narrow thrown React Router responses and mocked values. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { originalAppSessionSecret } = vi.hoisted(() => {
  const original = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
  return { originalAppSessionSecret: original };
});

vi.mock("../lib/server/bootstrap.server", () => ({
  ensureRuntimeStarted: () => undefined,
}));

describe("logout route", () => {
  afterAll(() => {
    process.env.APP_SESSION_SECRET = originalAppSessionSecret;
  });

  describe("loader", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("redirects GET /logout to /login without destroying the session", async () => {
      const { loader } = await import("./logout");
      const { commitSession, getSession } = await import("../lib/server/session.server");

      // Set up a session with a logged-in user.
      const session = await getSession(null);
      session.set("systemAdminUser", {
        email: "admin@example.com",
        groups: ["superadmin"],
        label: "Admin",
        oidcSubject: "oidc-subject-1",
      });
      const cookie = await commitSession(session);

      const response = loader({
        context: {},
        params: {},
        request: new Request("https://mailer.example.com/logout", {
          headers: { cookie },
          method: "GET",
        }),
      } as never);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");

      // The loader must not emit a Set-Cookie header — the session stays intact.
      expect(response.headers.get("Set-Cookie")).toBeNull();

      // Verify the original session cookie still contains the user.
      const originalSession = await getSession(cookie);
      expect(originalSession.get("systemAdminUser")).toMatchObject({
        email: "admin@example.com",
      });
    });
  });

  describe("action", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("destroys the session on POST /logout and redirects to /login", async () => {
      const { action } = await import("./logout");
      const { commitSession, getSession } = await import("../lib/server/session.server");

      // Set up a session with a logged-in user.
      const session = await getSession(null);
      session.set("systemAdminUser", {
        email: "admin@example.com",
        groups: ["superadmin"],
        label: "Admin",
        oidcSubject: "oidc-subject-1",
      });
      const cookie = await commitSession(session);

      const response = await action({
        context: {},
        params: {},
        request: new Request("https://mailer.example.com/logout", {
          headers: { cookie },
          method: "POST",
        }),
      } as never);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");

      // The action must emit a Set-Cookie header that clears the session.
      const setCookie = response.headers.get("Set-Cookie");
      expect(setCookie).toBeTruthy();

      // After applying the cleared cookie the session should have no user.
      const clearedSession = await getSession(setCookie);
      expect(clearedSession.get("systemAdminUser")).toBeUndefined();
    });

    it("rejects non-POST methods with 405", async () => {
      const { action } = await import("./logout");

      await expect(
        action({
          context: {},
          params: {},
          request: new Request("https://mailer.example.com/logout", {
            method: "GET",
          }),
        } as never),
      ).rejects.toBeInstanceOf(Response);
    });
  });
});
