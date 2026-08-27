import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureRuntimeStarted = vi.fn();
const runtimeStartupGlobal = globalThis as {
  __relantoEnsureRuntimeStarted?: () => void;
} & typeof globalThis;

describe("frontend server startup", () => {
  beforeEach(() => {
    vi.resetModules();
    ensureRuntimeStarted.mockReset();
    runtimeStartupGlobal.__relantoEnsureRuntimeStarted = ensureRuntimeStarted;
  });

  it("starts the worker loop when the production server process boots", async () => {
    // @ts-expect-error server startup bootstrap stays a runtime-only .mjs module for NODE_OPTIONS=--import
    await import("./serverStartup.mjs");

    expect(ensureRuntimeStarted).toHaveBeenCalledTimes(1);
  });
});
