import "server-only";
import type { SessionUser } from "@/shared/api-types";
import { loginSchema, toFieldErrors } from "@/shared/validation";
import { signSessionToken, verifySessionToken } from "../auth/session-token";
import type { User } from "../domain/pass-request";
import { UnauthenticatedError, ValidationError } from "../domain/errors";
import type { Clock, UserDirectory } from "../ports";
import type { RecordAudit } from "./audit";

export interface AuthServiceDeps {
  users: UserDirectory;
  clock: Clock;
  record: RecordAudit;
  sessionSecret: string;
  sessionTtlMs?: number;
}

export function toSessionUser(user: User): SessionUser {
  return { id: user.id, name: user.name, role: user.role, department: user.department };
}

/** Tactic: authenticate. Answers "who is calling?" from a signed token, never from what the client claims. */
export function createAuthService({ users, clock, record, sessionSecret, sessionTtlMs = 8 * 60 * 60 * 1000 }: AuthServiceDeps) {
  return {
    /** The accounts the role switcher offers. Real deployment: university SSO instead. */
    demoAccounts(): SessionUser[] {
      return users.list().map(toSessionUser);
    },

    async signIn(input: unknown) {
      const parsed = loginSchema.safeParse(input);
      if (!parsed.success) throw new ValidationError(toFieldErrors(parsed.error));

      const user = users.findById(parsed.data.userId);
      if (!user) {
        await record(null, "auth:sign-in", "rejected", { detail: "unknown account" });
        throw new ValidationError({ userId: "That demo account doesn't exist." });
      }

      const now = clock.now().getTime();
      const token = signSessionToken({ sub: user.id, iat: now, exp: now + sessionTtlMs }, sessionSecret);
      await record(user, "auth:sign-in", "success");
      return { user: toSessionUser(user), token, maxAgeSeconds: Math.floor(sessionTtlMs / 1000) };
    },

    async authenticate(token: string | undefined): Promise<User> {
      if (!token) throw new UnauthenticatedError();

      const claims = verifySessionToken(token, sessionSecret, clock.now().getTime());
      const user = claims ? users.findById(claims.sub) : undefined;
      if (!user) {
        await record(null, "auth:session", "denied", { detail: "forged, expired or unknown session token" });
        throw new UnauthenticatedError();
      }
      return user;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
