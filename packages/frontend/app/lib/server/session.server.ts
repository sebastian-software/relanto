import { createCookieSessionStorage } from "react-router";

import { getAppSessionSecret } from "./session-secret.server";

const appSessionSecret = getAppSessionSecret();

const storage = createCookieSessionStorage({
  cookie: {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    name: "__mailer_session",
    path: "/",
    sameSite: "lax",
    secrets: [appSessionSecret],
    secure: process.env.NODE_ENV === "production",
  },
});

export const sessionStorage = storage;
export const { commitSession, destroySession, getSession } = storage;
