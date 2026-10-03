import { NextResponse } from "next/server";
import { apiRoute, readJson } from "@/server/http/api-route";

/** PATCH /api/pass-requests/:id { status: "approved" | "denied" } — the addressed host only. */
export const PATCH = apiRoute<{ id: string }>(async ({ req, params, services, currentUser }) => {
  const user = await currentUser();
  const request = await services.passes.decide(user, params.id, await readJson(req));
  return NextResponse.json({ request });
});
