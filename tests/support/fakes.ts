import { NextRequest } from "next/server";
import { InMemoryAuditLog } from "@/server/adapters/in-memory-stores";
import { DEMO_USERS } from "@/server/auth/demo-users";
import { createServices } from "@/server/container";
import type { User } from "@/server/domain/pass-request";
import type { Clock, IdGenerator, PassCodeGenerator } from "@/server/ports";

/** Test double: time only moves when the test says so. */
export class FakeClock implements Clock {
  constructor(private current: Date) {}
  now() {
    return new Date(this.current);
  }
  set(iso: string) {
    this.current = new Date(iso);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Test double: hands out the codes the test expects, in order. */
export class SequenceCodes implements PassCodeGenerator {
  constructor(private readonly codes: string[]) {}
  next() {
    const code = this.codes.shift();
    if (!code) throw new Error("SequenceCodes ran out of codes");
    return code;
  }
}

export class CountingIds implements IdGenerator {
  private count = 0;
  next(prefix: string) {
    return `${prefix}-${String(++this.count).padStart(4, "0")}`;
  }
}

/** 10:00 in Washington, DC on 2 Oct 2026, so "today" on campus is 2026-10-02. */
export const TODAY = "2026-10-02";
export const TOMORROW = "2026-10-03";
export const START = "2026-10-02T14:00:00Z";

export function buildTestServices() {
  const clock = new FakeClock(new Date(START));
  const audit = new InMemoryAuditLog();
  const services = createServices({
    clock,
    audit,
    codes: new SequenceCodes(["K7QM2XPA", "R4TN8WBC", "H9VZ3JDE"]),
    ids: new CountingIds(),
    sessionSecret: "test-secret-that-is-at-least-32-characters",
  });
  return { services, clock, audit };
}

export function demoUser(id: string): User {
  const user = DEMO_USERS.find((candidate) => candidate.id === id);
  if (!user) throw new Error(`No demo user ${id}`);
  return user;
}

export const visitor = demoUser("visitor-1");
export const moreno = demoUser("host-moreno");
export const carter = demoUser("host-carter");
export const guard = demoUser("guard-gate-a");

export function validRequest(overrides: Record<string, unknown> = {}) {
  return { visitorName: "Test Visitor", visitDate: TODAY, hostId: moreno.id, ...overrides };
}

type RouteHandler = (req: NextRequest, ctx: { params: Promise<never> }) => Promise<Response>;

/** Calls a route handler exactly as Next.js would, without starting a server. */
export async function callRoute(
  handler: unknown,
  options: {
    method?: string;
    path: string;
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  },
) {
  const { method = "GET", path, body, cookie, headers = {}, params = {} } = options;
  const req = new NextRequest(new URL(path, "http://localhost:3000"), {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const res = await (handler as RouteHandler)(req, { params: Promise.resolve(params) as Promise<never> });
  const json = res.status === 204 ? null : await res.json();
  return { res, status: res.status, json };
}
