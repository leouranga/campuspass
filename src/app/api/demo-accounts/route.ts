import { NextResponse } from "next/server";
import { apiRoute } from "@/server/http/api-route";

/** GET /api/demo-accounts — the accounts the role switcher can sign in as. */
export const GET = apiRoute(async ({ services }) => {
  return NextResponse.json({ accounts: services.auth.demoAccounts() });
});
