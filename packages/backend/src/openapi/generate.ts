import { z } from "zod";

import {
  type ApiOperation,
  operations,
  requestComponentSchemas,
  responseComponentSchemas,
} from "./registry.js";

const JSON_SCHEMA_TARGET = "draft-2020-12";

/** A plain JSON object as produced by the JSON Schema conversion. */
type JsonObject = Record<string, unknown>;

// Converts a set of named Zod schemas into JSON Schema objects, referencing
// each other via `#/components/schemas/<id>`. Zod emits `$schema`/`$id` on each
// root; both are stripped so the results embed cleanly under
// `components.schemas`.
function convertComponents(
  schemas: Record<string, z.ZodType>,
  io: "input" | "output",
): Record<string, JsonObject> {
  const registry = z.registry<{ id?: string }>();

  for (const [id, schema] of Object.entries(schemas)) {
    registry.add(schema, { id });
  }

  const { schemas: converted } = z.toJSONSchema(registry, {
    io,
    target: JSON_SCHEMA_TARGET,
    uri: (id) => `#/components/schemas/${id}`,
  });

  const result: Record<string, JsonObject> = {};

  for (const [id, schema] of Object.entries(converted)) {
    const { $id: _id, $schema: _schema, ...rest } = schema as JsonObject;
    result[id] = rest;
  }

  return result;
}

// Merges the input- and output-view component schemas. Shared enums are emitted
// by both views; they must be byte-identical, otherwise a name collision would
// silently drop one variant.
function buildComponentSchemas(): Record<string, JsonObject> {
  const outputSchemas = convertComponents(responseComponentSchemas, "output");
  const inputSchemas = convertComponents(requestComponentSchemas, "input");
  const merged: Record<string, JsonObject> = { ...outputSchemas };

  for (const [id, schema] of Object.entries(inputSchemas)) {
    if (Object.hasOwn(merged, id) && JSON.stringify(merged[id]) !== JSON.stringify(schema)) {
      throw new Error(
        `Component schema "${id}" differs between the input and output views; give the variants distinct names.`,
      );
    }

    merged[id] = schema;
  }

  return merged;
}

function schemaReference(name: string): JsonObject {
  return { $ref: `#/components/schemas/${name}` };
}

function jsonBody(schemaName: string): JsonObject {
  return { content: { "application/json": { schema: schemaReference(schemaName) } } };
}

function buildResponses(operation: ApiOperation): JsonObject {
  const responses: JsonObject = {};

  for (const [status, response] of Object.entries(operation.responses)) {
    responses[status] = {
      description: response.description,
      ...jsonBody(response.schema),
    };
  }

  return responses;
}

function operationDescription(operation: ApiOperation): string {
  if (operation.scope !== null) {
    return `${operation.description} Requires the \`${operation.scope}\` scope.`;
  }

  return operation.description;
}

function buildOperationObject(operation: ApiOperation): JsonObject {
  const object: JsonObject = {
    description: operationDescription(operation),
    operationId: operation.operationId,
    responses: buildResponses(operation),
    security: operation.security === "none" ? [] : [{ bearerAuth: [] }],
    summary: operation.summary,
    tags: operation.tags,
  };

  if (operation.parameters) {
    object.parameters = operation.parameters;
  }

  if (operation.requestBody !== undefined) {
    object.requestBody = { required: true, ...jsonBody(operation.requestBody) };
  }

  return object;
}

function buildPaths(): JsonObject {
  const paths: Record<string, JsonObject> = {};

  for (const operation of operations) {
    paths[operation.path] ??= {};
    paths[operation.path][operation.method] = buildOperationObject(operation);
  }

  return paths;
}

// Stable version of the API contract this document describes. Deliberately
// decoupled from the npm package version: `info.version` denotes the API/spec
// version (the surface is served under `/api/v1`), and a package patch bump
// must not require regenerating the committed spec — otherwise a release PR
// that only bumps the version would fail the freshness test with no automated
// step to refresh the artefact. Bump this manually on real API contract changes.
const API_VERSION = "1.0.0";

const API_TAGS = [
  { description: "Access token exchange.", name: "Authentication" },
  { description: "Sending mail.", name: "Mail" },
  { description: "Mail job status and lifecycle.", name: "Jobs" },
  { description: "SMTP configuration management.", name: "Configuration" },
  { description: "Application management.", name: "Applications" },
  { description: "Token issuance and management.", name: "Tokens" },
  { description: "Health and metrics.", name: "Monitoring" },
];

/**
 * Builds the complete OpenAPI 3.1.1 document from the operation registry.
 *
 * The pipeline is:
 * 1. Convert `requestComponentSchemas` with the `"input"` JSON Schema view and
 *    `responseComponentSchemas` with the `"output"` view via `z.toJSONSchema`
 *    targeting draft-2020-12. Cross-schema references are wired through the
 *    `uri` callback so Zod emits `$ref: "#/components/schemas/<id>"` instead of
 *    inlining `$defs`.
 * 2. Merge both component sets. Shared enum schemas (present in both views)
 *    must be byte-identical; a divergence throws at generation time.
 * 3. Iterate `operations` to build the `paths` object. When `scope` is
 *    non-null, the generator appends the required-scope note to the operation
 *    description automatically.
 * 4. Set `info.version` to the stable `API_VERSION` constant (decoupled from
 *    the npm package version) so package patch bumps never invalidate the
 *    committed spec.
 *
 * @returns A plain JSON object representing the full OpenAPI 3.1.1 document.
 *   Pass the result to `serializeOpenApiDocument` to obtain a stable JSON string.
 */
export function buildOpenApiDocument(): JsonObject {
  return {
    components: {
      schemas: buildComponentSchemas(),
      securitySchemes: {
        bearerAuth: {
          bearerFormat: "JWT",
          description:
            "Bearer access token from `POST /api/v1/token` (or the static `METRICS_TOKEN` for `GET /metrics`). System-admin session cookies are also accepted for management endpoints.",
          scheme: "bearer",
          type: "http",
        },
      },
    },
    info: {
      description:
        "HTTP API for issuing tokens, sending mail, and managing SMTP configs, jobs, and tokens. All responses use the `{ ok }` envelope; errors additionally carry `error` (and `issues` for validation).",
      title: "Relanto Mailer API",
      version: API_VERSION,
    },
    openapi: "3.1.1",
    paths: buildPaths(),
    servers: [{ description: "Relative to the deployment origin.", url: "/" }],
    tags: API_TAGS,
  };
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (value !== null && typeof value === "object") {
    const sorted: JsonObject = {};

    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortJsonValue(Reflect.get(value, key));
    }

    return sorted;
  }

  return value;
}

/**
 * Serializes the OpenAPI document to a stable JSON string.
 *
 * All object keys are sorted recursively before serialization, so two
 * `buildOpenApiDocument` calls with identical registry content always produce
 * the same byte sequence. A trailing newline is appended so the file passes
 * POSIX text-file conventions and `git diff` stays clean between runs.
 *
 * @param document - The OpenAPI document object returned by
 *   `buildOpenApiDocument`.
 * @returns A deterministically formatted JSON string with a trailing newline.
 */
export function serializeOpenApiDocument(document: JsonObject): string {
  const INDENT = 2;
  return `${JSON.stringify(sortJsonValue(document), null, INDENT)}\n`;
}
