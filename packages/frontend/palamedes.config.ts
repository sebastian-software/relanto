import { defineConfig } from "@palamedes/config";

export default defineConfig({
  locales: ["en", "de"],
  sourceLocale: "en",
  catalogs: [
    {
      include: ["app"],
      path: "app/locales/{locale}",
    },
  ],
});
