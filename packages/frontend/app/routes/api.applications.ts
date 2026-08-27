/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/only-throw-error, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/strict-boolean-expressions -- Route action payloads are untyped form/JSON inputs until backend validation; Response throws are React Router control flow. */
import { mailerApi, requireAdminOrScope, withDomainErrorJson } from "./api._shared";
import { requireMethod } from "./require-method";

export async function loader({ request }: { request: Request }): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    const auth = await requireAdminOrScope(request, "manageApplications");

    if (auth.kind === "token" && auth.token.kind !== "applicationAdmin") {
      throw new Response("Application tokens cannot list applications", { status: 403 });
    }

    const applicationAdminId =
      auth.kind === "token" && auth.token.kind === "applicationAdmin"
        ? auth.token.applicationAdminId
        : undefined;

    return Response.json({
      applications: mailerApi.listApplications(applicationAdminId),
      ok: true,
    });
  });
}

export async function action({ request }: { request: Request }): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    requireMethod(request, "POST");
    const auth = await requireAdminOrScope(request, "manageApplications");

    if (auth.kind === "token" && auth.token.kind !== "applicationAdmin") {
      throw new Response("Application tokens cannot create applications", { status: 403 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      throw new Response("Invalid JSON in request body", { status: 400 });
    }

    if (auth.kind === "systemAdmin") {
      const application = mailerApi.createApplication(auth.principalId, "systemAdmin", {
        applicationAdminId: String(payload.applicationAdminId || ""),
        label: payload.label,
      });

      return Response.json({ application, ok: true }, { status: 201 });
    }

    if (auth.token.kind !== "applicationAdmin") {
      throw new Response("Application tokens cannot create applications", { status: 403 });
    }

    const application = mailerApi.createApplication(
      auth.token.applicationAdminId,
      auth.token.kind,
      {
        applicationAdminId: auth.token.applicationAdminId,
        label: payload.label,
      },
    );

    return Response.json({ application, ok: true }, { status: 201 });
  });
}
