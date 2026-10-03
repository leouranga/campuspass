/**
 * Pass codes: 8 symbols from a 32-character alphabet (40 bits of entropy).
 * Ambiguous characters (I, O, 0, 1) are left out so guards can read codes aloud.
 */
export const PASS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PASS_CODE_LENGTH = 8;
export const PASS_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

/** "abcd-2345 " -> "ABCD2345". Guards may type codes with spaces, dashes or lowercase. */
export function normalizePassCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

/** "ABCD2345" -> "ABCD-2345" */
export function formatPassCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** "ABCD2345" -> "••••-2345": enough to tell passes apart, not enough to use one. */
export function maskPassCode(code: string): string {
  return `••••-${code.slice(4)}`;
}
