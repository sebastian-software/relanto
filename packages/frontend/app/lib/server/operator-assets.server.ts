import { accessSync, constants, statSync } from "node:fs";
import { resolve } from "node:path";

export const OPERATOR_ASSETS_DIRECTORY = "build/client/operator-assets";

export type OperatorAssets =
  | {
      enabled: false;
      faviconHref: "/favicon.svg";
      logoHref: null;
      stylesheetHref: null;
    }
  | {
      enabled: true;
      faviconHref: "/operator-assets/favicon.svg";
      logoHref: "/operator-assets/logo-software.svg";
      stylesheetHref: "/operator-assets/theme.css";
    };

const genericOperatorAssets: OperatorAssets = {
  enabled: false,
  faviconHref: "/favicon.svg",
  logoHref: null,
  stylesheetHref: null,
};

const enabledOperatorAssets: OperatorAssets = {
  enabled: true,
  faviconHref: "/operator-assets/favicon.svg",
  logoHref: "/operator-assets/logo-software.svg",
  stylesheetHref: "/operator-assets/theme.css",
};

const requiredOperatorAssetFiles = ["theme.css", "logo-software.svg", "favicon.svg"] as const;

function validateRequiredOperatorAssetFiles(): string[] {
  const errors: string[] = [];

  for (const fileName of requiredOperatorAssetFiles) {
    const relativePath = `${OPERATOR_ASSETS_DIRECTORY}/${fileName}`;
    const absolutePath = resolve(relativePath);

    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Der Pfad stammt aus der festen internen Dateiliste.
      if (!statSync(absolutePath).isFile()) {
        throw new TypeError("not a file");
      }
      accessSync(absolutePath, constants.R_OK);
    } catch {
      errors.push(`RELANTO_OPERATOR_ASSETS=true requires a readable file at ${relativePath}.`);
    }
  }

  return errors;
}

export function parseOperatorAssetsFlag(value: string | undefined): boolean {
  if (value === undefined || value === "false") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  throw new TypeError('RELANTO_OPERATOR_ASSETS must be either "false" or "true" when configured.');
}

export function getOperatorAssets(environment: NodeJS.ProcessEnv = process.env): OperatorAssets {
  return parseOperatorAssetsFlag(environment.RELANTO_OPERATOR_ASSETS)
    ? enabledOperatorAssets
    : genericOperatorAssets;
}

export function validateOperatorAssetsEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): string[] {
  let operatorAssets: OperatorAssets;

  try {
    operatorAssets = getOperatorAssets(environment);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  if (!operatorAssets.enabled || environment.NODE_ENV !== "production") {
    return [];
  }

  return validateRequiredOperatorAssetFiles();
}
