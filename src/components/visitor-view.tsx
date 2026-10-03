"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { FieldErrors, HostSummary, PassRequestDto } from "@/shared/api-types";
import { addDays, campusDate, formatVisitDate, MAX_DAYS_AHEAD } from "@/shared/dates";
import { passRequestSchema, toFieldErrors } from "@/shared/validation";
import { EnforcementPanel } from "./enforcement-panel";
import { Button, Card, Notice, StatusBadge, type NoticeTone } from "./ui";

async function fetchMyRequests() {
  const res = await api.get<{ requests: PassRequestDto[] }>("/api/pass-requests");
  return res.ok ? res.data.requests : null;
}

async function fetchHosts() {
  const res = await api.get<{ hosts: HostSummary[] }>("/api/hosts");
  return res.ok ? res.data.hosts : null;
}

export function VisitorView() {
  const [hosts, setHosts] = useState<HostSummary[]>([]);
  const [requests, setRequests] = useState<PassRequestDto[] | null>(null);

  const loadRequests = useCallback(async () => {
    const rows = await fetchMyRequests();
    if (rows) setRequests(rows);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchHosts(), fetchMyRequests()]).then(([hostList, rows]) => {
      if (!active) return;
      if (hostList) setHosts(hostList);
      if (rows) setRequests(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  const latestPending = requests?.find((request) => request.status === "pending");

  return (
    <div className="space-y-6">
      <PassRequestForm hosts={hosts} onSubmitted={loadRequests} />
      <MyRequests requests={requests} onRefresh={loadRequests} />
      <EnforcementPanel role="visitor" ownRequestId={latestPending?.id} />
    </div>
  );
}

const EMPTY_FORM = { visitorName: "", visitDate: "", hostId: "" };

function PassRequestForm({ hosts, onSubmitted }: { hosts: HostSummary[]; onSubmitted: () => void }) {
  const [today] = useState(() => campusDate(new Date()));
  const [values, setValues] = useState({ ...EMPTY_FORM, visitDate: today });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);

    // 1. Instant feedback in the browser, using the same schema as the server.
    const check = passRequestSchema(today).safeParse(values);
    if (!check.success) {
      setErrors(toFieldErrors(check.error));
      return;
    }

    // 2. The server validates again. Its answer is the one that counts.
    setSubmitting(true);
    const res = await api.post<{ request: PassRequestDto }>("/api/pass-requests", values);
    setSubmitting(false);

    if (res.ok) {
      const { id, hostName } = res.data.request;
      setNotice({
        tone: "success",
        message: `Request ${id} sent to ${hostName}. Your pass code will appear below once it's approved.`,
      });
      setValues({ ...EMPTY_FORM, visitDate: today });
      setErrors({});
      onSubmitted();
    } else {
      setErrors(res.error.fields ?? {});
      setNotice({ tone: "error", message: res.error.message });
    }
  }

  return (
    <Card
      title="Request a campus pass"
      description={`Tell us who you are visiting and when. Visits can be booked up to ${MAX_DAYS_AHEAD} days ahead.`}
    >
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="visitorName" error={errors.visitorName} className="sm:col-span-2">
          <input
            id="visitorName"
            type="text"
            autoComplete="name"
            value={values.visitorName}
            onChange={(event) => update("visitorName", event.target.value)}
            placeholder="e.g. Maria Gonzalez"
            aria-invalid={Boolean(errors.visitorName)}
            aria-describedby={errors.visitorName ? "visitorName-error" : undefined}
            className={inputClass(errors.visitorName)}
          />
        </Field>

        <Field label="Visit date" htmlFor="visitDate" error={errors.visitDate}>
          <input
            id="visitDate"
            type="date"
            min={today}
            max={addDays(today, MAX_DAYS_AHEAD)}
            value={values.visitDate}
            onChange={(event) => update("visitDate", event.target.value)}
            aria-invalid={Boolean(errors.visitDate)}
            aria-describedby={errors.visitDate ? "visitDate-error" : undefined}
            className={inputClass(errors.visitDate)}
          />
        </Field>

        <Field label="Host (staff member you are visiting)" htmlFor="hostId" error={errors.hostId}>
          <select
            id="hostId"
            value={values.hostId}
            onChange={(event) => update("hostId", event.target.value)}
            aria-invalid={Boolean(errors.hostId)}
            aria-describedby={errors.hostId ? "hostId-error" : undefined}
            className={inputClass(errors.hostId)}
          >
            <option value="">Select a host…</option>
            {hosts.map((host) => (
              <option key={host.id} value={host.id}>
                {host.name} — {host.department}
              </option>
            ))}
          </select>
        </Field>

        {errors._form && (
          <p className="text-sm text-rose-700 sm:col-span-2" role="alert">
            {errors._form}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Submit request"}
          </Button>
          <span className="text-xs text-slate-500">Checked in your browser, then checked again by the server.</span>
        </div>

        {notice && (
          <div className="sm:col-span-2">
            <Notice tone={notice.tone}>{notice.message}</Notice>
          </div>
        )}
      </form>
    </Card>
  );
}

function inputClass(error?: string) {
  const ring = error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" : "border-slate-300 focus:border-brand-600 focus:ring-brand-100";
  return `block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-4 ${ring}`;
}

function Field({
  label,
  htmlFor,
  error,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

function MyRequests({ requests, onRefresh }: { requests: PassRequestDto[] | null; onRefresh: () => void }) {
  return (
    <Card
      title="My requests"
      description="Your pass code appears here once your host approves. Only you can see the full code."
      action={
        <Button variant="secondary" onClick={onRefresh}>
          Refresh
        </Button>
      }
    >
      {requests === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-500">No requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{request.visitorName}</p>
                  <p className="text-sm text-slate-600">
                    {formatVisitDate(request.visitDate)} · visiting {request.hostName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{request.id}</span>
                  <StatusBadge status={request.status} />
                </div>
              </div>
              {request.status === "approved" && request.passCode && <PassCode code={request.passCode} visitDate={request.visitDate} />}
              {request.status === "pending" && (
                <p className="mt-2 text-sm text-slate-500">Waiting for {request.hostName} to respond.</p>
              )}
              {request.status === "denied" && <p className="mt-2 text-sm text-rose-700">Your host declined this request.</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PassCode({ code, visitDate }: { code: string; visitDate: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the code is on screen anyway.
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3 ring-1 ring-inset ring-emerald-200">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Pass code — show at the gate</p>
        <p className="font-mono text-2xl font-semibold tracking-[0.2em] text-emerald-950">{code}</p>
        <p className="text-xs text-emerald-800">Valid on {formatVisitDate(visitDate)} only.</p>
      </div>
      <Button variant="secondary" onClick={copy}>
        {copied ? "Copied" : "Copy code"}
      </Button>
    </div>
  );
}
