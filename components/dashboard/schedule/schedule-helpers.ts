import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { CoverageStatus } from "@/services/schedule/types";

/** Restaurants think Monday–Sunday, so every week here starts on Monday. */
export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function toIso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function weekDates(weekStartIso: string): Date[] {
  const start = parseISO(weekStartIso);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function addWeeks(weekStartIso: string, delta: number): string {
  return toIso(addDays(parseISO(weekStartIso), delta * 7));
}

export function currentWeekIso(): string {
  return toIso(weekStart(new Date()));
}

export function formatWeekRange(weekStartIso: string): string {
  const start = parseISO(weekStartIso);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${format(start, "d")}–${format(end, "d MMM yyyy")}`
    : `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
}

export function formatDayLabel(date: Date): string {
  return format(date, "EEE");
}

export function formatDayNumber(date: Date): string {
  return format(date, "d");
}

/** "06:00:00" → "06:00". Times arrive from DRF with seconds. */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatShiftWindow(start: string, end: string): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/**
 * Brand status colours. Gold is reserved for active/primary UI, so coverage
 * states use the status palette instead: red for a real problem, amber for a
 * cost concern, green for fine.
 */
export const COVERAGE_TONE: Record<CoverageStatus, string> = {
  UNDER: "text-status-critical",
  OK: "text-status-success",
  OVER: "text-status-warning",
  UNKNOWN: "text-text-muted",
};

export const COVERAGE_BG: Record<CoverageStatus, string> = {
  UNDER: "bg-status-critical/10 border-status-critical/30",
  OK: "bg-status-success/10 border-status-success/30",
  OVER: "bg-status-warning/10 border-status-warning/30",
  UNKNOWN: "bg-surface-3 border-surface-4/60",
};

export function coverageLabelKey(status: CoverageStatus): string {
  return `schedule.status.${status.toLowerCase()}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 10) / 10}h`;
}
