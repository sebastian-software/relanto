import { getSendMaxRequestBodyBytes, getTokenMaxRequestBodyBytes } from "@relanto/backend";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.APP_SESSION_SECRET ??= "test-session-secret-with-at-least-32-chars";
});

function jsonRequest(body: string): Request {
  return new Request("http://localhost/api/v1/resource", {
    body,
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

/**
 * Builds a POST request whose body is delivered as a stream, so undici does not
 * attach a `Content-Length` header. This exercises the streamed size-capping
 * path (defense against a missing or spoofed length).
 */
function streamedJsonRequest(body: string, contentLength?: number): Request {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });

  const headers: Record<string, string> = { "content-type": "application/json" };

  if (contentLength !== undefined) {
    headers["content-length"] = String(contentLength);
  }

  return new Request("http://localhost/api/v1/resource", {
    body: stream,
    // @ts-expect-error -- undici requires `duplex` for streaming request bodies.
    duplex: "half",
    headers,
    method: "POST",
  });
}

function jsonBodyOfSize(byteSize: number): string {
  const overhead = JSON.stringify({ padding: "" }).length;
  return JSON.stringify({ padding: "x".repeat(Math.max(byteSize - overhead, 0)) });
}

async function readThrownResponse(promise: Promise<unknown>): Promise<Response> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected readJsonBody to throw a Response");
}

describe("readJsonBody", () => {
  let readJsonBody: (typeof import("./api._shared"))["readJsonBody"];

  beforeAll(async () => {
    ({ readJsonBody } = await import("./api._shared"));
  });

  it("returns the parsed object for a valid JSON object body", async () => {
    await expect(
      readJsonBody(jsonRequest(JSON.stringify({ label: "Example" }))),
    ).resolves.toStrictEqual({ label: "Example" });
  });

  it("rejects with 400 for syntactically invalid JSON", async () => {
    const response = await readThrownResponse(readJsonBody(jsonRequest("{ not valid json")));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Invalid JSON in request body");
  });

  it("rejects with 400 for a null body", async () => {
    const response = await readThrownResponse(readJsonBody(jsonRequest("null")));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Request body must be a JSON object");
  });

  it("rejects with 400 for an array body", async () => {
    const response = await readThrownResponse(readJsonBody(jsonRequest("[1, 2, 3]")));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Request body must be a JSON object");
  });

  it("rejects with 400 for a primitive number body", async () => {
    const response = await readThrownResponse(readJsonBody(jsonRequest("42")));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Request body must be a JSON object");
  });

  it("rejects with 400 for a primitive string body", async () => {
    const response = await readThrownResponse(readJsonBody(jsonRequest('"just a string"')));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Request body must be a JSON object");
  });

  it("rejects with 413 when Content-Length exceeds the configured limit", async () => {
    const body = jsonBodyOfSize(200);
    const response = await readThrownResponse(readJsonBody(jsonRequest(body), { maxBytes: 32 }));

    expect(response.status).toBe(413);
    await expect(response.text()).resolves.toBe("Request body exceeds the maximum allowed size");
  });

  it("accepts a body that stays within the configured limit", async () => {
    await expect(
      readJsonBody(jsonRequest(JSON.stringify({ label: "small" })), { maxBytes: 1024 }),
    ).resolves.toStrictEqual({ label: "small" });
  });

  it("caps the streamed body when Content-Length is absent", async () => {
    const body = jsonBodyOfSize(2048);
    const response = await readThrownResponse(
      readJsonBody(streamedJsonRequest(body), { maxBytes: 256 }),
    );

    expect(response.status).toBe(413);
    await expect(response.text()).resolves.toBe("Request body exceeds the maximum allowed size");
  });

  it("caps the streamed body even when Content-Length under-reports the size", async () => {
    const body = jsonBodyOfSize(2048);
    const response = await readThrownResponse(
      readJsonBody(streamedJsonRequest(body, 10), { maxBytes: 256 }),
    );

    expect(response.status).toBe(413);
    await expect(response.text()).resolves.toBe("Request body exceeds the maximum allowed size");
  });

  it("applies distinct per-route limits for /token versus /send", async () => {
    const tokenLimit = getTokenMaxRequestBodyBytes();
    const sendLimit = getSendMaxRequestBodyBytes();

    // A body that overflows the (small, unauthenticated) token limit but still
    // fits comfortably within the generous send limit.
    const byteSize = tokenLimit + 1024;
    expect(byteSize).toBeLessThan(sendLimit);

    const body = jsonBodyOfSize(byteSize);

    const rejected = await readThrownResponse(
      readJsonBody(jsonRequest(body), { maxBytes: tokenLimit }),
    );
    expect(rejected.status).toBe(413);

    await expect(readJsonBody(jsonRequest(body), { maxBytes: sendLimit })).resolves.toHaveProperty(
      "padding",
    );
  });
});
