import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http/api-route";

/** GET /api/hosts — staff a visitor can ask to visit. */
export const GET = apiRoute(async ({ services, currentUser }) => {
  return NextResponse.json({ hosts: await services.passes.listHosts(await currentUser()) });
});
