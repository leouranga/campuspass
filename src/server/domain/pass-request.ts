import type { RequestStatus, Role, AuditOutcome } from "@/shared/api-types";

/** A pass request as stored. Never sent to the browser as-is — see toView() in the pass service. */
export interface PassRequest {
  id: string;
  visitorName: string;
  visitDate: string;
  hostId: string;
  /** The visitor account that submitted the request. */
  requestedBy: string;
  status: RequestStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  passCode?: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  department?: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  outcome: AuditOutcome;
  /** A request id, never personal data. */
  target?: string;
  detail?: string;
}
