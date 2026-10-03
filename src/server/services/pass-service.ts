import "server-only";
import type { HostSummary, PassRequestDto, VerificationDto } from "@/shared/api-types";
import { campusDate } from "@/shared/dates";
import { formatPassCode, maskPassCode } from "@/shared/pass-code";
import {
  decisionSchema,
  passRequestSchema,
  requestListQuerySchema,
  toFieldErrors,
  verifyPassSchema,
} from "@/shared/validation";
import { can, FORBIDDEN_MESSAGES, isAddressedTo, type Action } from "../auth/policy";
import { ConflictError, ForbiddenError, NotFoundError, RateLimitedError, ValidationError } from "../domain/errors";
import type { PassRequest, User } from "../domain/pass-request";
import type {
  AttemptLimiter,
  AuditLog,
  Clock,
  IdGenerator,
  PassCodeGenerator,
  PassRequestRepository,
  UserDirectory,
} from "../ports";
import type { RecordAudit } from "./audit";

export interface PassServiceDeps {
  requests: PassRequestRepository;
  audit: AuditLog;
  record: RecordAudit;
  users: UserDirectory;
  clock: Clock;
  codes: PassCodeGenerator;
  ids: IdGenerator;
  gateLimiter: AttemptLimiter;
}

/**
 * The business layer. Every public method takes the authenticated user and checks, in order:
 *   1. authorize  — may this role do this at all? (policy table)
 *   2. validate   — is the input well-formed? (shared zod schemas, strict)
 *   3. rules      — ownership, state transitions, dates
 * and records the outcome in the audit log. The REST layer is only a translator, so the rules
 * hold no matter which client calls — the page, curl, or a test.
 */
