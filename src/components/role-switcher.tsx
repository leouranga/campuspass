"use client";

import { useState } from "react";
import type { Role, SessionUser } from "@/shared/api-types";

const ROLES: { role: Role; label: string; blurb: string }[] = [
  { role: "visitor", label: "Visitor", blurb: "Request a pass" },
  { role: "host", label: "Host", blurb: "Approve or deny" },
  { role: "guard", label: "Guard", blurb: "Check codes at the gate" },
];

export function RoleSwitcher({
  accounts,
  me,
  switching,
  onSwitch,
}: {
  accounts: SessionUser[];
  me: SessionUser | null;
  switching: boolean;
  onSwitch: (userId: string) => void;
}) {
  const hosts = accounts.filter((account) => account.role === "host");
  const [lastHostId, setLastHostId] = useState<string | undefined>();

  function pick(role: Role) {
    if (role === me?.role) return;
    const account =
      role === "host"
        ? (hosts.find((host) => host.id === lastHostId) ?? hosts[0])
        : accounts.find((candidate) => candidate.role === role);
    if (account) onSwitch(account.id);
  }

  return (
    <section aria-label="Role switcher" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Choose a role" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {ROLES.map(({ role, label, blurb }) => {
            const active = me?.role === role;
            return (
              <button
                key={role}
                type="button"
                aria-pressed={active}
                disabled={switching || accounts.length === 0}
                onClick={() => pick(role)}
                className={`rounded-lg px-4 py-2 text-left transition disabled:cursor-wait ${
                  active ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/60"
                }`}
              >
                <span className={`block text-sm font-semibold ${active ? "text-brand-800" : "text-slate-700"}`}>{label}</span>
                <span className="hidden text-xs text-slate-500 sm:block">{blurb}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          {me?.role === "host" && (
            <label className="flex items-center gap-2">
              <span className="text-slate-600">Acting as</span>
              <select
                value={me.id}
                disabled={switching}
                onChange={(event) => {
                  setLastHostId(event.target.value);
                  onSwitch(event.target.value);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm"
              >
                {hosts.map((host) => (
                  <option key={host.id} value={host.id}>
                    {host.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-slate-600">
            {me ? (
              <>
                Signed in as <strong className="font-semibold text-slate-900">{me.name}</strong>
              </>
            ) : (
              "Signing in…"
            )}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Demo sign-in, standing in for university SSO. The server issues a signed, httpOnly session cookie and checks
        the role on every request. Hiding a button is not the security.
      </p>
    </section>
  );
}
