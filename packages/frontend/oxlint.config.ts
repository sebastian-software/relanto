import type { OxlintConfig } from "oxlint";
import { defineConfig } from "oxlint";

import { getOxlintConfig } from "eslint-config-setup";

const config = await getOxlintConfig({ react: true, ai: true });

export default defineConfig({
  ...(config as OxlintConfig),
  ignorePatterns: [
    "**/*.md",
    "**/*.json",
    "build/**",
    ".claude/**",
    ".react-router/**",
    ".wrangler/**",
    "**/_generated/**",
    "**/node_modules/**",
    "**/*.config.js",
    "**/*.config.ts",
    "app/locales/**/*.js",
    "app/locales/**/*.ts",
    "app/lib/server/**/*.ts",
    "app/root.tsx",
    "app/routes/**/*.ts",
    "app/routes/**/*.tsx",
    "tmp/**",
  ],
});
