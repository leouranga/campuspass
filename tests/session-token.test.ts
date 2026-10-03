import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "@/server/auth/session-token";

const SECRET = "test-secret-that-is-at-least-32-characters";
const NOW = Date.parse("2026-10-02T14:00:00Z");
const claims = { sub: "visitor-1", iat: NOW, exp: NOW + 60_000 };

describe("session tokens (authenticate)", () => {
  it("round-trips a valid token", () => {
    expect(verifySessionToken(signSessionToken(claims, SECRET), SECRET, NOW)).toEqual(claims);
  });

  it("rejects a token whose claims were edited (e.g. visitor -> host)", () => {
    const [, signature] = signSessionToken(claims, SECRET).split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...claims, sub: "host-moreno" })).toString("base64url");
    expect(verifySessionToken(`${forgedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSessionToken(claims, "another-secret-that-is-32-characters-long");
    expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    expect(verifySessionToken(signSessionToken(claims, SECRET), SECRET, NOW + 60_001)).toBeNull();
  });

  it.each(["", "garbage", "a.b.c", "a.", ".b"])("rejects malformed token %j", (token) => {
    expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
  });
});
