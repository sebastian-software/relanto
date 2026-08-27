import { describe, expect, it } from "vitest";

import { applySecurityHeaders, contentSecurityPolicy } from "./entry.server";

describe("security headers", () => {
  it("sets clickjacking, MIME-sniffing, referrer, permissions, and CSP headers", () => {
    const headers = applySecurityHeaders(new Headers(), { NODE_ENV: "development" });

    expect(headers.get("Content-Security-Policy")).toBe(contentSecurityPolicy);
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("sets HSTS only for production responses", () => {
    const developmentHeaders = applySecurityHeaders(new Headers(), { NODE_ENV: "development" });
    const productionHeaders = applySecurityHeaders(new Headers(), { NODE_ENV: "production" });

    expect(developmentHeaders.get("Strict-Transport-Security")).toBeNull();
    expect(productionHeaders.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });
});
