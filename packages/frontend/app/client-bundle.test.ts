/* eslint-disable security/detect-non-literal-fs-filename, security/detect-non-literal-regexp -- The recursive inventory and generated palette matchers are constrained to fixed local constants. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = resolve("app");
const buildDirectory = resolve("build");
const clientBuildDirectory = resolve(buildDirectory, "client");
const serverBuildDirectory = resolve(buildDirectory, "server");
const hasStandardBuild = existsSync(clientBuildDirectory) && existsSync(serverBuildDirectory);

function listFilesRecursively(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return listFilesRecursively(entryPath);
    }

    return entry.isFile() ? [entryPath] : [];
  });
}

const standardOutputFiles = hasStandardBuild
  ? [clientBuildDirectory, serverBuildDirectory].flatMap((directory) =>
      listFilesRecursively(directory),
    )
  : [];
const clientJavaScriptAssets = standardOutputFiles.filter(
  (filePath) => filePath.startsWith(`${clientBuildDirectory}${sep}`) && filePath.endsWith(".js"),
);
const executableSourceExtensions = new Set([
  ".cjs",
  ".css",
  ".js",
  ".jsx",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
]);
const executableSourceFiles = listFilesRecursively(sourceDirectory).filter((filePath) =>
  executableSourceExtensions.has(extname(filePath)),
);

const retiredPaletteChannels = [
  { blue: 0xcc, green: 0xaf, red: 0x38 },
  { blue: 0x64, green: 0x51, red: 0x00 },
  { blue: 0x31, green: 0x27, red: 0x00 },
  { blue: 0xf3, green: 0xf0, red: 0xe7 },
] as const;
const retiredPaletteMatchers = retiredPaletteChannels.flatMap(({ blue, green, red }) => {
  const channelSeparator = String.raw`(?:\s*,\s*|\s+)`;
  const rgbMatcher = new RegExp(
    String.raw`rgba?\(\s*${red}${channelSeparator}${green}${channelSeparator}${blue}(?=\s*(?:[,/) ]))`,
    "iu",
  );
  const hexValue = [red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");
  const hexMatcher = new RegExp(String.raw`#${hexValue}(?:[0-9a-f]{2})?\b`, "iu");

  return [rgbMatcher, hexMatcher];
});

function relativeBuildPaths(filePaths: string[]): string[] {
  return filePaths.map((filePath) => relative(buildDirectory, filePath)).sort();
}

function filesContainingRetiredPalette(filePaths: string[]): string[] {
  return filePaths.filter((filePath) => {
    const contents = readFileSync(filePath, "utf8");
    return retiredPaletteMatchers.some((matcher) => matcher.test(contents));
  });
}

describe("frontend source boundary", () => {
  it("contains no retired palette values in executable source", () => {
    const offendingFiles = filesContainingRetiredPalette(executableSourceFiles);

    expect(
      offendingFiles.map((filePath) => relative(sourceDirectory, filePath)).sort(),
    ).toStrictEqual([]);
  });
});

describe.skipIf(!hasStandardBuild)("standard frontend build boundary", () => {
  it("contains no retired palette values in standard output", () => {
    const offendingFiles = filesContainingRetiredPalette(standardOutputFiles);

    expect(relativeBuildPaths(offendingFiles)).toStrictEqual([]);
  });

  it("does not ship backend-only dependencies to the browser", () => {
    const backendOnlyMarkers = [
      "better-sqlite3",
      "better_sqlite3",
      "nodemailer",
      "createTransport",
    ];

    const offendingAssets = clientJavaScriptAssets.filter((filePath) => {
      const contents = readFileSync(filePath, "utf8");
      return backendOnlyMarkers.some((marker) => contents.includes(marker));
    });

    expect(relativeBuildPaths(offendingAssets)).toStrictEqual([]);
  });

  it("contains no font binaries in recursive client or server output", () => {
    const fontBinaryExtensions = [".otf", ".ttf", ".woff", ".woff2"];
    const fontBinaries = standardOutputFiles.filter((filePath) => {
      const normalizedPath = filePath.toLowerCase();
      return fontBinaryExtensions.some((extension) => normalizedPath.endsWith(extension));
    });

    expect(relativeBuildPaths(fontBinaries)).toStrictEqual([]);
  });

  it("contains no private package or proprietary font-family markers", () => {
    // The TypeScript target does not yet support the preferred `v` flag.
    /* eslint-disable regexp/require-unicode-sets-regexp */
    const forbiddenPatterns = [
      new RegExp(["@", "[\\w.\\x2d]+", "/assets"].join(""), "u"),
      new RegExp(["(?:Sa", "ns|Ser", "if|Sl", "ab)"].join(""), "u"),
    ];
    /* eslint-enable regexp/require-unicode-sets-regexp */
    const offendingFiles = standardOutputFiles.filter((filePath) => {
      const contents = readFileSync(filePath, "utf8");
      return forbiddenPatterns.some((pattern) => pattern.test(contents));
    });

    expect(relativeBuildPaths(offendingFiles)).toStrictEqual([]);
  });

  it("does not create an operator-assets path in the standard output", () => {
    const operatorAssetFiles = standardOutputFiles.filter((filePath) =>
      relative(buildDirectory, filePath).split(sep).includes("operator-assets"),
    );

    expect(relativeBuildPaths(operatorAssetFiles)).toStrictEqual([]);
  });
});
