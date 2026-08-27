import { startWorkerLoop } from "@relanto/backend/worker";

import { validateRequiredEnvironment } from "./environment-validation.server";

let bootstrapped = false;

declare global {
  var __relantoEnsureRuntimeStarted: (() => void) | undefined;
  var __relantoValidateRequiredEnvironment: (() => string[]) | undefined;
}

export function ensureRuntimeStarted(): void {
  if (bootstrapped) {
    return;
  }

  startWorkerLoop();
  bootstrapped = true;
}

globalThis.__relantoEnsureRuntimeStarted = ensureRuntimeStarted;
globalThis.__relantoValidateRequiredEnvironment = validateRequiredEnvironment;
