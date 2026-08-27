import { describe, expect, it } from "vitest";

import { createRateLimiter, getClientIp } from "./rate-limit.server";

function createControllableClock(start = 0): { advance: (ms: number) => void; now: () => number } {
  let current = start;

  const advance = (ms: number): void => {
    current += ms;
  };

  const now = (): number => current;

  return { advance, now };
}

describe("createRateLimiter", () => {
  it("allows requests up to the limit and rejects the next one", () => {
    const clock = createControllableClock();
    const limiter = createRateLimiter({ limit: 3, now: clock.now, windowMs: 60_000 });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);

    const rejected = limiter.check("a");
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterMs).toBe(60_000);
  });

  it("tracks keys independently", () => {
    const clock = createControllableClock();
    const limiter = createRateLimiter({ limit: 1, now: clock.now, windowMs: 60_000 });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("frees capacity once the window has passed", () => {
    const clock = createControllableClock();
    const limiter = createRateLimiter({ limit: 2, now: clock.now, windowMs: 60_000 });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);

    clock.advance(59_999);
    expect(limiter.check("a").allowed).toBe(false);

    clock.advance(1);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("reports a shrinking retry-after as the oldest hit ages", () => {
    const clock = createControllableClock();
    const limiter = createRateLimiter({ limit: 1, now: clock.now, windowMs: 10_000 });

    expect(limiter.check("a").allowed).toBe(true);

    clock.advance(4_000);
    expect(limiter.check("a").retryAfterMs).toBe(6_000);
  });

  it("does not count rejected requests against the caller", () => {
    const clock = createControllableClock();
    const limiter = createRateLimiter({ limit: 1, now: clock.now, windowMs: 10_000 });

    expect(limiter.check("a").allowed).toBe(true);

    // Repeated rejections must not push the window forward.
    limiter.check("a");
    limiter.check("a");

    clock.advance(10_000);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("evicts stale keys during the periodic sweep to bound memory", () => {
    const clock = createControllableClock();
    const limiter = createRateLimiter({ limit: 1, maxKeys: 2, now: clock.now, windowMs: 1_000 });

    limiter.check("a");
    limiter.check("b");

    // Advancing beyond the window and touching another key triggers a sweep
    // that removes the now-stale "a" and "b" entries, so they are allowed again.
    clock.advance(2_000);
    limiter.check("c");

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("resets all tracked state", () => {
    const clock = createControllableClock();
    const limiter = createRateLimiter({ limit: 1, now: clock.now, windowMs: 60_000 });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);

    limiter.reset();

    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses the left-most X-Forwarded-For entry", () => {
    const request = new Request("http://localhost/api/v1/token", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" },
    });

    expect(getClientIp(request)).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP", () => {
    const request = new Request("http://localhost/api/v1/token", {
      headers: { "x-real-ip": "198.51.100.42" },
    });

    expect(getClientIp(request)).toBe("198.51.100.42");
  });

  it("returns a shared bucket when no proxy header is present", () => {
    const request = new Request("http://localhost/api/v1/token");

    expect(getClientIp(request)).toBe("unknown");
  });
});
