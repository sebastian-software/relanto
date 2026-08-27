/* oxlint-disable no-magic-numbers, regexp/require-unicode-sets-regexp, require-unicode-regexp -- Test literals and ASCII source-scanning regexes are intentional. */
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion, prefer-named-capture-group, regexp/require-unicode-sets-regexp, require-unicode-regexp, security/detect-non-literal-fs-filename, security/detect-unsafe-regex -- This test scans route source files with ASCII regexes and reads them by computed path. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "./generate.js";
import { operations } from "./registry.js";

const HTTP_METHODS = ["get", "post", "put", "delete", "patch"] as const;

const openapiPath = fileURLToPath(new URL("../../openapi.json", import.meta.url));
const routesPath = fileURLToPath(new URL("../../../frontend/app/routes.ts", import.meta.url));
const routesDir = fileURLToPath(new URL("../../../frontend/app/routes/", import.meta.url));

type RouteEntry = { file: string; openApiPath: string };

// Extracts the API-relevant route entries from `routes.ts`, converting the
// React Router `:param` syntax to the OpenAPI `{param}` syntax.
function readRouteEntries(): RouteEntry[] {
  const source = readFileSync(routesPath, "utf8");
  const routeRegex = /route\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
  const entries: RouteEntry[] = [];

  for (let match = routeRegex.exec(source); match !== null; match = routeRegex.exec(source)) {
    const [, routePath, file] = match;

    if (!routePath.startsWith("api/v1/") && routePath !== "health" && routePath !== "metrics") {
      continue;
    }

    const openApiPath = `/${routePath.replaceAll(/:(\w+)/g, "{$1}")}`;
    entries.push({ file, openApiPath });
  }

  return entries;
}

// Derives the HTTP methods a React Router resource route actually serves from
// its source. A `loader`/`action` wired to `methodNotAllowedHandler` is a
// rejection stub and serves no real method; a real `action` serves the verb it
// enforces via `requireMethod`, and a real `loader` serves `GET`.
function deriveHandlerMethods(source: string): Set<string> {
  const methods = new Set<string>();

  const loaderStub = /export const loader\s*=\s*methodNotAllowedHandler\(/.test(source);
  const loaderFn = /export\s+(?:async\s+)?function\s+loader\b/.test(source);
  const loaderConst = /export const loader\s*=/.test(source);

  if (loaderFn || (loaderConst && !loaderStub)) {
    methods.add("get");
  }

  const actionStub = /export const action\s*=\s*methodNotAllowedHandler\(/.test(source);
  const actionFn = /export\s+(?:async\s+)?function\s+action\b/.test(source);
  const actionConst = /export const action\s*=/.test(source);

  if (actionFn || (actionConst && !actionStub)) {
    const verb = /requireMethod\(\s*request\s*,\s*"([A-Z]+)"/.exec(source);

    if (verb) {
      methods.add(verb[1].toLowerCase());
    }
  }

  return methods;
}

function specMethodsByPath(): Map<string, Set<string>> {
  const document = buildOpenApiDocument();
  const paths = document.paths as Record<string, Record<string, unknown>>;
  const byPath = new Map<string, Set<string>>();

  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = new Set(HTTP_METHODS.filter((method) => method in pathItem));
    byPath.set(path, methods);
  }

  return byPath;
}

function expectedMethodsByPath(): Map<string, Set<string>> {
  const byPath = new Map<string, Set<string>>();

  for (const entry of readRouteEntries()) {
    const source = readFileSync(`${routesDir}${entry.file.replace("routes/", "")}`, "utf8");
    const methods = deriveHandlerMethods(source);
    const existing = byPath.get(entry.openApiPath) ?? new Set<string>();

    for (const method of methods) {
      existing.add(method);
    }

    byPath.set(entry.openApiPath, existing);
  }

  return byPath;
}

// Reduces a path→methods map to a plain, sorted object so two route views can be
// compared with a single deep-equality assertion (no branching in the test).
function toComparableMethodMap(map: Map<string, Set<string>>): Record<string, string[]> {
  const comparable: Record<string, string[]> = {};

  for (const [path, methods] of map) {
    comparable[path] = [...methods].sort();
  }

  return comparable;
}

describe("openapi spec", () => {
  it("matches the committed openapi.json (freshness)", () => {
    // Compare parsed content, not raw bytes: the committed file is formatted by
    // oxfmt (which e.g. collapses short arrays onto one line), so a byte compare
    // against the generator's serialization would fail on formatting alone. The
    // content must still match the code exactly.
    const committed: unknown = JSON.parse(readFileSync(openapiPath, "utf8"));
    const regenerated = buildOpenApiDocument();

    expect(regenerated).toStrictEqual(committed);
  });

  it("declares a valid OpenAPI 3.1 document with all 27 operations", () => {
    const document = buildOpenApiDocument();

    expect(document.openapi).toBe("3.1.1");

    const operationCount = operations.length;
    expect(operationCount).toBe(27);

    const specOperationCount = [...specMethodsByPath().values()].reduce(
      (sum, methods) => sum + methods.size,
      0,
    );
    expect(specOperationCount).toBe(27);
  });

  it("covers exactly the routes declared in routes.ts (both directions)", () => {
    const expected = toComparableMethodMap(expectedMethodsByPath());
    const actual = toComparableMethodMap(specMethodsByPath());

    // A single deep-equality check enforces coverage in both directions: a
    // missing/extra path or method on either side fails the comparison.
    expect(actual).toStrictEqual(expected);
  });

  it("gives every operation an operationId, security, and documented status codes", () => {
    for (const operation of operations) {
      expect(operation.operationId).toMatch(/^[a-z][A-Za-z]+$/);
      expect(["bearer", "none"]).toContain(operation.security);
      expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
    }
  });
});
