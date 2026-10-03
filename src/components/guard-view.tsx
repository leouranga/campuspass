"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import type { VerificationDto } from "@/shared/api-types";
import { formatVisitDate } from "@/shared/dates";
import { EnforcementPanel } from "./enforcement-panel";
import { Button, Card, Notice } from "./ui";

type CheckState =
  | { kind: "idle" }
  | { kind: "valid"; result: Extract<VerificationDto, { valid: true }> }
  | { kind: "invalid" }
  | { kind: "error"; message: string; tone: "error" | "warning" };

export function GuardView() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<CheckState>({ kind: "idle" });
  const [checking, setChecking] = useState(false);

  async function check(event: FormEvent) {
    event.preventDefault();
    setChecking(true);
    const res = await api.post<{ result: VerificationDto }>("/api/pass-verifications", { code });
    setChecking(false);

    if (res.ok) {
      setState(res.data.result.valid ? { kind: "valid", result: res.data.result } : { kind: "invalid" });
    } else {
      setState({
        kind: "error",
        message: res.error.fields?.code ?? res.error.message,
        tone: res.status === 429 ? "error" : "warning",
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Check a pass" description="Type the code the visitor shows you. Spaces, dashes and lowercase are fine.">
        <form onSubmit={check} noValidate className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="pass-code" className="sr-only">
            Pass code
          </label>
          <input
            id="pass-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABCD-2345"
            autoComplete="off"
            spellCheck={false}
            className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-xl tracking-[0.2em] text-slate-900 shadow-sm outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100 sm:max-w-xs"
          />
          <Button type="submit" disabled={checking} className="sm:px-6">
            {checking ? "Checking…" : "Check pass"}
          </Button>
        </form>

        <div className="mt-5" aria-live="polite">
          {state.kind === "valid" && (
            <div className="rounded-xl bg-emerald-600 p-5 text-white">
              <p className="text-3xl font-bold tracking-wide">✓ VALID</p>
              <p className="mt-2 text-lg font-medium">{state.result.visitorName}</p>
              <p className="text-sm text-emerald-50">
                Visiting {state.result.hostName} · {formatVisitDate(state.result.visitDate)}
              </p>
              <p className="mt-3 text-sm text-emerald-50">Check that their photo ID matches this name before letting them in.</p>
            </div>
          )}
          {state.kind === "invalid" && (
            <div className="rounded-xl bg-rose-600 p-5 text-white">
              <p className="text-3xl font-bold tracking-wide">✗ INVALID</p>
              <p className="mt-2 text-sm text-rose-50">
                Do not admit. The code is unknown, wasn&apos;t approved, or isn&apos;t for today.
              </p>
            </div>
          )}
          {state.kind === "error" && <Notice tone={state.tone}>{state.message}</Notice>}
        </div>
      </Card>

      <EnforcementPanel role="guard" />
    </div>
  );
}
