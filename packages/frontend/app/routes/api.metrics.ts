/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/strict-boolean-expressions, max-statements -- Metrics route keeps a compact response assembly and an async-compatible React Router signature. */
import {
  checkDatabase,
  checkWorker,
  getActivity,
  getErrorsLastHour,
  getQueueCounts,
  getSmtpConfigStatus,
} from "@relanto/backend";
import { createHash, timingSafeEqual } from "node:crypto";

import { logApiFailure } from "../lib/server/api-failure-log.server";
import { ensureRuntimeStarted } from "../lib/server/bootstrap.server";
import { getBuildLabel, getShortGitHash } from "../lib/server/build-metadata.server";
import { getRequestPath } from "../lib/server/request-path.server";
import { methodNotAllowedHandler } from "./api._shared";

function timingSafeCompare(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function loader({ request }: { request: Request }): Promise<Response> {
  ensureRuntimeStarted();

  const metricsToken = process.env.METRICS_TOKEN?.trim();
  if (!metricsToken) {
    logApiFailure({
      method: request.method,
      path: getRequestPath(request),
      reasonCategory: "other",
      reasonMessage: "Metrics endpoint disabled",
      status: 404,
    });
    return Response.json({ error: "Not found", ok: false }, { status: 404 });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    logApiFailure({
      method: request.method,
      path: getRequestPath(request),
      reasonCategory: "auth_missing",
      reasonMessage: "Missing authorization",
      status: 401,
    });
    return Response.json({ error: "Missing authorization", ok: false }, { status: 401 });
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!timingSafeCompare(token, metricsToken)) {
    logApiFailure({
      method: request.method,
      path: getRequestPath(request),
      reasonCategory: "auth_invalid",
      reasonMessage: "Invalid metrics token",
      status: 403,
    });
    return Response.json({ error: "Invalid metrics token", ok: false }, { status: 403 });
  }

  try {
    const mem = process.memoryUsage();
    const database = checkDatabase();
    const worker = checkWorker();
    const smtpConfigStatus = getSmtpConfigStatus();
    const queueCounts = getQueueCounts();
    const activity = getActivity();
    const errorsLastHour = getErrorsLastHour();
    const hash = getShortGitHash();

    return Response.json(
      {
        ok: true,
        uptime_seconds: Math.floor(process.uptime()),
        version: getBuildLabel(),
        ...(hash === "dev" ? {} : { hash }),
        activity,
        checks: {
          database,
          worker,
        },
        errors_last_hour: errorsLastHour,
        process: {
          memory_heap_used_bytes: mem.heapUsed,
          memory_rss_bytes: mem.rss,
        },
        queue: queueCounts,
        services: smtpConfigStatus,
      },
      { status: 200 },
    );
  } catch {
    return Response.json({ error: "Failed to collect metrics", ok: false }, { status: 503 });
  }
}

export const action = methodNotAllowedHandler("GET");
