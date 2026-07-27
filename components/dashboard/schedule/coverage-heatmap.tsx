"use client";

import { useMemo, useState } from "react";
import { InfoCircle } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { DayHourlyCoverage, HourlyCoverage } from "@/services/schedule/types";
import { COVERAGE_BG, formatTime } from "./schedule-helpers";

type Selection = { date: string; hour: number };

/**
 * Hour columns, day rows.
 *
 * A day can read 100% covered and still have nobody on the line at 12:30 while
 * three people stand idle at 15:00. This is the view that makes that visible:
 * the cell shows scheduled headcount against what the demand curve asks for,
 * and clicking one names the people.
 *
 * Every day carries its provenance. The requirement behind these numbers is
 * usually a weekday average rather than a live forecast, and the hour shape
 * can be an assumed trading curve — presenting either as measured would be the
 * quickest way to lose a manager's trust in the whole tab.
 */
export function CoverageHeatmap({ data }: { data: HourlyCoverage }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Selection | null>(null);

  // Only render hours the branch actually trades, or the grid is mostly empty
  // columns. Falls back to a full day when no day has known hours.
  const hours = useMemo(() => {
    const open = new Set<number>();
    for (const day of data.days) {
      for (const hour of day.hours) {
        if (hour.is_open) open.add(hour.hour);
      }
    }
    if (open.size === 0) return Array.from({ length: 24 }, (_, index) => index);
    const list = [...open].sort((a, b) => a - b);
    return Array.from(
      { length: list[list.length - 1] - list[0] + 1 },
      (_, index) => list[0] + index,
    );
  }, [data.days]);

  const selectedDay = selected
    ? data.days.find((day) => day.date === selected.date) ?? null
    : null;
  const selectedHour = selectedDay
    ? selectedDay.hours.find((hour) => hour.hour === selected?.hour) ?? null
    : null;

  return (
    <div className="space-y-4">
      {data.peak_gap ? (
        <p className="border-l-2 border-status-critical py-1 pl-3 text-sm text-text-primary">
          {t("schedule.hourly.worstGap", {
            hour: `${String(data.peak_gap.hour).padStart(2, "0")}:00`,
            date: data.peak_gap.date,
            short: data.peak_gap.short_by,
          })}
        </p>
      ) : null}

      {/* The grid is wide by nature; it scrolls inside its own container so
          the page body never scrolls sideways. */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `120px repeat(${hours.length}, minmax(30px, 1fr))` }}
          >
            <div className="bg-surface-2 px-2 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {t("schedule.hourly.day")}
              </span>
            </div>
            {hours.map((hour) => (
              <div key={hour} className="bg-surface-2 py-1.5 text-center">
                <span className="text-[10px] tabular-nums text-text-muted">
                  {String(hour).padStart(2, "0")}
                </span>
              </div>
            ))}

            {data.days.map((day) => (
              <DayRow
                key={day.date}
                day={day}
                hours={hours}
                selected={selected}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>
      </div>

      <Legend />

      {selectedDay && selectedHour ? (
        <div className="rounded-xl border border-surface-4/60 bg-surface-2 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">
              {t("schedule.hourly.detailTitle", {
                date: selectedDay.date,
                hour: `${String(selectedHour.hour).padStart(2, "0")}:00`,
              })}
            </p>
            <p className="text-xs tabular-nums text-text-secondary">
              {t("schedule.hourly.scheduledOfRequired", {
                scheduled: selectedHour.scheduled,
                required: selectedHour.required ?? 0,
              })}
            </p>
          </div>

          {selectedHour.staff.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {selectedHour.staff.map((person) => (
                <li key={person.shift_id} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-text-primary">{person.name}</span>
                  <span className="text-xs text-text-muted">
                    {person.labor_role_name ?? t("schedule.grid.unassignedRole")} ·{" "}
                    {formatTime(person.start_time)}–{formatTime(person.end_time)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-muted">{t("schedule.hourly.nobodyOn")}</p>
          )}

          <p className="mt-3 flex items-start gap-2 text-[11px] text-text-muted">
            <InfoCircle className="mt-px h-3 w-3 shrink-0" />
            {selectedDay.provenance_label}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DayRow({
  day,
  hours,
  selected,
  onSelect,
}: {
  day: DayHourlyCoverage;
  hours: number[];
  selected: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const { t } = useTranslation();
  const byHour = new Map(day.hours.map((hour) => [hour.hour, hour]));

  return (
    <>
      <div className="flex flex-col justify-center bg-surface-2 px-2 py-1.5">
        <span className="text-xs text-text-primary">{day.date}</span>
        {day.is_closed ? (
          <span className="text-[10px] text-text-muted">{t("schedule.hourly.closed")}</span>
        ) : (
          <span className="text-[10px] tabular-nums text-text-muted">
            {day.opens_at ? formatTime(day.opens_at) : "—"}–
            {day.closes_at ? formatTime(day.closes_at) : "—"}
          </span>
        )}
      </div>

      {day.is_closed ? (
        // One band rather than a row of empty cells: a closed day is a fact,
        // not a gap someone forgot to fill.
        <div
          className="flex items-center justify-center bg-surface-3/40 py-2"
          style={{ gridColumn: `span ${hours.length}` }}
        >
          <span className="text-[11px] text-text-muted">{t("schedule.hourly.closedAllDay")}</span>
        </div>
      ) : (
        hours.map((hour) => {
          const cell = byHour.get(hour);
          const isSelected = selected?.date === day.date && selected?.hour === hour;

          if (!cell || !cell.is_open) {
            return <div key={hour} className="bg-surface-1/40" aria-hidden="true" />;
          }

          const required = cell.required ?? 0;
          const short = required - cell.scheduled;

          return (
            <button
              key={hour}
              type="button"
              onClick={() => onSelect({ date: day.date, hour })}
              aria-label={t("schedule.hourly.cellLabel", {
                date: day.date,
                hour: `${String(hour).padStart(2, "0")}:00`,
                scheduled: cell.scheduled,
                required,
              })}
              className={`flex min-h-[36px] flex-col items-center justify-center border ${
                COVERAGE_BG[cell.status]
              } ${
                isSelected ? "ring-1 ring-brand-gold" : ""
              } transition-colors hover:border-brand-gold/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold`}
            >
              <span className="text-[11px] font-medium tabular-nums text-text-primary">
                {cell.scheduled}
              </span>
              {short > 0 ? (
                <span className="text-[9px] tabular-nums text-text-secondary">−{short}</span>
              ) : null}
            </button>
          );
        })
      )}
    </>
  );
}

function Legend() {
  const { t } = useTranslation();
  const items = [
    { key: "UNDER", label: t("schedule.status.under") },
    { key: "OK", label: t("schedule.status.ok") },
    { key: "OVER", label: t("schedule.status.over") },
    { key: "UNKNOWN", label: t("schedule.status.unknown") },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-lg border ${COVERAGE_BG[item.key]}`} />
          <span className="text-[11px] text-text-muted">{item.label}</span>
        </span>
      ))}
    </div>
  );
}
