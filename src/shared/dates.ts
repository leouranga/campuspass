/** Bay Atlantic University is in Washington, DC — "today" means today on campus. */
export const CAMPUS_TIME_ZONE = "America/New_York";

/** How far ahead a visitor may book. */
export const MAX_DAYS_AHEAD = 30;

/** The campus calendar date (YYYY-MM-DD) at a given instant. */
export function campusDate(now: Date): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "2026-10-02" -> "Fri, Oct 2, 2026" */
export function formatVisitDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
