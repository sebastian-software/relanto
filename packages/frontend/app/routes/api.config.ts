import {
  mailerApi,
  methodNotAllowedHandler,
  requireAdminOrScope,
  withDomainErrorJson,
} from "./api._shared";

function toPublicSmtpConfig(
  config: ReturnType<typeof mailerApi.getSmtpConfig> & {
    password?: unknown;
    passwordEncrypted?: unknown;
  },
) {
  const {
    password: _password,
    passwordEncrypted: _passwordEncrypted,
    username: _username,
    ...publicConfig
  } = config;

  return publicConfig;
}

export async function loader({ request }: { request: Request }): Promise<Response> {
  return withDomainErrorJson(request, async () => {
    const auth = await requireAdminOrScope(request, "readConfig");

    if (auth.kind !== "token" || auth.token.kind !== "application") {
      throw new Response("Application token authentication required", { status: 403 });
    }

    return Response.json({
      config: toPublicSmtpConfig(mailerApi.getSmtpConfig(auth.token.configId)),
      ok: true,
    });
  });
}

export const action = methodNotAllowedHandler("GET");
