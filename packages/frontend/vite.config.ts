import { execSync } from "node:child_process";
import { palamedes } from "@palamedes/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vite";

const fallbackGitHash = "dev";
const gitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return fallbackGitHash;
  }
})();
const now = new Date();
const buildDate = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("");
const appVersion = `v${buildDate}-${gitHash}`;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [palamedes(), vanillaExtractPlugin(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    external: ["better-sqlite3"],
  },
});
