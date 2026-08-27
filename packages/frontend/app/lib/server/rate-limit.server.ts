/**
 * In-memory sliding-window rate limiter for the single-instance mailer.
 *
 * Keyed by an arbitrary string (client IP or token identity). Each key tracks
 * the timestamps of its recent hits inside a rolling `windowMs`. Requests are
 * allowed while fewer than `limit` hits fall inside the window; the next hit is
 * rejected together with the time remaining until the oldest hit expires (used
 * for the `Retry-After` header).
 *
 * State lives in a plain `Map` and is intentionally not persisted: it matches
 * the single-process, SQLite-backed deployment and resets on restart. Stale
 * entries are evicted lazily on access and via a periodic sweep so idle keys do
 * not leak memory.
 */

const DEFAULT_MAX_KEYS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  /** Milliseconds until the next request for this key would be allowed. `0` when allowed. */
  retryAfterMs: number;
};

export type RateLimiterOptions = {
  /** Maximum number of allowed hits per key inside `windowMs`. */
  limit: number;
  /** Hard cap on tracked keys before the oldest are dropped to bound memory. */
  maxKeys?: number;
  /** Injectable clock (milliseconds). Defaults to `Date.now`. */
  now?: () => number;
  /** Length of the sliding window in milliseconds. */
  windowMs: number;
};

export type RateLimiter = {
  check: (key: string, limitOverride?: number) => RateLimitResult;
  reset: () => void;
};

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  function pruneKey(key: string, currentTime: number): number[] {
    const timestamps = hits.get(key);

    if (!timestamps) {
      return [];
    }

    const threshold = currentTime - windowMs;
    const fresh = timestamps.filter((timestamp) => timestamp > threshold);

    if (fresh.length === 0) {
      hits.delete(key);
    } else {
      hits.set(key, fresh);
    }

    return fresh;
  }

  function sweep(currentTime: number): void {
    for (const key of [...hits.keys()]) {
      pruneKey(key, currentTime);
    }

    lastSweep = currentTime;
  }

  function enforceKeyCap(): void {
    if (hits.size <= maxKeys) {
      return;
    }

    // Map preserves insertion order; drop the oldest keys until back at the cap.
    for (const key of hits.keys()) {
      if (hits.size <= maxKeys) {
        break;
      }

      hits.delete(key);
    }
  }

  function check(key: string, limitOverride = limit): RateLimitResult {
    if (limitOverride <= 0) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const currentTime = now();

    if (currentTime - lastSweep >= windowMs) {
      sweep(currentTime);
    }

    const fresh = pruneKey(key, currentTime);

    if (fresh.length < limitOverride) {
      fresh.push(currentTime);
      hits.set(key, fresh);
      enforceKeyCap();

      return { allowed: true, retryAfterMs: 0 };
    }

    const oldest = fresh[0] ?? currentTime;
    const retryAfterMs = Math.max(0, oldest + windowMs - currentTime);

    return { allowed: false, retryAfterMs };
  }

  function reset(): void {
    hits.clear();
    lastSweep = now();
  }

  return { check, reset };
}

/**
 * Best-effort client IP extraction for a reverse-proxied deployment.
 *
 * Honours the left-most entry of `X-Forwarded-For` (the original client) and
 * falls back to `X-Real-IP`. When no proxy header is present the request shares
 * a single `"unknown"` bucket, which fails safe by limiting anonymous traffic
 * together rather than leaving it unlimited.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor !== null) {
    const first = forwardedFor.split(",")[0].trim();

    if (first.length > 0) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();

  if (realIp !== undefined && realIp.length > 0) {
    return realIp;
  }

  return "unknown";
}

const MILLISECONDS_PER_SECOND = 1_000;

/**
 * Builds the standard `429 Too Many Requests` response for a rejected request,
 * including a `Retry-After` header (seconds, always at least 1).
 */
export function buildRateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / MILLISECONDS_PER_SECOND));

  return Response.json(
    { error: "Rate limit exceeded", ok: false },
    { headers: { "Retry-After": String(retryAfterSeconds) }, status: 429 },
  );
}
