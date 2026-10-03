/**
 * The REST contract between the browser (client) and the API (server).
 * Both sides import these types, so a change to the contract is a compile error
 * on whichever side falls out of step.
 */

export type Role = "visitor" | "host" | "guard";
export type RequestStatus = "pending" | "approved" | "denied";

/** Field name -> first error message for that field. "_form" holds errors not tied to one field. */
export type FieldErrors = Record<string, string>;

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  department?: string;
}

export interface HostSummary {
  id: string;
  name: string;
  department: string;
}

export interface PassRequestDto {
  id: string;
  visitorName: string;
  visitDate: string;
  hostId: string;
  hostName: string;
  status: RequestStatus;
  createdAt: string;
  decidedAt?: string;
  /** Full code — only ever sent to the visitor who owns the request. */
  passCode?: string;
  /** Masked code (••••-2345) — what the host sees after approving. */
  passCodeHint?: string;
}

export type VerificationDto =
  | { valid: true; visitorName: string; visitDate: string; hostName: string }
  | { valid: false };

export type AuditOutcome = "success" | "denied" | "rejected" | "invalid" | "rate_limited";

export interface AuditEventDto {
  id: string;
  at: string;
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  outcome: AuditOutcome;
  target?: string;
  detail?: string;
}

export interface ApiError {
  code: string;
  message: string;
  fields?: FieldErrors;
  retryAfterSeconds?: number;
}

export interface ApiErrorBody {
  error: ApiError;
}
