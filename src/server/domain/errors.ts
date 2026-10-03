import type { FieldErrors } from "@/shared/api-types";

/**
 * Business-layer errors. They say what went wrong, not which HTTP status to use;
 * the REST layer maps them to status codes (see server/http/api-route.ts).
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class ValidationError extends DomainError {
  readonly code = "validation_failed";
  constructor(
    readonly fields: FieldErrors,
    message = "Some details need fixing before this can be accepted.",
  ) {
    super(message);
  }
}

export class UnauthenticatedError extends DomainError {
  readonly code = "unauthenticated";
  constructor(message = "Your session is missing or invalid. Choose a role to sign in again.") {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = "forbidden";
}

export class NotFoundError extends DomainError {
  readonly code = "not_found";
}

export class ConflictError extends DomainError {
  readonly code = "conflict";
}

export class RateLimitedError extends DomainError {
  readonly code = "rate_limited";
  constructor(readonly retryAfterSeconds: number) {
    super(`Too many invalid pass codes. Try again in ${retryAfterSeconds} seconds.`);
  }
}
