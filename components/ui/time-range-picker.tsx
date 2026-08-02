"use client";

import { useMemo } from "react";
import { WarningTriangle } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { fieldInputClass, fieldLabelClass } from "./form-field";

export type TimeRange = { start: string; end: string };

/** "HH:MM" or "HH:MM:SS" → minutes since midnight. */
function toMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Hours between two times, treating end <= start as crossing midnight.
 * Mirrors labor.models.duration_hours so the figure shown here is the one the
 * backend will store.
 */
export function rangeHours(start: string, end: string): number | null {
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from === null || to === null) return null;
  return ((to <= from ? to + 24 * 60 : to) - from) / 60;
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  const aStart = toMinutes(a.start);
  const bStart = toMinutes(b.start);
  const aHours = rangeHours(a.start, a.end);
  const bHours = rangeHours(b.start, b.end);
  if (aStart === null || bStart === null || aHours === null || bHours === null) return false;

  const aEnd = aStart + aHours * 60;
  const bEnd = bStart + bHours * 60;
  // Compare on both days so a wrapping range still meets an early-morning one.
  return [0, 1440].some(
    (offset) => aStart < bEnd + offset && bStart + offset < aEnd,
  );
}

type TimeRangePickerProps = {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  /** Allow end <= start, meaning the window runs past midnight. */
  allowOvernight?: boolean;
  /** Other ranges on the same day; an overlap is flagged, not blocked. */
  siblings?: TimeRange[];
  disabled?: boolean;
  startLabel?: string;
  endLabel?: string;
};

/**
 * Start and end time with a live hours readout.
 *
 * Native <input type="time"> rather than a custom widget: it is already
 * keyboard-accessible, respects the OS 12/24-hour preference, and gives touch
 * devices their own scroll wheel — none of which a hand-rolled dropdown would.
 *
 * Overlaps warn rather than block, matching the backend, where upsert_shift
 * saves an overlapping shift and returns a warning. A manager double-booking
 * someone is usually responding to something the roster cannot see.
 */
export function TimeRangePicker({
  value,
  onChange,
  allowOvernight = false,
  siblings = [],
  disabled = false,
  startLabel,
  endLabel,
}: TimeRangePickerProps) {
  const { t } = useTranslation();

  const hours = rangeHours(value.start, value.end);
  const inverted = useMemo(() => {
    const from = toMinutes(value.start);
    const to = toMinutes(value.end);
    if (from === null || to === null) return false;
    return to <= from;
  }, [value.start, value.end]);

  const overlapping = useMemo(
    () => siblings.some((sibling) => rangesOverlap(value, sibling)),
    [siblings, value],
  );

  const invalid = inverted && !allowOvernight;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={fieldLabelClass} htmlFor="time-range-start">
            {startLabel ?? t("schedule.timeRange.start")}
          </label>
          <input
            id="time-range-start"
            type="time"
            value={value.start.slice(0, 5)}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, start: event.target.value })}
            className={`${fieldInputClass} ${invalid ? "border-status-critical/60" : ""}`}
          />
        </div>
        <div>
          <label className={fieldLabelClass} htmlFor="time-range-end">
            {endLabel ?? t("schedule.timeRange.end")}
          </label>
          <input
            id="time-range-end"
            type="time"
            value={value.end.slice(0, 5)}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, end: event.target.value })}
            className={`${fieldInputClass} ${invalid ? "border-status-critical/60" : ""}`}
          />
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {hours !== null && !invalid ? (
          <p className="text-[11px] text-text-muted">
            {t("schedule.timeRange.total", { hours: Math.round(hours * 10) / 10 })}
            {inverted && allowOvernight ? ` · ${t("schedule.timeRange.overnight")}` : ""}
          </p>
        ) : null}

        {/* A 4px status border with text-primary copy, per docs/DESIGN.md §8 —
            status-critical is 3.6:1 and cannot carry 11px text itself. */}
        {invalid ? (
          <p className="flex items-start gap-2 border-l-2 border-status-critical py-0.5 pl-2 text-[11px] text-text-primary">
            <WarningTriangle className="mt-px h-3 w-3 shrink-0 text-status-critical" />
            {t("schedule.timeRange.endBeforeStart")}
          </p>
        ) : null}

        {overlapping ? (
          <p className="flex items-start gap-2 border-l-2 border-status-warning py-0.5 pl-2 text-[11px] text-text-primary">
            <WarningTriangle className="mt-px h-3 w-3 shrink-0 text-status-warning" />
            {t("schedule.timeRange.overlaps")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
