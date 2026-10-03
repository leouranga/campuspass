import { NextResponse } from "next/server";
import { apiRoute, clearSessionCookie, readJson, setSessionCookie } from "@/server/http/api-route";
import { toSessionUser } from "@/server/services/auth-service";

/** GET /api/session — who am I? 401 when there is no valid session. */
export const GET = apiRoute(async ({ currentUser }) => {
  return NextResponse.json({ user: toSessionUser(await currentUser()) });
});

/** POST /api/session { userId } — demo sign-in (stands in for university SSO). */
export const POST = apiRoute(async ({ req, services }) => {
  const { user, token, maxAgeSeconds } = await services.auth.signIn(await readJson(req));
  const res = NextResponse.json({ user }, { status: 201 });
  setSessionCookie(res, token, maxAgeSeconds);
  return res;
});

/** DELETE /api/session — sign out. */
export const DELETE = apiRoute(async () => {
  const res = new NextResponse(null, { status: 204 });
  clearSessionCookie(res);
  return res;
});
