import type { RequestStatus } from "@/shared/api-types";
import type { AuditEvent, PassRequest, User } from "./domain/pass-request";

/**
 * Everything the services depend on is an interface. Production wiring lives in
 * container.ts; tests pass fakes (fixed clock, predictable codes, empty stores),
 * so no test needs real visitors, a database or the network.
 */

export interface Clock {
  now(): Date;
}

export interface PassCodeGenerator {
  /** Returns an 8-character code from PASS_CODE_ALPHABET. */
  next(): string;
}

export interface IdGenerator {
  next(prefix: string): string;
}

export interface RequestFilter {
  hostId?: string;
  requestedBy?: string;
  status?: RequestStatus;
}

export interface PassRequestRepository {
  add(request: PassRequest): Promise<void>;
  save(request: PassRequest): Promise<void>;
  findById(id: string): Promise<PassRequest | undefined>;
  findByPassCode(code: string): Promise<PassRequest | undefined>;
  list(filter: RequestFilter): Promise<PassRequest[]>;
  clear(): Promise<void>;
}

export interface AuditLog {
  append(event: AuditEvent): Promise<void>;
  /** Newest first. */
  recent(limit: number): Promise<AuditEvent[]>;
  clear(): Promise<void>;
}

export interface UserDirectory {
  findById(id: string): User | undefined;
  list(): User[];
}

/** Counts failed attempts per key (one key per guard) inside a time window. */
export interface AttemptLimiter {
  /** 0 when the key may try again, otherwise seconds until it may. */
  retryAfterSeconds(key: string): number;
  recordFailure(key: string): void;
}
