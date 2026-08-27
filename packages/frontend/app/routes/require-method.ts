/* eslint-disable @typescript-eslint/only-throw-error -- React Router route helpers intentionally throw Response objects for HTTP control flow. */
export function requireMethod(request: Request, ...methods: string[]): void {
  if (!methods.includes(request.method)) {
    throw new Response(`Method ${request.method} not allowed`, {
      headers: { Allow: methods.join(", ") },
      status: 405,
    });
  }
}
