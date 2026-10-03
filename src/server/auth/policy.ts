import type { Role } from "@/shared/api-types";
import type { PassRequest, User } from "../domain/pass-request";

/**
 * The whole access-control model in one table, so it can be reviewed (and tested) at a glance.
 * Anything not listed is denied.
 */
export type Action =
  | "hosts:list"
  | "request:create"
  | "request:list"
  | "request:decide"
  | "pass:verify"
  | "audit:read";

const PERMISSIONS: Record<Role, readonly Action[]> = {
  visitor: ["hosts:list", "request:create", "request:list"],
  host: ["hosts:list", "request:list", "request:decide", "audit:read"],
  guard: ["pass:verify"],
};

export const FORBIDDEN_MESSAGES: Record<Action, string> = {
  "hosts:list": "Only visitors and hosts can see the host directory.",
  "request:create": "Only visitors can submit pass requests.",
  "request:list": "Guards can't browse pass requests. Check a pass code instead.",
  "request:decide": "Only hosts can approve or deny pass requests.",
  "pass:verify": "Only gate guards can check pass codes.",
  "audit:read": "Only hosts can read the audit trail.",
};

export function can(user: User, action: Action): boolean {
  return PERMISSIONS[user.role].includes(action);
}

/** Ownership rule on top of the role rule: a host decides only requests addressed to them. */
export function isAddressedTo(user: User, request: PassRequest): boolean {
  return user.role === "host" && request.hostId === user.id;
}
