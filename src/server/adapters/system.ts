import "server-only";
import { randomInt } from "node:crypto";
import { PASS_CODE_ALPHABET, PASS_CODE_LENGTH } from "@/shared/pass-code";
import type { Clock, IdGenerator, PassCodeGenerator } from "../ports";

export const systemClock: Clock = {
  now: () => new Date(),
};

function randomString(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASS_CODE_ALPHABET[randomInt(PASS_CODE_ALPHABET.length)];
  }
  return out;
}

/** Uses the OS CSPRNG (crypto.randomInt), not Math.random, so codes can't be predicted. */
export const cryptoPassCodes: PassCodeGenerator = {
  next: () => randomString(PASS_CODE_LENGTH),
};

/** Random, non-sequential ids: knowing REQ-7F3K9Q tells you nothing about other requests. */
export const randomIds: IdGenerator = {
  next: (prefix) => `${prefix}-${randomString(6)}`,
};
