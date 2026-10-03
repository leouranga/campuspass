import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError, RateLimitedError, ValidationError } from "@/server/domain/errors";
import { buildTestServices, carter, guard, moreno, TOMORROW, validRequest, visitor } from "./support/fakes";

/**
 * Business rules, tested directly against the service with test doubles:
 * a fixed clock, predictable pass codes and in-memory storage. No HTTP, no browser, no real visitors.
 */
let ctx: ReturnType<typeof buildTestServices>;
beforeEach(() => {
  ctx = buildTestServices();
});

async function submitted(overrides: Record<string, unknown> = {}) {
  return ctx.services.passes.submitRequest(visitor, validRequest(overrides));
}

describe("submitting a request (validate input)", () => {
  it("stores a valid request as pending", async () => {
    const request = await submitted();
    expect(request).toMatchObject({ status: "pending", hostName: "Dr. Alicia Moreno", visitorName: "Test Visitor" });
    expect(request.passCode).toBeUndefined();
  });

  it.each([
    [{ visitorName: "" }, "visitorName", "at least 2 characters"],
    [{ visitorName: "R2-D2" }, "visitorName", "only contain letters"],
    [{ visitorName: "<script>alert(1)</script>" }, "visitorName", "only contain letters"],
    [{ visitDate: "2026-10-01" }, "visitDate", "can't be in the past"],
    [{ visitDate: "2026-12-25" }, "visitDate", "up to 30 days ahead"],
    [{ visitDate: "next tuesday" }, "visitDate", "valid visit date"],
    [{ hostId: "" }, "hostId", "Choose the staff member"],
    [{ hostId: "guard-gate-a" }, "hostId", "Choose a host from the list"],
    [{ status: "approved" }, "_form", "Unrecognized key"],
  ])("rejects %o with a clear message on %s", async (overrides, field, message) => {
    const error = await submitted(overrides).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fields[field]).toContain(message);
  });

  it("trims names and accepts accents, hyphens and apostrophes", async () => {
    const request = await submitted({ visitorName: "  José O'Neil-Ávila  " });
    expect(request.visitorName).toBe("José O'Neil-Ávila");
  });

  it("only lets visitors submit", async () => {
    await expect(ctx.services.passes.submitRequest(guard, validRequest())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("approving and denying (authorize)", () => {
  it("lets the addressed host approve, which issues a pass code", async () => {
    const request = await submitted();
    const approved = await ctx.services.passes.decide(moreno, request.id, { status: "approved" });
    expect(approved.status).toBe("approved");
    expect(approved.passCodeHint).toBe("••••-2XPA");
    expect(approved.passCode).toBeUndefined(); // the host never sees the full code
  });

  it.each([
    ["a visitor", visitor],
    ["a guard", guard],
  ])("refuses %s with 403 and leaves the request pending", async (_label, actor) => {
    const request = await submitted();
    await expect(ctx.services.passes.decide(actor, request.id, { status: "approved" })).rejects.toBeInstanceOf(ForbiddenError);

    const [stillPending] = await ctx.services.passes.listRequests(visitor);
    expect(stillPending.status).toBe("pending");
    expect(stillPending.passCode).toBeUndefined();
  });

  it("refuses a host deciding another host's request, without revealing it exists", async () => {
    const request = await submitted();
    await expect(ctx.services.passes.decide(carter, request.id, { status: "approved" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not allow deciding twice", async () => {
    const request = await submitted();
    await ctx.services.passes.decide(moreno, request.id, { status: "denied" });
    await expect(ctx.services.passes.decide(moreno, request.id, { status: "approved" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects unknown decision values", async () => {
    const request = await submitted();
    await expect(ctx.services.passes.decide(moreno, request.id, { status: "maybe" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("what each role can see (limit exposure)", () => {
  it("shows the full pass code only to the visitor who asked", async () => {
    const request = await submitted();
    await ctx.services.passes.decide(moreno, request.id, { status: "approved" });
    const [mine] = await ctx.services.passes.listRequests(visitor);
    expect(mine.passCode).toBe("K7QM-2XPA");
  });

  it("shows hosts only the requests addressed to them", async () => {
    await submitted({ hostId: moreno.id });
    await submitted({ hostId: carter.id });
    const forMoreno = await ctx.services.passes.listRequests(moreno);
    expect(forMoreno).toHaveLength(1);
    expect(forMoreno[0].hostId).toBe(moreno.id);
  });

  it("does not let guards list requests or read the audit trail", async () => {
    await expect(ctx.services.passes.listRequests(guard)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(ctx.services.passes.readAuditTrail(guard)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("checking a pass at the gate", () => {
  async function approvedPass(overrides: Record<string, unknown> = {}) {
    const request = await submitted(overrides);
    await ctx.services.passes.decide(moreno, request.id, { status: "approved" });
    return request;
  }

  it("says valid for an approved pass on its visit date", async () => {
    await approvedPass();
    const result = await ctx.services.passes.verifyPass(guard, { code: "K7QM-2XPA" });
    expect(result).toEqual({ valid: true, visitorName: "Test Visitor", visitDate: "2026-10-02", hostName: "Dr. Alicia Moreno" });
  });

  it("accepts the code typed in lowercase with spaces", async () => {
    await approvedPass();
    expect((await ctx.services.passes.verifyPass(guard, { code: " k7qm 2xpa " })).valid).toBe(true);
  });

  it("says invalid the day after the visit (fake clock, no waiting)", async () => {
    await approvedPass();
    ctx.clock.advance(24 * 60 * 60 * 1000);
    expect(await ctx.services.passes.verifyPass(guard, { code: "K7QM2XPA" })).toEqual({ valid: false });
  });

  it("says invalid before the visit date", async () => {
    await approvedPass({ visitDate: TOMORROW });
    expect(await ctx.services.passes.verifyPass(guard, { code: "K7QM2XPA" })).toEqual({ valid: false });
  });

  it("says invalid for unknown codes, without saying why", async () => {
    expect(await ctx.services.passes.verifyPass(guard, { code: "ZZZZ9999" })).toEqual({ valid: false });
  });

  it("rejects malformed codes with a clear message", async () => {
    const error = await ctx.services.passes.verifyPass(guard, { code: "hello" }).catch((e: unknown) => e);
    expect((error as ValidationError).fields.code).toContain("8 characters");
  });

  it("locks a guard out after 5 wrong codes, then lets them retry after a minute", async () => {
    await approvedPass();
    for (let i = 0; i < 5; i++) await ctx.services.passes.verifyPass(guard, { code: "ZZZZ9999" });

    const locked = await ctx.services.passes.verifyPass(guard, { code: "K7QM2XPA" }).catch((e: unknown) => e);
    expect(locked).toBeInstanceOf(RateLimitedError);
    expect((locked as RateLimitedError).retryAfterSeconds).toBe(60);

    ctx.clock.advance(60_000);
    expect((await ctx.services.passes.verifyPass(guard, { code: "K7QM2XPA" })).valid).toBe(true);
  });

  it("only lets guards verify", async () => {
    await expect(ctx.services.passes.verifyPass(visitor, { code: "K7QM2XPA" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("audit trail", () => {
  it("records allowed and refused actions, with masked codes and no visitor names", async () => {
    const request = await submitted({ visitorName: "Secret Person" });
    await ctx.services.passes.decide(guard, request.id, { status: "approved" }).catch(() => {});
    await ctx.services.passes.decide(moreno, request.id, { status: "approved" });
    await ctx.services.passes.verifyPass(guard, { code: "K7QM2XPA" });

    const events = await ctx.services.passes.readAuditTrail(moreno);
    expect(events.map((e) => [e.actorId, e.action, e.outcome])).toEqual([
      ["guard-gate-a", "pass:verify", "success"],
      ["host-moreno", "request:approve", "success"],
      ["guard-gate-a", "request:decide", "denied"],
      ["visitor-1", "request:create", "success"],
    ]);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("Secret Person");
    expect(serialized).not.toContain("K7QM2XPA");
    expect(serialized).toContain("••••-2XPA");
  });
});
