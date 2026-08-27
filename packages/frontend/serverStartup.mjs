if (typeof globalThis.__relantoEnsureRuntimeStarted !== "function") {
  await import("./build/server/index.js");
}

if (typeof globalThis.__relantoEnsureRuntimeStarted !== "function") {
  throw new TypeError("Relanto runtime bootstrap hook is not available.");
}

// Fail-fast: validate required environment variables once, before the worker
// starts, so a misconfigured container aborts immediately instead of appearing
// to start and only failing on the first auth/send request.
if (typeof globalThis.__relantoValidateRequiredEnvironment === "function") {
  const errors = globalThis.__relantoValidateRequiredEnvironment();

  if (errors.length > 0) {
    const details = errors.map((message) => `  - ${message}`).join("\n");
    process.stderr.write(
      `Relanto cannot start: required environment configuration is missing or invalid.\n${details}\n`,
    );
    process.exit(1);
  }
}

globalThis.__relantoEnsureRuntimeStarted();
