/** Calendar math + label helpers for the planning page. */

export type Translator = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

export function getWeekdays(t: Translator): string[] {
  return [
    t("planning.mon"),
    t("planning.tue"),
    t("planning.wed"),
    t("planning.thu"),
    t("planning.fri"),
    t("planning.sat"),
    t("planning.sun"),
  ];
}

export function getMonths(t: Translator): string[] {
  return [
    t("planning.january"),
    t("planning.february"),
    t("planning.march"),
    t("planning.april"),
    t("planning.may"),
    t("planning.june"),
    t("planning.july"),
    t("planning.august"),
    t("planning.september"),
    t("planning.october"),
    t("planning.november"),
    t("planning.december"),
  ];
}

export function getStatusLabels(t: Translator): Record<string, string> {
  return {
    ACTIVE: t("planning.status_active"),
    DRAFT: t("planning.status_draft"),
    CANCELLED: t("planning.status_cancelled"),
    COMPLETED: t("planning.status_completed"),
  };
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Monday-first month grid including leading/trailing overflow days. */
export function calendarGrid(month: Date): Date[] {
  const start = monthStart(month);
  const end = monthEnd(month);
  const dow = (start.getDay() + 6) % 7; // 0=Mon
  const grid: Date[] = [];
  for (let i = -dow; i <= end.getDate() - 1; i++) {
    const d = new Date(start);
    d.setDate(1 + i);
    grid.push(d);
  }
  // Pad to full rows of 7
  while (grid.length % 7 !== 0) {
    const last = grid[grid.length - 1];
    const d = new Date(last);
    d.setDate(last.getDate() + 1);
    grid.push(d);
  }
  return grid;
}
