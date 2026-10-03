import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A tiny signed session token: base64url(claims) + "." + base64url(HMAC-SHA256(claims)).
 * The browser holds it in an httpOnly cookie, so page scripts can't read or change it,
 * and any edit to the claims breaks the signature.
 */
export interface SessionClaims {
  /** User id. The role is looked up server-side on every request. */
  sub: string;
  /** Issued at / expires at, in milliseconds since the epoch. */
  iat: number;
  exp: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSessionToken(claims: SessionClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the claims, or null if the token is malformed, forged or expired. */
export function verifySessionToken(token: string, secret: string, nowMs: number): SessionClaims | null {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  // Constant-time comparison so response timing doesn't reveal how much of a forgery matched.
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number") return null;
    return claims.exp > nowMs ? claims : null;
  } catch {
    return null;
  }
}
