import type { AuditOutcome } from "@/shared/api-types";
import type { User } from "../domain/pass-request";
import type { AuditLog, Clock, IdGenerator } from "../ports";

export type RecordAudit = (
  actor: User | null,
  action: string,
  outcome: AuditOutcome,
  extra?: { target?: string; detail?: string },
) => Promise<void>;

/** Stamps each audit event with an id and the time. Callers pass ids and masked codes, never visitor names. */
export function createAuditRecorder(deps: { audit: AuditLog; clock: Clock; ids: IdGenerator }): RecordAudit {
  return async (actor, action, outcome, extra = {}) => {
    await deps.audit.append({
      id: deps.ids.next("EVT"),
      at: deps.clock.now().toISOString(),
      actorId: actor?.id ?? null,
      actorRole: actor?.role ?? null,
      action,
      outcome,
      ...extra,
    });
  };
}
