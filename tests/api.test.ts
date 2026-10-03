import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as auditRoute from "@/app/api/audit-events/route";
import * as decisionRoute from "@/app/api/pass-requests/[id]/route";
import * as requestsRoute from "@/app/api/pass-requests/route";
import * as verifyRoute from "@/app/api/pass-verifications/route";
import * as sessionRoute from "@/app/api/session/route";
import { setServicesForTesting } from "@/server/container";
import { buildTestServices, callRoute, validRequest } from "./support/fakes";

/**
 * The REST API end to end, by calling the real route handlers with real Request objects.
 * The services behind them are built with test doubles and installed in the composition root.
 */
beforeEach(() => {
  setServicesForTesting(buildTestServices().services);
});
afterEach(() => {
  setServicesForTesting(undefined);
});

async function signInAs(userId: string): Promise<string> {
  const { res, status } = await callRoute(sessionRoute.POST, { method: "POST", path: "/api/session", body: { userId } });
  expect(status).toBe(201);
  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0];
}

async function submitAsVisitor() {
  const cookie = await signInAs("visitor-1");
  const { json } = await callRoute(requestsRoute.POST, { method: "POST", path: "/api/pass-requests", body: validRequest(), cookie });
  return json.request.id as string;
}

describe("happy path through the REST API", () => {
  it("visitor requests -> host approves -> visitor gets code -> guard verifies", async () => {
    const visitorCookie = await signInAs("visitor-1");
    const created = await callRoute(requestsRoute.POST, {
      method: "POST",
      path: "/api/pass-requests",
      body: validRequest(),
      cookie: visitorCookie,
    });
    expect(created.status).toBe(201);
    const id = created.json.request.id;

    const hostCookie = await signInAs("host-moreno");
    const approved = await callRoute(decisionRoute.PATCH, {
      method: "PATCH",
      path: `/api/pass-requests/${id}`,
      params: { id },
      body: { status: "approved" },
      cookie: hostCookie,
    });
    expect(approved.status).toBe(200);

    const mine = await callRoute(requestsRoute.GET, { path: "/api/pass-requests", cookie: visitorCookie });
    const code = mine.json.requests[0].passCode;
    expect(code).toBe("K7QM-2XPA");

    const guardCookie = await signInAs("guard-gate-a");
    const verified = await callRoute(verifyRoute.POST, {
      method: "POST",
      path: "/api/pass-verifications",
      body: { code },
      cookie: guardCookie,
    });
    expect(verified.json.result).toMatchObject({ valid: true, visitorName: "Test Visitor" });
  });
});

describe("security rules at the HTTP boundary", () => {
  it.each(["visitor-1", "guard-gate-a"])("returns 403 when %s tries to approve", async (userId) => {
    const id = await submitAsVisitor();
    const cookie = await signInAs(userId);
    const { status, json } = await callRoute(decisionRoute.PATCH, {
      method: "PATCH",
      path: `/api/pass-requests/${id}`,
      params: { id },
      body: { status: "approved", role: "host" },
      headers: { "x-user-role": "host" },
      cookie,
    });
    expect(status).toBe(403);
    expect(json.error.message).toBe("Only hosts can approve or deny pass requests.");
  });

  it("returns 401 without a session", async () => {
    const { status } = await callRoute(requestsRoute.GET, { path: "/api/pass-requests" });
    expect(status).toBe(401);
  });

  it("returns 401 for a forged session cookie", async () => {
    const forged = Buffer.from(JSON.stringify({ sub: "host-moreno", iat: 0, exp: 9e15 })).toString("base64url");
    const { status } = await callRoute(requestsRoute.GET, { path: "/api/pass-requests", cookie: `cvp_session=${forged}.fake` });
    expect(status).toBe(401);
  });

  it("returns 400 with field messages for bad input", async () => {
    const cookie = await signInAs("visitor-1");
    const { status, json } = await callRoute(requestsRoute.POST, {
      method: "POST",
      path: "/api/pass-requests",
      body: { visitorName: "<b>x</b>", visitDate: "2020-01-01", hostId: "host-moreno" },
      cookie,
    });
    expect(status).toBe(400);
    expect(Object.keys(json.error.fields).sort()).toEqual(["visitDate", "visitorName"]);
  });

  it("returns 415 for a non-JSON body (blocks HTML-form CSRF)", async () => {
    const cookie = await signInAs("visitor-1");
    const { status } = await callRoute(requestsRoute.POST, {
      method: "POST",
      path: "/api/pass-requests",
      body: "visitorName=x",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      cookie,
    });
    expect(status).toBe(415);
  });

  it("returns 403 for a state change sent from another website", async () => {
    const cookie = await signInAs("visitor-1");
    const { status } = await callRoute(requestsRoute.POST, {
      method: "POST",
      path: "/api/pass-requests",
      body: validRequest(),
      headers: { origin: "https://evil.example" },
      cookie,
    });
    expect(status).toBe(403);
  });

  it("returns 429 with Retry-After once a guard enters too many wrong codes", async () => {
    const cookie = await signInAs("guard-gate-a");
    const attempt = () =>
      callRoute(verifyRoute.POST, { method: "POST", path: "/api/pass-verifications", body: { code: "ZZZZ9999" }, cookie });
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(200);
    const locked = await attempt();
    expect(locked.status).toBe(429);
    expect(locked.res.headers.get("retry-after")).toBe("60");
  });

  it("sets an httpOnly, SameSite=Strict session cookie", async () => {
    const { res } = await callRoute(sessionRoute.POST, { method: "POST", path: "/api/session", body: { userId: "visitor-1" } });
    const cookie = (res.headers.get("set-cookie") ?? "").toLowerCase();
    expect(cookie).toContain("httponly");
    expect(cookie).toContain("samesite=strict");
  });

  it("marks API responses as not cacheable", async () => {
    const cookie = await signInAs("host-moreno");
    const { res } = await callRoute(auditRoute.GET, { path: "/api/audit-events", cookie });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
