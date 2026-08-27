/* eslint-disable @typescript-eslint/strict-boolean-expressions -- Session secrets come from process.env and intentionally treat empty strings as missing. */
const MINIMUM_SECRET_LENGTH = 32;
const PLACEHOLDER_MARKERS = [
  "replace",
  "changeme",
  "placeholder",
  "example",
  "generate",
  "developmentonlysecretchangeme",
  "developmentonlysessionsecretchangeme",
];

function isAsciiLetterOrDigit(character: string): boolean {
  return (character >= "a" && character <= "z") || (character >= "0" && character <= "9");
}

function looksLikePlaceholderSecret(secret: string): boolean {
  const normalized = Array.from(secret.trim().toLowerCase())
    .filter((character) => isAsciiLetterOrDigit(character))
    .join("");
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

export function getAppSessionSecret(): string {
  const configured = process.env.APP_SESSION_SECRET?.trim();

  if (!configured) {
    throw new Error("APP_SESSION_SECRET is required and must be a strong random secret.");
  }

  if (configured.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("APP_SESSION_SECRET must be at least 32 characters long.");
  }

  if (looksLikePlaceholderSecret(configured)) {
    throw new Error(
      "APP_SESSION_SECRET must not use a placeholder value. Generate a strong random secret.",
    );
  }

  return configured;
}
