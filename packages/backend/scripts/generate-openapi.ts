// CLI entry point: regenerates packages/backend/openapi.json from the Zod schema
// registry. Run it via the "openapi:generate" package script:
//
//   pnpm --filter @relanto/backend openapi:generate
//
// The document content is deterministic (sorted keys), so a second run without
// code changes produces no diff. The written file is then formatted with oxfmt
// so it satisfies the repo-wide `format:check` — `.oxfmtrc.json` is a
// standards-managed file and must not carry a per-file ignore for the spec.
/* eslint-disable security/detect-non-literal-fs-filename -- The output path is derived from the module URL, not user input. */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildOpenApiDocument, serializeOpenApiDocument } from "../src/openapi/generate.js";

/**
 * Generates `openapi.json`, writes it next to the backend `package.json`, and
 * formats it with oxfmt so the committed file is format-clean.
 */
function main(): void {
  const outputPath = fileURLToPath(new URL("../openapi.json", import.meta.url));
  const document = buildOpenApiDocument();
  const serialized = serializeOpenApiDocument(document);

  writeFileSync(outputPath, serialized);
  execFileSync("pnpm", ["exec", "oxfmt", "--write", outputPath], { stdio: "ignore" });
  process.stdout.write(`Wrote OpenAPI spec to ${outputPath}\n`);
}

main();
