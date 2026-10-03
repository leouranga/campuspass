import { addDays, campusDate } from "@/shared/dates";
import type { PassRequest, User } from "../domain/pass-request";
import type { AuditLog, Clock, IdGenerator, PassCodeGenerator, PassRequestRepository } from "../ports";
import type { RecordAudit } from "./audit";


export async function loadDemoData(
  deps: {
    requests: PassRequestRepository;
    audit: AuditLog;
    record: RecordAudit;
    clock: Clock;
    codes: PassCodeGenerator;
    ids: IdGenerator;
  },
  actor: User,
) {
  await deps.requests.clear();
  await deps.audit.clear();

  const now = deps.clock.now();
  const today = campusDate(now);
  const tomorrow = addDays(today, 1);
  // Timestamps in the recent past so the lists have a realistic order.
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();

  const rows: Omit<PassRequest, "id" | "requestedBy">[] = [
    { visitorName: "Jordan Sample", visitDate: today, hostId: "host-moreno", status: "pending", createdAt: at(5) },
    { visitorName: "Priya Testa", visitDate: tomorrow, hostId: "host-moreno", status: "pending", createdAt: at(12) },
    { visitorName: "Marco Demo", visitDate: today, hostId: "host-carter", status: "pending", createdAt: at(20) },
    {
      visitorName: "Lena Mockford",
      visitDate: today,
      hostId: "host-moreno",
      status: "approved",
      createdAt: at(90),
      decidedAt: at(60),
      decidedBy: "host-moreno",
      passCode: deps.codes.next(),
    },
    {
      visitorName: "Sam Placeholder",
      visitDate: tomorrow,
      hostId: "host-li",
      status: "approved",
      createdAt: at(120),
      decidedAt: at(100),
      decidedBy: "host-li",
      passCode: deps.codes.next(),
    },
    {
      visitorName: "Alex Example",
      visitDate: today,
      hostId: "host-moreno",
      status: "denied",
      createdAt: at(150),
      decidedAt: at(140),
      decidedBy: "host-moreno",
    },
  ];

  for (const row of rows) {
    await deps.requests.add({ ...row, id: deps.ids.next("REQ"), requestedBy: "visitor-1" });
  }
  await deps.record(actor, "demo:load", "success", { detail: `${rows.length} fake requests` });
  return { requests: rows.length };
}
