import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.mjs", "src/index.ts", "src/types.ts"],
      // Moderate regression gate: set slightly below the current measured
      // coverage (stmts 84.4%, branch 75.5%, funcs 92.2%, lines 84.3%) so the
      // suite stays green while guarding against drops.
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 88,
        lines: 80,
      },
    },
  },
});
