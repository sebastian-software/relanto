/* eslint-disable @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/strict-boolean-expressions -- Build metadata uses empty-string fallback semantics from process.env. */
import frontendPackage from "../../../package.json";

const COPYRIGHT_START_YEAR = 2026;
const FALLBACK_GIT_HASH = "dev";

export function getShortGitHash(
  environment: NodeJS.ProcessEnv = process.env,
  fallback = FALLBACK_GIT_HASH,
): string {
  const configured = environment.RELANTO_GIT_SHORT_SHA?.trim() || environment.GITHUB_SHA?.trim();

  if (!configured) {
    return fallback;
  }

  return configured.slice(0, 7);
}

export function getBuildLabel(environment: NodeJS.ProcessEnv = process.env): string {
  return `v${frontendPackage.version}-${getShortGitHash(environment)}`;
}

export function getCopyrightLabel(currentYear = new Date().getFullYear()): string {
  if (currentYear > COPYRIGHT_START_YEAR) {
    return `Copyright ${COPYRIGHT_START_YEAR}-${currentYear} Sebastian Software GmbH`;
  }

  return `Copyright ${COPYRIGHT_START_YEAR} Sebastian Software GmbH`;
}
