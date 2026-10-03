import { NextResponse } from "next/server";
import { apiRoute, readJson } from "@/server/http/api-route";

/** GET /api/pass-requests?status=pending — scoped to the caller (own requests / requests addressed to me). */
export const GET = apiRoute(async ({ req, services, currentUser }) => {
  const query = Object.fromEntries(req.nextUrl.searchParams);
  return NextResponse.json({ requests: await services.passes.listRequests(await currentUser(), query) });
});

/** POST /api/pass-requests { visitorName, visitDate, hostId } — visitors only. */
export const POST = apiRoute(async ({ req, services, currentUser }) => {
  const user = await currentUser();
  const request = await services.passes.submitRequest(user, await readJson(req));
  return NextResponse.json({ request }, { status: 201 });
});
