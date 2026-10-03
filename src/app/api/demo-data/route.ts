import { NextResponse } from "next/server";
import { demoDataEnabled } from "@/server/container";
import { apiRoute, HttpError } from "@/server/http/api-route";

/** POST /api/demo-data — wipe the in-memory store and load fake requests. Development only. */
export const POST = apiRoute(async ({ services, currentUser }) => {
  if (!demoDataEnabled()) {
    throw new HttpError(404, "not_found", "Demo data is disabled in production.");
  }
  const loaded = await services.loadDemoData(await currentUser());
  return NextResponse.json({ loaded }, { status: 201 });
});
