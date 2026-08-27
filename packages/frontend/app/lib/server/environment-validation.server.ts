import { assertMailerDbPathConfigured, getMailerSecret } from "@relanto/backend";

import { validateOidcEnvironment } from "./oidc.server";
import { validateOperatorAssetsEnvironment } from "./operator-assets.server";
import { getAppSessionSecret } from "./session-secret.server";

function collectError(errors: string[], validate: () => unknown): void {
  try {
    validate();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Validate every environment variable that must be present and well-formed for
 * the server to boot into a working state. Reuses the existing per-variable
 * validation rules (minimum secret length, placeholder detection,
 * required-outside-local-development checks) instead of duplicating them.
 *
 * This function is intentionally side-effect free: it never calls
 * `process.exit`, so it can be exercised directly from tests. The fail-fast
 * boot behavior (printing the errors and exiting) lives in the production boot
 * entry point (`serverStartup.mjs`).
 *
 * @returns A list of human-readable problems. An empty list means the required
 *   environment is complete and valid.
 */
export function validateRequiredEnvironment(): string[] {
  const errors: string[] = [];

  // Always required, regardless of environment.
  collectError(errors, getMailerSecret);
  collectError(errors, getAppSessionSecret);

  // Required only outside local development (persistent database path).
  collectError(errors, assertMailerDbPathConfigured);

  // OIDC is the only system-admin authentication mechanism, so issuer and
  // client id are always required; the redirect URI is required outside local
  // development.
  errors.push(...validateOidcEnvironment());
  errors.push(...validateOperatorAssetsEnvironment());

  return errors;
}
