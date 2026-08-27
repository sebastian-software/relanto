import { getEslintConfig } from "eslint-config-setup";

const config = await getEslintConfig({ ai: true, react: true, oxlint: true });

export default [
  ...config,
  {
    ignores: [
      "**/*.md",
      "**/*.json",
      "build/**",
      "coverage/**",
      ".claude/**",
      ".react-router/**",
      ".wrangler/**",
      "**/_generated/**",
      "**/node_modules/**",
      "**/*.config.js",
      "**/*.config.ts",
      "app/locales/**/*.js",
      "app/locales/**/*.mjs",
      "app/locales/**/*.ts",
      "tmp/**",
      "functions/**",
      "serverStartup.mjs",
    ],
  },
];
