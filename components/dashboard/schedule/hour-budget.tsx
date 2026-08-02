"use client";

import { useTranslation } from "@/lib/i18n";
import type { UserWeekTotal } from "@/services/schedule/types";

/** Past this share of the cap the bar warns before it breaks. */
const NEAR_CAP = 0.9;

function tone(total: UserWeekTotal): { bar: string; text: string } {
  if (total.max_weekly_hours === null) {
    return { bar: "bg-text-muted/40", text: "text-text-muted" };
  }
  if (total.over_hour_cap) {
    return { bar: "bg-status-critical", text: "text-text-primary" };
  }
  if (total.hours >= total.max_weekly_hours * NEAR_CAP) {
    return { bar: "bg-status-warning", text: "text-text-primary" };
  }
  return { bar: "bg-status-success", text: "text-text-secondary" };
}

/**
 * Hours worked this week against each person's cap.
 *
 * Nothing in the app tracked this before, so unintended overtime was invisible
 * until payroll. A null cap is shown as hours-with-no-limit rather than as a
 * full bar — no cap configured is not the same as plenty of room left.
 */
export function HourBudgetRow({ total }: { total: UserWeekTotal }) {
  const { t } = useTranslation();
  const colours = tone(total);
  const cap = total.max_weekly_hours;
  const pct = cap ? Math.min((total.hours / cap) * 100, 100) : 0;

  return (
    <div className="flex flex-col justify-center gap-1 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-[11px] tabular-nums ${colours.text}`}>
          {cap
            ? t("schedule.hours.ofCap", { hours: total.hours, cap })
            : t("schedule.hours.noCap", { hours: total.hours })}
        </span>
        {total.over_hour_cap ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-primary">
            {t("schedule.hours.over")}
          </span>
        ) : null}
      </div>
      {cap ? (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-surface-4"
          role="progressbar"
          aria-valuenow={Math.round(total.hours)}
          aria-valuemin={0}
          aria-valuemax={Math.round(cap)}
          aria-label={t("schedule.hours.barLabel", { name: total.name })}
        >
          <div className={`h-full rounded-full ${colours.bar}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Week total across the roster, for the grid footer. */
export function HourBudgetSummary({
  totalHours,
  totalShifts,
  overCap,
}: {
  totalHours: number;
  totalShifts: number;
  overCap: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
      <span>{t("schedule.hours.weekTotal", { hours: totalHours, shifts: totalShifts })}</span>
      {overCap > 0 ? (
        <span className="border-l-2 border-status-critical pl-2 text-text-primary">
          {t("schedule.hours.overCount", { count: overCap })}
        </span>
      ) : null}
    </div>
  );
}
