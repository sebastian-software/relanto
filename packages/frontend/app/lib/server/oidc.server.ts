/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/strict-boolean-expressions, compat/compat, complexity, no-nested-ternary, require-atomic-updates -- OIDC code is server-only framework glue; URL support and cached discovery are controlled by the Node runtime. */
import * as client from "openid-client";

type SystemAdminUser = {
  email?: string;
  groups: string[];
  label: string;
  oidcSubject: string;
};

let cachedConfiguration: client.Configuration | undefined;

function isLocalDevelopmentMode(): boolean {
  return process.env.NODE_ENV === "development";
}

function getIssuerUrl(): URL {
  const issuer = process.env.POCKET_ID_ISSUER;

  if (!issuer) {
    throw new Error("POCKET_ID_ISSUER is not configured");
  }

  return new URL(issuer);
}

function getClientId(): string {
  const clientId = process.env.POCKET_ID_CLIENT_ID;

  if (!clientId) {
    throw new Error("POCKET_ID_CLIENT_ID is not configured");
  }

  return clientId;
}

function assertRedirectUriConfiguredOutsideDevelopment(): void {
  if (!process.env.POCKET_ID_REDIRECT_URI?.trim() && !isLocalDevelopmentMode()) {
    throw new Error(
      "POCKET_ID_REDIRECT_URI is required outside local development. Configure the canonical OIDC callback URL explicitly.",
    );
  }
}

function getRedirectUri(request: Request): string {
  const configured = process.env.POCKET_ID_REDIRECT_URI?.trim();

  if (configured) {
    return configured;
  }

  assertRedirectUriConfiguredOutsideDevelopment();

  return new URL("/auth/callback", request.url).toString();
}

function collectOidcError(errors: string[], validate: () => unknown): void {
  try {
    validate();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

function validateIssuerEnvironment(errors: string[]): void {
  try {
    getIssuerUrl();
  } catch (error) {
    const issuer = process.env.POCKET_ID_ISSUER?.trim();

    if (issuer) {
      errors.push(`POCKET_ID_ISSUER must be a valid URL: ${issuer}`);
    } else {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * Validate the OIDC-related environment variables that must be present for the
 * login flow to work. Returns a list of human-readable problems (empty when the
 * configuration is complete) without throwing, so it can be used in a
 * fail-fast boot check as well as in tests.
 */
export function validateOidcEnvironment(): string[] {
  const errors: string[] = [];

  validateIssuerEnvironment(errors);
  collectOidcError(errors, getClientId);
  collectOidcError(errors, assertRedirectUriConfiguredOutsideDevelopment);

  return errors;
}

function getGroupsClaimName(): string {
  return process.env.POCKET_ID_GROUPS_CLAIM || "groups";
}

function getRequiredAdminGroup(): string {
  return process.env.POCKET_ID_REQUIRED_GROUP || "superadmin";
}

export async function getOidcConfiguration(): Promise<client.Configuration> {
  if (!cachedConfiguration) {
    const clientSecret = process.env.POCKET_ID_CLIENT_SECRET;
    const clientAuth = clientSecret ? client.ClientSecretPost(clientSecret) : client.None();

    cachedConfiguration = await client.discovery(
      getIssuerUrl(),
      getClientId(),
      undefined,
      clientAuth,
    );
  }

  return cachedConfiguration;
}

export async function buildLoginUrl(request: Request): Promise<{
  codeVerifier: string;
  nonce: string;
  redirectTo: string;
  state: string;
}> {
  const configuration = await getOidcConfiguration();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const nonce = client.randomNonce();
  const state = client.randomState();

  const redirectTo = client.buildAuthorizationUrl(configuration, {
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    nonce,
    redirect_uri: getRedirectUri(request),
    scope: "openid profile email groups",
    state,
  });

  return {
    codeVerifier,
    nonce,
    redirectTo: redirectTo.toString(),
    state,
  };
}

export async function exchangeAuthorizationCode(
  request: Request,
  options: {
    codeVerifier: string;
    expectedNonce: string;
    expectedState: string;
  },
): Promise<SystemAdminUser> {
  const configuration = await getOidcConfiguration();
  const tokens = await client.authorizationCodeGrant(configuration, request, {
    expectedNonce: options.expectedNonce,
    expectedState: options.expectedState,
    pkceCodeVerifier: options.codeVerifier,
  });
  const claims = tokens.claims();

  if (!claims?.sub) {
    throw new Error("OIDC claims did not include a subject");
  }

  const groupsClaim = getGroupsClaimName();
  const groupsValue = claims[groupsClaim];
  const groups = Array.isArray(groupsValue)
    ? groupsValue.map((entry) => String(entry))
    : groupsValue
      ? [String(groupsValue)]
      : [];

  const requiredGroup = getRequiredAdminGroup();

  if (!groups.includes(requiredGroup)) {
    throw new Error(`Authenticated user is not a member of the ${requiredGroup} group`);
  }

  const label =
    (typeof claims.name === "string" && claims.name) ||
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    (typeof claims.email === "string" && claims.email) ||
    claims.sub;

  return {
    email: typeof claims.email === "string" ? claims.email : undefined,
    groups,
    label,
    oidcSubject: claims.sub,
  };
}
