import { describe, expect, it } from "vitest";

import { getRequestPath } from "./request-path.server";

describe("getRequestPath", () => {
  it("returns the pathname for a regular request URL", () => {
    expect(getRequestPath(new Request("http://localhost/api/v1/config"))).toBe("/api/v1/config");
  });

  it("strips a trailing .data suffix (v8_passThroughRequests data requests)", () => {
    expect(getRequestPath(new Request("http://localhost/api/v1/config.data"))).toBe(
      "/api/v1/config",
    );
  });

  it("strips a trailing /_.data suffix (v8_trailingSlashAwareDataRequests)", () => {
    expect(getRequestPath(new Request("http://localhost/api/v1/config/_.data"))).toBe(
      "/api/v1/config/",
    );
  });

  it("does not strip suffixes that look similar but are not React Router data markers", () => {
    expect(getRequestPath(new Request("http://localhost/files/report.dataset"))).toBe(
      "/files/report.dataset",
    );
    expect(getRequestPath(new Request("http://localhost/notes/data"))).toBe("/notes/data");
  });

  it("ignores query strings when extracting the path", () => {
    expect(getRequestPath(new Request("http://localhost/api/v1/jobs?status=failed"))).toBe(
      "/api/v1/jobs",
    );
  });

  it("falls back to request.url when the URL cannot be parsed", () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Stubs only the `url` field; the helper's catch path must not depend on a full Request instance.
    const broken = { url: "not a url" } as unknown as Request;
    expect(getRequestPath(broken)).toBe("not a url");
  });
});
