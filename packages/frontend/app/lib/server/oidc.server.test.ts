/* eslint-disable compat/compat -- Tests run in Node/jsdom, not the browser matrix targeted by compat. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buildAuthorizationUrl = vi.fn();
const calculatePKCECodeChallenge = vi.fn();
const discovery = vi.fn();
const randomNonce = vi.fn();
const randomPKCECodeVerifier = vi.fn();
const randomState = vi.fn();

vi.mock("openid-client", () => ({
  authorizationCodeGrant: vi.fn(),
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  ClientSecretPost: vi.fn(() => "client-secret-post"),
  discovery,
  None: vi.fn(() => "none"),
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
}));

const originalClientId = process.env.POCKET_ID_CLIENT_ID;
const originalIssuer = process.env.POCKET_ID_ISSUER;
const originalRedirectUri = process.env.POCKET_ID_REDIRECT_URI;
const originalNodeEnv = process.env.NODE_ENV;

describe("OIDC redirect URI configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    buildAuthorizationUrl.mockReset();
    calculatePKCECodeChallenge.mockReset();
    discovery.mockReset();
    randomNonce.mockReset();
    randomPKCECodeVerifier.mockReset();
    randomState.mockReset();

    process.env.POCKET_ID_ISSUER = "https://pocket-id.example.com";
    process.env.POCKET_ID_CLIENT_ID = "mailer";
    calculatePKCECodeChallenge.mockResolvedValue("challenge-1");
    discovery.mockResolvedValue({ issuer: "https://pocket-id.example.com" });
    randomNonce.mockReturnValue("nonce-1");
    randomPKCECodeVerifier.mockReturnValue("verifier-1");
    randomState.mockReturnValue("state-1");
    buildAuthorizationUrl.mockReturnValue(new URL("https://pocket-id.example.com/auth"));
  });

  afterEach(() => {
    process.env.POCKET_ID_CLIENT_ID = originalClientId;
    process.env.POCKET_ID_ISSUER = originalIssuer;
    process.env.POCKET_ID_REDIRECT_URI = originalRedirectUri;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("allows deriving the redirect URI from request.url in local development", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.POCKET_ID_REDIRECT_URI;

    const { buildLoginUrl } = await import("./oidc.server");

    await buildLoginUrl(new Request("http://localhost:3000/login"));

    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        redirect_uri: "http://localhost:3000/auth/callback",
      }),
    );
  });

  it("fails closed outside local development when POCKET_ID_REDIRECT_URI is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.POCKET_ID_REDIRECT_URI;

    const { buildLoginUrl } = await import("./oidc.server");

    await expect(buildLoginUrl(new Request("https://attacker.example/login"))).rejects.toThrow(
      "POCKET_ID_REDIRECT_URI is required outside local development. Configure the canonical OIDC callback URL explicitly.",
    );
  });

  it("uses the configured POCKET_ID_REDIRECT_URI outside local development", async () => {
    process.env.NODE_ENV = "production";
    process.env.POCKET_ID_REDIRECT_URI = "https://mailer.example.com/auth/callback";

    const { buildLoginUrl } = await import("./oidc.server");

    await buildLoginUrl(new Request("https://ignored.example/login"));

    expect(buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        redirect_uri: "https://mailer.example.com/auth/callback",
      }),
    );
  });
});
