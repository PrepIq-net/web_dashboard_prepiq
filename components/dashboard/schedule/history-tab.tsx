"use client";

import { useTranslation } from "@/lib/i18n";
import type { HistoryWeek } from "@/services/schedule/types";
import { formatHours, formatPercent, formatWeekRange } from "./schedule-helpers";

type HistoryTabProps = {
  weeks: HistoryWeek[];
};

export function HistoryTab({ weeks }: HistoryTabProps) {
  const { t } = useTranslation();

  if (weeks.length === 0) {
    return (
      <div className="rounded-xl border border-surface-4/60 bg-surface-2 p-10 text-center">
        <p className="text-sm text-text-muted">{t("schedule.history.empty")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[640px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-surface-4/60 text-left">
            <Th>{t("schedule.history.week")}</Th>
            <Th align="right">{t("schedule.history.coverage")}</Th>
            <Th align="right">{t("schedule.history.forecastAccuracy")}</Th>
            <Th align="right">{t("schedule.history.laborHours")}</Th>
            <Th align="right">{t("schedule.history.understaffed")}</Th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr
              key={week.week_start_date}
              className="border-b border-surface-4/40 last:border-0"
            >
              <td className="py-3 text-text-primary">
                {formatWeekRange(week.week_start_date)}
              </td>
              <td className="py-3 text-right text-text-secondary">
                {formatPercent(week.coverage_pct)}
              </td>
              <td className="py-3 text-right text-text-secondary">
                {formatPercent(week.forecast_accuracy)}
              </td>
              <td className="py-3 text-right text-text-secondary">
                {formatHours(week.scheduled_hours)}
              </td>
              <td className="py-3 text-right">
                <span
                  className={
                    week.understaffed_days > 0
                      ? "text-status-critical"
                      : "text-text-muted"
                  }
                >
                  {week.understaffed_days}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
