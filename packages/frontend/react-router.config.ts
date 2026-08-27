import type { Config } from "@react-router/dev/config";

export default {
  // The former future.v8_* flags are the default behavior in React Router v8;
  // only splitRouteModules remains configurable (now a top-level option).
  splitRouteModules: true,
  ssr: true,
} satisfies Config;
