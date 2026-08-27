/* eslint-disable security/detect-non-literal-fs-filename -- Every dynamic path stays below an isolated test-only temporary directory. */
import { chmodSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getOperatorAssets,
  OPERATOR_ASSETS_DIRECTORY,
  parseOperatorAssetsFlag,
  validateOperatorAssetsEnvironment,
} from "./operator-assets.server";

const REQUIRED_OPERATOR_ASSET_FILES = ["theme.css", "logo-software.svg", "favicon.svg"] as const;
const INVALID_FLAG_MESSAGE =
  'RELANTO_OPERATOR_ASSETS must be either "false" or "true" when configured.';
const originalWorkingDirectory = process.cwd();

describe("parseOperatorAssetsFlag", () => {
  it.each([
    [undefined, false],
    ["false", false],
    ["true", true],
  ] as const)("parses %j as %j", (value, expected) => {
    expect(parseOperatorAssetsFlag(value)).toBe(expected);
  });

  it.each(["", "TRUE", "False", " true ", "0", "1", "yes"])(
    "rejects malformed value %j",
    (value) => {
      expect(() => parseOperatorAssetsFlag(value)).toThrow(INVALID_FLAG_MESSAGE);
    },
  );
});

describe("getOperatorAssets", () => {
  it("returns only generic fixed assets when disabled", () => {
    expect(getOperatorAssets({ RELANTO_OPERATOR_ASSETS: "false" })).toStrictEqual({
      enabled: false,
      faviconHref: "/favicon.svg",
      logoHref: null,
      stylesheetHref: null,
    });
  });

  it("returns only fixed same-origin operator assets when enabled", () => {
    expect(getOperatorAssets({ RELANTO_OPERATOR_ASSETS: "true" })).toStrictEqual({
      enabled: true,
      faviconHref: "/operator-assets/favicon.svg",
      logoHref: "/operator-assets/logo-software.svg",
      stylesheetHref: "/operator-assets/theme.css",
    });
  });
});

describe("validateOperatorAssetsEnvironment", () => {
  let temporaryDirectory: string;

  function operatorAssetPath(fileName: (typeof REQUIRED_OPERATOR_ASSET_FILES)[number]): string {
    return join(temporaryDirectory, OPERATOR_ASSETS_DIRECTORY, fileName);
  }

  function createCompleteTestOverlay(): void {
    mkdirSync(join(temporaryDirectory, OPERATOR_ASSETS_DIRECTORY), { recursive: true });
    writeFileSync(operatorAssetPath("theme.css"), ":root { --relanto-font-body: system-ui; }");
    writeFileSync(
      operatorAssetPath("logo-software.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" />',
    );
    writeFileSync(operatorAssetPath("favicon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" />');
  }

  function expectedFileError(fileName: (typeof REQUIRED_OPERATOR_ASSET_FILES)[number]): string {
    return `RELANTO_OPERATOR_ASSETS=true requires a readable file at ${OPERATOR_ASSETS_DIRECTORY}/${fileName}.`;
  }

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "relanto-operator-assets-"));
    process.chdir(temporaryDirectory);
  });

  afterEach(() => {
    process.chdir(originalWorkingDirectory);
    rmSync(temporaryDirectory, { force: true, recursive: true });
  });

  it("accepts a complete production overlay made from non-private test fixtures", () => {
    createCompleteTestOverlay();

    expect(
      validateOperatorAssetsEnvironment({
        NODE_ENV: "production",
        RELANTO_OPERATOR_ASSETS: "true",
      }),
    ).toStrictEqual([]);
  });

  it.each(REQUIRED_OPERATOR_ASSET_FILES)(
    "rejects a production overlay when %s is missing",
    (fileName) => {
      createCompleteTestOverlay();
      unlinkSync(operatorAssetPath(fileName));

      expect(
        validateOperatorAssetsEnvironment({
          NODE_ENV: "production",
          RELANTO_OPERATOR_ASSETS: "true",
        }),
      ).toStrictEqual([expectedFileError(fileName)]);
    },
  );

  it.each(REQUIRED_OPERATOR_ASSET_FILES)(
    "rejects a production overlay when %s is unreadable",
    (fileName) => {
      createCompleteTestOverlay();
      chmodSync(operatorAssetPath(fileName), 0o000);

      expect(
        validateOperatorAssetsEnvironment({
          NODE_ENV: "production",
          RELANTO_OPERATOR_ASSETS: "true",
        }),
      ).toStrictEqual([expectedFileError(fileName)]);
    },
  );

  it.each(REQUIRED_OPERATOR_ASSET_FILES)(
    "rejects a production overlay when %s is not a file",
    (fileName) => {
      createCompleteTestOverlay();
      unlinkSync(operatorAssetPath(fileName));
      mkdirSync(operatorAssetPath(fileName));

      expect(
        validateOperatorAssetsEnvironment({
          NODE_ENV: "production",
          RELANTO_OPERATOR_ASSETS: "true",
        }),
      ).toStrictEqual([expectedFileError(fileName)]);
    },
  );
});
