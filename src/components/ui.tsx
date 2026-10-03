import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { RequestStatus } from "@/shared/api-types";

export function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-brand-800 text-white hover:bg-brand-700 focus-visible:outline-brand-600",
  approve: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600",
  deny: "bg-white text-rose-700 ring-1 ring-inset ring-rose-300 hover:bg-rose-50 focus-visible:outline-rose-600",
  secondary: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-500",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

const STATUS_STYLES: Record<RequestStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  denied: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export type NoticeTone = "info" | "success" | "error" | "warning";

const NOTICE_STYLES: Record<NoticeTone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function Notice({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${NOTICE_STYLES[tone]}`}>
      {children}
    </div>
  );
}

/** "403" -> "403 Forbidden" */
export function statusText(status: number): string {
  const names: Record<number, string> = {
    0: "Network error",
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    413: "Payload Too Large",
    415: "Unsupported Media Type",
    429: "Too Many Requests",
    500: "Internal Server Error",
  };
  return `${status} ${names[status] ?? ""}`.trim();
}

export function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-emerald-700";
  if (status >= 400 && status < 500) return "text-amber-700";
  return "text-rose-700";
}
