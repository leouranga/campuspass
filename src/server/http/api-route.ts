import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { ApiError } from "@/shared/api-types";
import { getServices, type Services } from "../container";
import { DomainError, RateLimitedError, ValidationError } from "../domain/errors";
import type { User } from "../domain/pass-request";

/**
 * The REST layer is a thin translator: HTTP in -> service call -> HTTP out.
 * It owns transport concerns only (cookies, JSON parsing, status codes, cache headers);
 * every business and permission rule lives in the services.
 */

export const SESSION_COOKIE = "cvp_session";
const MAX_BODY_BYTES = 10_000;

/** Transport-level failures that happen before a request reaches the services. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const STATUS_BY_CODE: Record<string, number> = {
  validation_failed: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
};

interface HandlerArgs<P> {
  req: NextRequest;
  params: P;
  services: Services;
  /** Resolves the signed session cookie to a user, or throws UnauthenticatedError (401). */
  currentUser: () => Promise<User>;
}

export function apiRoute<P = Record<string, string>>(handler: (args: HandlerArgs<P>) => Promise<Response>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    let res: Response;
    try {
      rejectCrossSiteWrites(req);
      const services = getServices();
      res = await handler({
        req,
        params: await ctx.params,
        services,
        currentUser: () => services.auth.authenticate(req.cookies.get(SESSION_COOKIE)?.value),
      });
    } catch (error) {
      res = errorResponse(error);
    }
    // Responses can contain personal data: never let a browser or proxy cache them.
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
}

/** Requires a JSON body. Also a CSRF defence: an HTML form on another site can't send application/json. */
export async function readJson(req: NextRequest): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Send the request body as JSON (Content-Type: application/json).");
  }
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
    throw new HttpError(413, "payload_too_large", "The request body is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "The request body isn't valid JSON.");
  }
}

/** Blocks state-changing requests that come from another site, on top of the SameSite cookie. */
function rejectCrossSiteWrites(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  const crossSite = req.headers.get("sec-fetch-site") === "cross-site";
  if (crossSite || (origin && new URL(origin).host !== req.headers.get("host"))) {
    throw new HttpError(403, "cross_site_blocked", "Requests from other websites are blocked.");
  }
}

export function setSessionCookie(res: NextResponse, token: string, maxAgeSeconds: number) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, // page scripts (and any injected script) can't read it
    sameSite: "strict", // not sent on requests started by other sites
    secure: process.env.NODE_ENV === "production", // HTTPS only once deployed
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }

  if (error instanceof DomainError) {
    const body: ApiError = { code: error.code, message: error.message };
    const headers = new Headers();
    if (error instanceof ValidationError) body.fields = error.fields;
    if (error instanceof RateLimitedError) {
      body.retryAfterSeconds = error.retryAfterSeconds;
      headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return NextResponse.json({ error: body }, { status: STATUS_BY_CODE[error.code] ?? 400, headers });
  }

  // Unexpected: log the details on the server, give the client nothing to work with.
  console.error("Unhandled API error", error);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong on the server." } },
    { status: 500 },
  );
}
