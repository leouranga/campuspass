"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { SessionUser } from "@/shared/api-types";
import { ApiActivity } from "./api-activity";
import { GuardView } from "./guard-view";
import { HostView } from "./host-view";
import { RoleSwitcher } from "./role-switcher";
import { Notice, type NoticeTone } from "./ui";
import { VisitorView } from "./visitor-view";

export function VisitorPassApp() {
  const [accounts, setAccounts] = useState<SessionUser[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  // Bumped after loading sample data so the current view remounts and refetches.
  const [dataVersion, setDataVersion] = useState(0);

  const signIn = useCallback(async (userId: string) => {
    setSwitching(true);
    const res = await api.post<{ user: SessionUser }>("/api/session", { userId });
    setSwitching(false);
    if (res.ok) {
      setMe(res.data.user);
      setNotice(null);
    } else {
      setNotice({ tone: "error", message: res.error.message });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const [accountsRes, sessionRes] = await Promise.all([
        api.get<{ accounts: SessionUser[] }>("/api/demo-accounts"),
        api.get<{ user: SessionUser }>("/api/session"),
      ]);
      if (accountsRes.ok) setAccounts(accountsRes.data.accounts);
      if (sessionRes.ok) setMe(sessionRes.data.user);
      else await signIn("visitor-1");
    })();
  }, [signIn]);

  async function loadSampleData() {
    const res = await api.post<{ loaded: { requests: number } }>("/api/demo-data");
    if (res.ok) {
      setNotice({
        tone: "success",
        message: `Store reset with ${res.data.loaded.requests} fake requests (fictional names, no real personal data).`,
      });
      setDataVersion((version) => version + 1);
    } else {
      setNotice({ tone: "error", message: res.error.message });
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-brand-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-100">Bay Atlantic University</p>
            <h1 className="text-2xl font-semibold">Campus Visitor Pass</h1>
          </div>
          <button
            type="button"
            onClick={loadSampleData}
            disabled={!me}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/30 transition hover:bg-white/10 disabled:opacity-50"
          >
            Reset &amp; load sample data
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <RoleSwitcher accounts={accounts} me={me} switching={switching} onSwitch={signIn} />
        {notice && <Notice tone={notice.tone}>{notice.message}</Notice>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            {!me ? (
              <p className="text-sm text-slate-500">Signing in…</p>
            ) : me.role === "visitor" ? (
              <VisitorView key={`${me.id}:${dataVersion}`} />
            ) : me.role === "host" ? (
              <HostView key={`${me.id}:${dataVersion}`} me={me} />
            ) : (
              <GuardView key={`${me.id}:${dataVersion}`} />
            )}
          </div>
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <ApiActivity />
            <ArchitectureSummary />
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500 sm:px-6">
          Architecture proof for the team project. Data lives in the server&apos;s memory and resets when the server
          restarts. All names are fictional.
        </p>
      </footer>
    </div>
  );
}

const LAYERS = [
  ["Browser (this page)", "Renders views and sends JSON. Holds no rules."],
  ["REST API /api/*", "Route handlers translate HTTP to service calls."],
  ["Auth", "Verifies the signed session cookie. The role comes from the server."],
  ["Pass Service", "Authorize → validate → business rules → audit."],
  ["Repository", "In-memory store behind an interface. Swap in PostgreSQL later."],
];

function ArchitectureSummary() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Client–server with a REST API</h2>
      <ol className="mt-3 space-y-2">
        {LAYERS.map(([name, role], index) => (
          <li key={name} className="flex gap-3 text-xs">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800">
              {index + 1}
            </span>
            <span>
              <span className="font-semibold text-slate-800">{name}</span>
              <span className="block text-slate-600">{role}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
