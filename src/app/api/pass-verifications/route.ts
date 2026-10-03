import { NextResponse } from "next/server";
import { apiRoute, readJson } from "@/server/http/api-route";

/**
 * POST /api/pass-verifications { code } — guards only.
 * The code travels in the body, not the URL, so it doesn't end up in access logs or history.
 */
export const POST = apiRoute(async ({ req, services, currentUser }) => {
  const user = await currentUser();
  const result = await services.passes.verifyPass(user, await readJson(req));
  return NextResponse.json({ result });
});
