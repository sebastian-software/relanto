/* cspell:ignore Pipeable */
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import type { EntryContext, RouterContextProvider } from "react-router";

import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";

const STREAM_ABORT_DELAY_MS = 1000;
const STATUS_INTERNAL_SERVER_ERROR = 500;

export const streamTimeout = 5000;

export const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "object-src 'none'",
].join("; ");

export function applySecurityHeaders(
  responseHeaders: Headers,
  environment: NodeJS.ProcessEnv = process.env,
): Headers {
  responseHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  responseHeaders.set("X-Frame-Options", "DENY");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  responseHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (environment.NODE_ENV === "production") {
    responseHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return responseHeaders;
}

// React Router calls the server entry with this five-argument signature.
// eslint-disable-next-line max-params
export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider,
): Promise<Response> | Response {
  applySecurityHeaders(responseHeaders);
  let statusCode = responseStatusCode;

  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      headers: responseHeaders,
      status: statusCode,
    });
  }

  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent !== null && isbot(userAgent)) || routerContext.isSpaMode
        ? "onAllReady"
        : "onShellReady";
    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      abort();
    }, streamTimeout + STREAM_ABORT_DELAY_MS);

    const { abort, pipe } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onError(error: unknown) {
          statusCode = STATUS_INTERNAL_SERVER_ERROR;

          if (shellRendered) {
            console.error(error);
          }
        },
        onShellError(error: unknown) {
          reject(error instanceof Error ? error : new Error("Shell rendering failed"));
        },
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId);
              timeoutId = undefined;
              callback();
            },
          });
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          pipe(body);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: statusCode,
            }),
          );
        },
      },
    );
  });
}
