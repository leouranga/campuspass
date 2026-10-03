"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { AuditEventDto, AuditOutcome, PassRequestDto, SessionUser } from "@/shared/api-types";
import { formatVisitDate } from "@/shared/dates";
import { Button, Card, Notice, StatusBadge, type NoticeTone } from "./ui";

async function fetchHostData() {
  const [requestsRes, auditRes] = await Promise.all([
    api.get<{ requests: PassRequestDto[] }>("/api/pass-requests"),
    api.get<{ events: AuditEventDto[] }>("/api/audit-events"),
  ]);
  return {
    requests: requestsRes.ok ? requestsRes.data.requests : null,
    events: auditRes.ok ? auditRes.data.events : null,
  };
}

export function HostView({ me }: { me: SessionUser }) {
  const [requests, setRequests] = useState<PassRequestDto[] | null>(null);
  const [events, setEvents] = useState<AuditEventDto[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  const apply = useCallback((data: Awaited<ReturnType<typeof fetchHostData>>) => {
    if (data.requests) setRequests(data.requests);
    if (data.events) setEvents(data.events);
  }, []);

  const load = useCallback(async () => apply(await fetchHostData()), [apply]);

  useEffect(() => {
    let active = true;
    void fetchHostData().then((data) => {
      if (active) apply(data);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  async function decide(request: PassRequestDto, status: "approved" | "denied") {
    setBusyId(request.id);
    setNotice(null);
    const res = await api.patch<{ request: PassRequestDto }>(`/api/pass-requests/${encodeURIComponent(request.id)}`, { status });
    setBusyId(null);

    if (!res.ok) {
      setNotice({ tone: "error", message: res.error.message });
    } else if (status === "approved") {
      setNotice({
        tone: "success",
        message: `Approved ${request.visitorName}. Pass ${res.data.request.passCodeHint} was issued; only the visitor can see the full code.`,
      });
    } else {
      setNotice({ tone: "info", message: `Denied the request from ${request.visitorName}.` });
    }
    await load();
  }

  const pending = requests?.filter((request) => request.status === "pending") ?? [];
  const decided = requests?.filter((request) => request.status !== "pending") ?? [];

  return (
    <div className="space-y-6">
      <Card
        title="Pending requests"
        description={`Requests addressed to ${me.name}. Other hosts' visitors are not visible here.`}
        action={
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        }
      >
        {notice && (
          <div className="mb-4">
            <Notice tone={notice.tone}>{notice.message}</Notice>
          </div>
        )}
        {requests === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing waiting. Switch to Visitor and submit a request addressed to you, or load the sample data.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-slate-900">{request.visitorName}</p>
                  <p className="text-sm text-slate-600">
                    Visiting on {formatVisitDate(request.visitDate)} ·{" "}
                    <span className="font-mono text-xs text-slate-400">{request.id}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="deny" disabled={busyId !== null} onClick={() => decide(request, "denied")}>
                    Deny
                  </Button>
                  <Button variant="approve" disabled={busyId !== null} onClick={() => decide(request, "approved")}>
                    {busyId === request.id ? "Saving…" : "Approve"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Decided" description="Hosts only see a masked code. The full code goes to the visitor alone.">
        {decided.length === 0 ? (
          <p className="text-sm text-slate-500">No decisions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {decided.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{request.visitorName}</p>
                  <p className="text-xs text-slate-500">{formatVisitDate(request.visitDate)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {request.passCodeHint && <span className="font-mono text-sm text-slate-500">{request.passCodeHint}</span>}
                  <StatusBadge status={request.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AuditTrail events={events} onRefresh={() => void load()} />
    </div>
  );
}

const OUTCOME_STYLES: Record<AuditOutcome, string> = {
  success: "text-emerald-700",
  denied: "text-rose-700 font-semibold",
  rejected: "text-amber-700",
  invalid: "text-amber-700",
  rate_limited: "text-rose-700 font-semibold",
};

function AuditTrail({ events, onRefresh }: { events: AuditEventDto[] | null; onRefresh: () => void }) {
  return (
    <Card
      title="Audit trail"
      description="Recorded by the server for every attempt, allowed or refused. No visitor names; pass codes are masked."
      action={
        <Button variant="secondary" onClick={onRefresh}>
          Refresh
        </Button>
      }
    >
      {events === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-slate-500">No events yet.</p>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Outcome</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{new Date(event.at).toLocaleTimeString()}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{event.actorId ?? "anonymous"}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{event.action}</td>
                  <td className={`whitespace-nowrap px-3 py-1.5 ${OUTCOME_STYLES[event.outcome]}`}>{event.outcome}</td>
                  <td className="px-3 py-1.5 text-slate-600">{[event.target, event.detail].filter(Boolean).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
