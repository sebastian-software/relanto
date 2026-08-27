/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/only-throw-error, @typescript-eslint/strict-boolean-expressions -- Session and loader data cross React Router boundaries; throwing Response objects is framework control flow. */
import {
  authenticateAccessToken,
  type AuthenticatedToken,
  type TokenScope,
} from "@relanto/backend";
import { redirect, type Session } from "react-router";

import { logApiFailure, markResponseAsLogged } from "./api-failure-log.server";
import { ensureRuntimeStarted } from "./bootstrap.server";
import { getRequestPath } from "./request-path.server";
import { commitSession, destroySession, getSession } from "./session.server";

type SystemAdminUser = {
  email?: string;
  groups: string[];
  label: string;
  oidcSubject: string;
};

function getBearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  return header.slice("Bearer ".length).trim();
}

export async function getOptionalSystemAdminUser(
  request: Request,
): Promise<null | SystemAdminUser> {
  ensureRuntimeStarted();
  const session = await getSession(request.headers.get("cookie"));
  const rawUser = session.get("systemAdminUser");

  if (!rawUser) {
    return null;
  }

  return rawUser as SystemAdminUser;
}

export async function requireSystemAdminUser(request: Request): Promise<SystemAdminUser> {
  const user = await getOptionalSystemAdminUser(request);

  if (!user) {
    throw redirect("/login");
  }

  return user;
}

export async function createSystemAdminSession(
  request: Request,
  user: SystemAdminUser,
  session?: Session,
): Promise<Response> {
  ensureRuntimeStarted();
  const activeSession = session ?? (await getSession(request.headers.get("cookie")));

  activeSession.set("systemAdminUser", user satisfies SystemAdminUser);

  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(activeSession),
    },
  });
}

export async function destroySystemAdminSession(request: Request): Promise<Response> {
  ensureRuntimeStarted();
  const session = await getSession(request.headers.get("cookie"));

  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}

const SCOPE_MISSING_PREFIX = "Token is missing required scope";
const INVALID_TOKEN_MESSAGE = "Invalid or revoked token";
const SERVICE_UNAVAILABLE_MESSAGE = "Service temporarily unavailable";

function throwAuthenticationFailure(
  request: Request,
  error: unknown,
  requiredScope?: TokenScope,
): never {
  const message = error instanceof Error ? error.message : "Unauthorized";
  const isScopeMissing = message.startsWith(SCOPE_MISSING_PREFIX);
  const isCredentialFailure = isScopeMissing || message === INVALID_TOKEN_MESSAGE;

  // Only genuine credential or scope rejections are client authentication
  // failures. Any other error thrown during authentication — most notably an
  // infrastructure fault such as the `last_used_at` write failing against a
  // read-only database — must not masquerade as a 401/403 or leak its raw
  // message to the client. Surface it as a 503 with a generic body while the
  // concrete cause stays in the server-side failure log.
  if (!isCredentialFailure) {
    logApiFailure({
      method: request.method,
      path: getRequestPath(request),
      reasonCategory: "other",
      reasonMessage: message,
      status: 503,
    });

    throw markResponseAsLogged(
      Response.json({ error: SERVICE_UNAVAILABLE_MESSAGE }, { status: 503 }),
    );
  }

  // Authenticated but not authorized (valid token lacking the scope) is a 403,
  // just like ownership violations. Only truly invalid credentials stay 401 so
  // clients following the retry-on-401 guidance do not loop pointlessly.
  const status = isScopeMissing ? 403 : 401;

  logApiFailure({
    details: isScopeMissing && requiredScope ? { expectedScope: requiredScope } : undefined,
    method: request.method,
    path: getRequestPath(request),
    reasonCategory: isScopeMissing ? "scope_missing" : "auth_invalid",
    reasonMessage: message,
    status,
  });

  throw markResponseAsLogged(Response.json({ error: message }, { status }));
}

export async function requireApiAccess(
  request: Request,
  requiredScope?: TokenScope,
): Promise<
  { kind: "systemAdmin"; principalId: string } | { kind: "token"; token: AuthenticatedToken }
> {
  const systemAdmin = await getOptionalSystemAdminUser(request);

  if (systemAdmin) {
    return { kind: "systemAdmin", principalId: systemAdmin.oidcSubject };
  }

  const bearerToken = getBearerToken(request);

  if (!bearerToken) {
    logApiFailure({
      method: request.method,
      path: getRequestPath(request),
      reasonCategory: "auth_missing",
      reasonMessage: "Missing authorization",
      status: 401,
    });
    throw markResponseAsLogged(Response.json({ error: "Missing authorization" }, { status: 401 }));
  }

  try {
    return {
      kind: "token",
      token: authenticateAccessToken(bearerToken, requiredScope),
    };
  } catch (error) {
    throwAuthenticationFailure(request, error, requiredScope);
  }
}
