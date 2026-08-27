import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify("v20260306-1234567"),
  },
  plugins: [vanillaExtractPlugin()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./app/test/setup.ts"],
    include: ["*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.test.{ts,tsx}",
        "app/test/**",
        "app/**/*.css.ts",
        "app/routes.ts",
        "app/entry.client.tsx",
        "app/entry.server.tsx",
        "app/root.tsx",
      ],
      // Moderate regression gate: set slightly below the current measured
      // coverage (stmts 61.5%, branch 53.5%, funcs 74.3%, lines 61.6%) so the
      // suite stays green while guarding against drops.
      thresholds: {
        statements: 58,
        branches: 50,
        functions: 70,
        lines: 58,
      },
    },
  },
});
