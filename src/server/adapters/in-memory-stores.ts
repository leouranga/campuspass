import type { AuditEvent, PassRequest } from "../domain/pass-request";
import type { AuditLog, PassRequestRepository, RequestFilter } from "../ports";

/**
 * In-memory implementations of the storage ports. They hold data in the server process
 * (never in the browser) and are what the proof and the tests run on. A PostgreSQL
 * adapter would implement the same interfaces.
 */
export class InMemoryPassRequestRepository implements PassRequestRepository {
  private readonly rows = new Map<string, PassRequest>();

  async add(request: PassRequest) {
    this.rows.set(request.id, { ...request });
  }

  async save(request: PassRequest) {
    this.rows.set(request.id, { ...request });
  }

  async findById(id: string) {
    const row = this.rows.get(id);
    return row && { ...row };
  }

  async findByPassCode(code: string) {
    for (const row of this.rows.values()) {
      if (row.passCode === code) return { ...row };
    }
    return undefined;
  }

  async list(filter: RequestFilter) {
    return [...this.rows.values()]
      .filter((row) => !filter.hostId || row.hostId === filter.hostId)
      .filter((row) => !filter.requestedBy || row.requestedBy === filter.requestedBy)
      .filter((row) => !filter.status || row.status === filter.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => ({ ...row }));
  }

  async clear() {
    this.rows.clear();
  }
}

/** Append-only: there is no update or delete for a single event. */
export class InMemoryAuditLog implements AuditLog {
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent) {
    this.events.push({ ...event });
  }

  async recent(limit: number) {
    return this.events.slice(-limit).reverse();
  }

  async clear() {
    this.events.length = 0;
  }
}
