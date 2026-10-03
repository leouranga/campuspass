"use client";

import { useEffect, useState } from "react";
import { subscribeToApiCalls, type ApiCallRecord } from "@/lib/api-client";
import { statusText } from "./ui";

const MAX_CALLS = 14;

function statusTone(status: number) {
  if (status >= 200 && status < 300) return "text-emerald-400";
  if (status >= 400 && status < 500) return "text-amber-400";
  return "text-rose-400";
}

/** Live log of the browser's REST calls: the client–server boundary, made visible. */
export function ApiActivity() {
  const [calls, setCalls] = useState<ApiCallRecord[]>([]);

  useEffect(
    () => subscribeToApiCalls((call) => setCalls((current) => [call, ...current].slice(0, MAX_CALLS))),
    [],
  );

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-100 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">API activity</h2>
          <p className="text-xs text-slate-400">Every action is an HTTP call to the server. The page holds no rules.</p>
        </div>
        <button
          type="button"
          onClick={() => setCalls([])}
          className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          Clear
        </button>
      </div>
      {calls.length === 0 ? (
        <p className="font-mono text-xs text-slate-500">Waiting for requests…</p>
      ) : (
        <ol className="space-y-1.5 font-mono text-xs">
          {calls.map((call) => (
            <li key={call.id} className="rounded bg-slate-800/60 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 font-semibold text-sky-300">{call.method}</span>
                <span className="min-w-0 flex-1 truncate text-slate-200" title={call.path}>
                  {call.path}
                </span>
                <span className={`shrink-0 ${statusTone(call.status)}`}>{call.status}</span>
              </div>
              {call.message && (
                <p className="mt-0.5 truncate pl-14 text-slate-400" title={`${statusText(call.status)}: ${call.message}`}>
                  {call.message}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
