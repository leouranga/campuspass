import "server-only";
import { randomBytes } from "node:crypto";
import type { User } from "./domain/pass-request";
import { FixedWindowAttemptLimiter } from "./adapters/attempt-limiter";
import { InMemoryAuditLog, InMemoryPassRequestRepository } from "./adapters/in-memory-stores";
import { cryptoPassCodes, randomIds, systemClock } from "./adapters/system";
import { createUserDirectory } from "./auth/demo-users";
import type {
  AttemptLimiter,
  AuditLog,
  Clock,
  IdGenerator,
  PassCodeGenerator,
  PassRequestRepository,
  UserDirectory,
} from "./ports";
import { createAuditRecorder } from "./services/audit";
import { createAuthService } from "./services/auth-service";
import { loadDemoData } from "./services/demo-data";
import { createPassService } from "./services/pass-service";

/**
 * Composition root: the only place that picks concrete implementations.
 * Production code calls getServices(); tests call createServices({ clock: fakeClock, ... })
 * and install the result with setServicesForTesting().
 */
export interface ServiceDeps {
  requests: PassRequestRepository;
  audit: AuditLog;
  users: UserDirectory;
  clock: Clock;
  codes: PassCodeGenerator;
  ids: IdGenerator;
  sessionSecret: string;
  gateLimiter: AttemptLimiter;
}

export function createServices(overrides: Partial<ServiceDeps> = {}) {
  const clock = overrides.clock ?? systemClock;
  const deps: ServiceDeps = {
    requests: overrides.requests ?? new InMemoryPassRequestRepository(),
    audit: overrides.audit ?? new InMemoryAuditLog(),
    users: overrides.users ?? createUserDirectory(),
    codes: overrides.codes ?? cryptoPassCodes,
    ids: overrides.ids ?? randomIds,
    sessionSecret: overrides.sessionSecret ?? resolveSessionSecret(),
    gateLimiter: overrides.gateLimiter ?? new FixedWindowAttemptLimiter(clock),
    clock,
  };
  const record = createAuditRecorder(deps);

  return {
    auth: createAuthService({ ...deps, record }),
    passes: createPassService({ ...deps, record }),
    loadDemoData: (actor: User) => loadDemoData({ ...deps, record }, actor),
  };
}

export type Services = ReturnType<typeof createServices>;

/**
 * Uses SESSION_SECRET when set. Otherwise each server start makes a random secret, which
 * is fine here because the data is in memory anyway. A hard-coded fallback secret would
 * let anyone who reads the source forge sessions, so there isn't one.
 */
function resolveSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) {
    if (fromEnv.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters long.");
    return fromEnv;
  }
  return randomBytes(32).toString("base64url");
}

/** Fake data is a development/testing aid; it is off in production unless explicitly enabled. */
export function demoDataEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_DATA === "true";
}

// Stored on globalThis so every route handler (and hot reloads in dev) share one in-memory store.
const holder = globalThis as typeof globalThis & { __campusVisitorPass?: Services };

export function getServices(): Services {
  holder.__campusVisitorPass ??= createServices();
  return holder.__campusVisitorPass;
}

export function setServicesForTesting(services: Services | undefined): void {
  holder.__campusVisitorPass = services;
}
