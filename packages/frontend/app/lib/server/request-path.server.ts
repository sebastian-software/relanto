/* eslint-disable compat/compat -- Server-only module; URL parsing runs in Node.js, not in browser environments where compat rules apply. */

/** Gibt den Pfad einer Request-URL zurück; entfernt React-Router-Data-Suffixe `_.data` und `.data` (v8_passThroughRequests, v8_trailingSlashAwareDataRequests). */
export function getRequestPath(request: Request): string {
  try {
    const pathname = new URL(request.url).pathname;

    if (pathname.endsWith("/_.data")) {
      return pathname.slice(0, -"_.data".length);
    }

    if (pathname.endsWith(".data")) {
      return pathname.slice(0, -".data".length);
    }

    return pathname;
  } catch {
    return request.url;
  }
}
