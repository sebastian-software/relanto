/* eslint-disable @typescript-eslint/require-await -- React Router action signatures stay async-compatible even when this health route returns synchronously. */
import { checkDatabase, checkWorker } from "@relanto/backend";

import { ensureRuntimeStarted } from "../lib/server/bootstrap.server";
import { getBuildLabel, getShortGitHash } from "../lib/server/build-metadata.server";
import { methodNotAllowedHandler } from "./api._shared";

export async function loader(): Promise<Response> {
  ensureRuntimeStarted();

  const healthy = checkDatabase().status === "healthy" && checkWorker().status === "healthy";
  const hash = getShortGitHash();

  return Response.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      version: getBuildLabel(),
      ...(hash === "dev" ? {} : { hash }),
    },
    { status: healthy ? 200 : 503 },
  );
}

export const action = methodNotAllowedHandler("GET");
