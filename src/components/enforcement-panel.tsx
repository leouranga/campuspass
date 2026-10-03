"use client";

import { useState } from "react";
import { api, type ApiResult } from "@/lib/api-client";
import type { Role } from "@/shared/api-types";
import { Button, Card, statusColor, statusText } from "./ui";

interface Attempt {
  id: string;
  title: string;
  explain: string;
  request: string;
  expected: string;
  run: () => Promise<ApiResult<unknown>>;
}

/** An id that looks real. The role check runs before any lookup, so it doesn't matter whether it exists. */
const SOME_REQUEST_ID = "REQ-7F3K9Q";

function attemptsFor(role: Role, ownRequestId?: string): Attempt[] {
  const targetId = ownRequestId ?? SOME_REQUEST_ID;
  const approvePath = `/api/pass-requests/${targetId}`;

  if (role === "visitor") {
    return [
      {
        id: "approve-own",
        title: "Approve my own request",
        explain: "The page has no Approve button for visitors, so call the API directly.",
        request: `PATCH ${approvePath}  { "status": "approved" }`,
        expected: "403 — only hosts can approve",
        run: () => api.patch(approvePath, { status: "approved" }),
      },
      {
        id: "claim-host",
        title: "Claim to be a host",
        explain: "Send a role header and a role field. The server reads the role from the signed session only.",
        request: `PATCH ${approvePath}  X-User-Role: host  { "status": "approved", "role": "host" }`,
        expected: "403 — the claim is ignored",
        run: () => api.patch(approvePath, { status: "approved", role: "host" }, { "X-User-Role": "host" }),
      },
      {
        id: "bypass-form",
        title: "Skip the form's checks",
        explain: "Post a script tag as the name, a past date and a sneaky pre-approved status.",
        request: `POST /api/pass-requests  { "visitorName": "<script>…", "visitDate": "2020-01-01", "status": "approved", … }`,
        expected: "400 — the server re-validates everything",
        run: () =>
          api.post("/api/pass-requests", {
            visitorName: "<script>alert('hi')</script>",
            visitDate: "2020-01-01",
            hostId: "host-moreno",
            status: "approved",
          }),
      },
    ];
  }

  return [
    {
      id: "guard-approve",
      title: "Approve a request",
      explain: "Guards check passes; they don't issue them.",
      request: `PATCH ${approvePath}  { "status": "approved" }`,
      expected: "403 — only hosts can approve",
      run: () => api.patch(approvePath, { status: "approved" }),
    },
    {
      id: "guard-browse",
      title: "Browse the visitor list",
      explain: "Limit exposure: the gate gets a yes/no per code, not a list of everyone's personal data.",
      request: "GET /api/pass-requests",
      expected: "403 — guards can't list requests",
      run: () => api.get("/api/pass-requests"),
    },
    {
      id: "guard-audit",
      title: "Read the audit trail",
      explain: "Audit records are for staff, not for the gate.",
      request: "GET /api/audit-events",
      expected: "403 — hosts only",
      run: () => api.get("/api/audit-events"),
    },
  ];
}

export function EnforcementPanel({ role, ownRequestId }: { role: Role; ownRequestId?: string }) {
  const [results, setResults] = useState<Record<string, ApiResult<unknown>>>({});
  const [running, setRunning] = useState<string | null>(null);

  async function run(attempt: Attempt) {
    setRunning(attempt.id);
    const result = await attempt.run();
    setResults((current) => ({ ...current, [attempt.id]: result }));
    setRunning(null);
  }

  return (
    <Card
      title="Try to break the rules"
      description="These buttons skip the UI and call the REST API with your current session. The server decides, not the page. Every refusal is written to the audit log (switch to Host to see it)."
    >
      <ul className="divide-y divide-slate-100">
        {attemptsFor(role, ownRequestId).map((attempt) => {
          const result = results[attempt.id];
          return (
            <li key={attempt.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{attempt.title}</p>
                <p className="text-sm text-slate-600">{attempt.explain}</p>
                <code className="mt-1 block truncate font-mono text-xs text-slate-500" title={attempt.request}>
                  {attempt.request}
                </code>
                {result ? (
                  <p className="mt-1 text-sm" aria-live="polite">
                    <span className={`font-mono font-semibold ${statusColor(result.status)}`}>{statusText(result.status)}</span>
                    {!result.ok && <span className="text-slate-700"> — {result.error.message}</span>}
                    {!result.ok && result.error.fields && (
                      <span className="mt-1 block text-xs text-slate-600">
                        {Object.entries(result.error.fields)
                          .map(([field, message]) => `${field === "_form" ? "request" : field}: ${message}`)
                          .join(" · ")}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">Expected: {attempt.expected}</p>
                )}
              </div>
              <Button variant="secondary" onClick={() => run(attempt)} disabled={running !== null}>
                {running === attempt.id ? "Calling…" : "Try it"}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