export function createPassService(deps: PassServiceDeps) {
  const { requests, record, users, clock, codes, ids, gateLimiter } = deps;
  const today = () => campusDate(clock.now());

  async function authorize(actor: User, action: Action, target?: string) {
    if (can(actor, action)) return;
    await record(actor, action, "denied", { target, detail: `role "${actor.role}" lacks permission` });
    throw new ForbiddenError(FORBIDDEN_MESSAGES[action]);
  }

  function hostName(hostId: string) {
    return users.findById(hostId)?.name ?? "Unknown host";
  }

  /** Tactic: limit exposure. Each role gets only the fields it needs. */
  function toView(actor: User, request: PassRequest): PassRequestDto {
    const view: PassRequestDto = {
      id: request.id,
      visitorName: request.visitorName,
      visitDate: request.visitDate,
      hostId: request.hostId,
      hostName: hostName(request.hostId),
      status: request.status,
      createdAt: request.createdAt,
      decidedAt: request.decidedAt,
    };
    if (request.passCode && actor.role === "visitor" && request.requestedBy === actor.id) {
      view.passCode = formatPassCode(request.passCode);
    }
    if (request.passCode && actor.role === "host") {
      view.passCodeHint = maskPassCode(request.passCode);
    }
    return view;
  }

  async function newUniqueCode() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = codes.next();
      if (!(await requests.findByPassCode(code))) return code;
    }
    throw new Error("Could not generate a unique pass code");
  }

  return {
    async listHosts(actor: User): Promise<HostSummary[]> {
      await authorize(actor, "hosts:list");
      return users
        .list()
        .filter((user) => user.role === "host")
        .map((host) => ({ id: host.id, name: host.name, department: host.department ?? "" }));
    },

    async submitRequest(actor: User, input: unknown): Promise<PassRequestDto> {
      await authorize(actor, "request:create");

      const parsed = passRequestSchema(today()).safeParse(input);
      if (!parsed.success) {
        const fields = toFieldErrors(parsed.error);
        await record(actor, "request:create", "rejected", { detail: `invalid: ${Object.keys(fields).join(", ")}` });
        throw new ValidationError(fields);
      }

      const host = users.findById(parsed.data.hostId);
      if (!host || host.role !== "host") {
        await record(actor, "request:create", "rejected", { detail: "invalid: hostId" });
        throw new ValidationError({ hostId: "Choose a host from the list." });
      }

      const request: PassRequest = {
        id: ids.next("REQ"),
        visitorName: parsed.data.visitorName,
        visitDate: parsed.data.visitDate,
        hostId: host.id,
        requestedBy: actor.id,
        status: "pending",
        createdAt: clock.now().toISOString(),
      };
      await requests.add(request);
      await record(actor, "request:create", "success", { target: request.id });
      return toView(actor, request);
    },

    /** Visitors see their own requests; hosts see requests addressed to them; guards see none. */
    async listRequests(actor: User, query: unknown = {}): Promise<PassRequestDto[]> {
      await authorize(actor, "request:list");

      const parsed = requestListQuerySchema.safeParse(query);
      if (!parsed.success) throw new ValidationError(toFieldErrors(parsed.error));

      const scope = actor.role === "host" ? { hostId: actor.id } : { requestedBy: actor.id };
      const rows = await requests.list({ ...scope, status: parsed.data.status });
      return rows.map((row) => toView(actor, row));
    },

    async decide(actor: User, requestId: string, input: unknown): Promise<PassRequestDto> {
      // Role check comes first, before we even look the request up.
      await authorize(actor, "request:decide", requestId);

      const parsed = decisionSchema.safeParse(input);
      if (!parsed.success) throw new ValidationError(toFieldErrors(parsed.error));

      const request = await requests.findById(requestId);
      if (!request || !isAddressedTo(actor, request)) {
        // Another host's request looks the same as a missing one, so ids can't be probed.
        await record(actor, "request:decide", "denied", { target: requestId, detail: "not addressed to this host" });
        throw new NotFoundError("No pending request with that id is addressed to you.");
      }
      if (request.status !== "pending") {
        throw new ConflictError(`This request was already ${request.status}.`);
      }

      const approved = parsed.data.status === "approved";
      const decided: PassRequest = {
        ...request,
        status: parsed.data.status,
        decidedAt: clock.now().toISOString(),
        decidedBy: actor.id,
        passCode: approved ? await newUniqueCode() : undefined,
      };
      await requests.save(decided);
      await record(actor, approved ? "request:approve" : "request:deny", "success", {
        target: request.id,
        detail: decided.passCode ? `pass ${maskPassCode(decided.passCode)} issued` : undefined,
      });
      return toView(actor, decided);
    },

    /** Valid = an approved pass for today's date. The guard learns the name to match against ID, nothing more. */
    async verifyPass(actor: User, input: unknown): Promise<VerificationDto> {
      await authorize(actor, "pass:verify");

      const wait = gateLimiter.retryAfterSeconds(actor.id);
      if (wait > 0) {
        await record(actor, "pass:verify", "rate_limited", { detail: `locked for ${wait}s` });
        throw new RateLimitedError(wait);
      }

      const parsed = verifyPassSchema.safeParse(input);
      if (!parsed.success) {
        gateLimiter.recordFailure(actor.id);
        await record(actor, "pass:verify", "rejected", { detail: "malformed code" });
        throw new ValidationError(toFieldErrors(parsed.error));
      }

      const code = parsed.data.code;
      const request = await requests.findByPassCode(code);
      if (!request || request.status !== "approved" || request.visitDate !== today()) {
        gateLimiter.recordFailure(actor.id);
        await record(actor, "pass:verify", "invalid", { detail: `code ${maskPassCode(code)}` });
        // Same answer for unknown, denied and wrong-day codes: no hint about which part was wrong.
        return { valid: false };
      }

      await record(actor, "pass:verify", "success", { target: request.id, detail: `code ${maskPassCode(code)}` });
      return {
        valid: true,
        visitorName: request.visitorName,
        visitDate: request.visitDate,
        hostName: hostName(request.hostId),
      };
    },

    async readAuditTrail(actor: User, limit = 40) {
      await authorize(actor, "audit:read");
      return deps.audit.recent(limit);
    },
  };
}

export type PassService = ReturnType<typeof createPassService>;
