import { z } from "zod";
import type { FieldErrors } from "./api-types";
import { addDays, MAX_DAYS_AHEAD } from "./dates";
import { normalizePassCode, PASS_CODE_PATTERN } from "./pass-code";

/**
 * Input schemas shared by client and server.
 * The browser runs them for instant feedback; the server runs them again because
 * anything the browser sends can be forged. Objects are strict, so extra fields
 * such as `status: "approved"` are rejected rather than silently stored.
 */

/** Letters (any language), spaces, hyphens, apostrophes and periods. Must start with a letter. */
const NAME_PATTERN = /^\p{L}[\p{L}\p{M}' .-]*$/u;

export function passRequestSchema(today: string) {
  const latest = addDays(today, MAX_DAYS_AHEAD);
  return z.strictObject({
    visitorName: z
      .string({ error: "Enter the visitor's full name." })
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(80, "Name must be 80 characters or fewer.")
      .regex(NAME_PATTERN, "Name can only contain letters, spaces, hyphens, apostrophes and periods."),
    visitDate: z.iso
      .date({ error: "Choose a valid visit date." })
      .refine((date) => date >= today, "Visit date can't be in the past.")
      .refine((date) => date <= latest, `Visits can be booked up to ${MAX_DAYS_AHEAD} days ahead.`),
    hostId: z.string({ error: "Choose the staff member you are visiting." }).min(1, "Choose the staff member you are visiting."),
  });
}

export type PassRequestInput = z.infer<ReturnType<typeof passRequestSchema>>;

export const decisionSchema = z.strictObject({
  status: z.enum(["approved", "denied"], { error: 'Status must be "approved" or "denied".' }),
});

export const verifyPassSchema = z.strictObject({
  code: z
    .string({ error: "Enter a pass code." })
    .max(20, "Pass codes have 8 characters, like K7QM-2XPA.")
    .transform(normalizePassCode)
    .pipe(z.string().regex(PASS_CODE_PATTERN, "Pass codes have 8 characters, like K7QM-2XPA.")),
});

export const loginSchema = z.strictObject({
  userId: z.string({ error: "Choose a demo account." }).min(1).max(40),
});

export const requestListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "denied"]).optional(),
});

/** Flattens zod issues into one message per field, which is what the form shows. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    fields[key] ??= issue.message;
  }
  return fields;
}
