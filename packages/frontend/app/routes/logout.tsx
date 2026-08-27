import { redirect } from "react-router";

import type { Route } from "./+types/logout";

import { destroySystemAdminSession } from "../lib/server/auth.server";
import { requireMethod } from "./require-method";

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  requireMethod(request, "POST");
  return destroySystemAdminSession(request);
}

// GET requests (e.g. prefetches, image tags used for CSRF) must not destroy the
// session. Only the POST action performs a real logout.
export function loader(_: Route.LoaderArgs): Response {
  return redirect("/login");
}
