import { afterEach, describe, expect, it } from "vitest";

import { getAppSessionSecret } from "./session-secret.server";

const originalAppSessionSecret = process.env.APP_SESSION_SECRET;

describe("getAppSessionSecret", () => {
  afterEach(() => {
    process.env.APP_SESSION_SECRET = originalAppSessionSecret;
  });

  it("rejects missing APP_SESSION_SECRET", () => {
    delete process.env.APP_SESSION_SECRET;

    expect(() => getAppSessionSecret()).toThrow(
      "APP_SESSION_SECRET is required and must be a strong random secret.",
    );
  });

  it("rejects short APP_SESSION_SECRET values", () => {
    process.env.APP_SESSION_SECRET = "short-secret";

    expect(() => getAppSessionSecret()).toThrow(
      "APP_SESSION_SECRET must be at least 32 characters long.",
    );
  });

  it("rejects placeholder APP_SESSION_SECRET values", () => {
    process.env.APP_SESSION_SECRET = "__REPLACE_WITH_OPENSSL_RAND_HEX_32__";

    expect(() => getAppSessionSecret()).toThrow(
      "APP_SESSION_SECRET must not use a placeholder value. Generate a strong random secret.",
    );
  });

  it("accepts a strong random APP_SESSION_SECRET", () => {
    process.env.APP_SESSION_SECRET = "test-session-secret-with-at-least-32-chars";

    expect(getAppSessionSecret()).toBe("test-session-secret-with-at-least-32-chars");
  });
});
