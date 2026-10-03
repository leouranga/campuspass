import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http/api-route";

/** GET /api/audit-events — newest first, hosts only. */
export const GET = apiRoute(async ({ services, currentUser }) => {
  return NextResponse.json({ events: await services.passes.readAuditTrail(await currentUser()) });
});
