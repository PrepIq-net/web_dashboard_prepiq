"use client";

import { useMemo } from "react";
import { Plus } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { Shift, UserSummary } from "@/services/schedule/types";
import {
  formatDayLabel,
  formatDayNumber,
  formatShiftWindow,
  toIso,
  weekDates,
} from "./schedule-helpers";

type WeekGridProps = {
  weekStartIso: string;
  roster: UserSummary[];
  shifts: Shift[];
  canEdit: boolean;
  onCellClick: (userId: string, dateIso: string) => void;
  onShiftClick: (shift: Shift) => void;
  understaffedDays?: string[];
};

/**
 * Rows are people, columns are days. Click-to-assign rather than drag-and-drop:
 * the repo has no DnD library, and dragging is poor on the touch devices
 * managers actually use in a kitchen.
 */
export function WeekGrid({
  weekStartIso,
  roster,
  shifts,
  canEdit,
  onCellClick,
  onShiftClick,
  understaffedDays = [],
}: WeekGridProps) {
  const { t } = useTranslation();
  const days = useMemo(() => weekDates(weekStartIso), [weekStartIso]);
  const shortDays = useMemo(() => new Set(understaffedDays), [understaffedDays]);

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const key = `${shift.user.id}|${shift.date}`;
      const existing = map.get(key);
      if (existing) existing.push(shift);
      else map.set(key, [shift]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [shifts]);

  if (roster.length === 0) {
    return (
      <div className="rounded-xl border border-surface-4/60 bg-surface-2 p-10 text-center">
        <p className="text-sm text-text-muted">{t("schedule.availability.emptyRoster")}</p>
      </div>
    );
  }

  return (
    // The grid is wide by nature; it scrolls inside its own container so the
    // page body never scrolls sideways.
    <div className="overflow-x-auto">
      <div className="min-w-[840px]">
        <div className="grid grid-cols-[180px_repeat(7,1fr)] gap-px rounded-xl border border-surface-4/60 bg-surface-4/60">
          <div className="bg-surface-2 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("schedule.grid.employee")}
            </span>
          </div>
          {days.map((day) => {
            const iso = toIso(day);
            const isShort = shortDays.has(iso);
            return (
              <div key={iso} className="bg-surface-2 px-3 py-2 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {formatDayLabel(day)}
                </div>
                <div
                  className={`text-sm font-medium ${
                    isShort ? "text-status-critical" : "text-text-secondary"
                  }`}
                >
                  {formatDayNumber(day)}
                </div>
              </div>
            );
          })}

          {roster.map((person) => (
            <Row
              key={person.id}
              person={person}
              days={days}
              shiftsByCell={shiftsByCell}
              canEdit={canEdit}
              onCellClick={onCellClick}
              onShiftClick={onShiftClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type RowProps = {
  person: UserSummary;
  days: Date[];
  shiftsByCell: Map<string, Shift[]>;
  canEdit: boolean;
  onCellClick: (userId: string, dateIso: string) => void;
  onShiftClick: (shift: Shift) => void;
};

function Row({ person, days, shiftsByCell, canEdit, onCellClick, onShiftClick }: RowProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center bg-surface-2 px-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-text-primary">{person.name}</p>
          {person.job_title ? (
            <p className="truncate text-[11px] text-text-muted">{person.job_title}</p>
          ) : null}
        </div>
      </div>

      {days.map((day) => {
        const iso = toIso(day);
        const cellShifts = shiftsByCell.get(`${person.id}|${iso}`) ?? [];

        return (
          <div key={iso} className="min-h-[64px] bg-surface-2 p-1.5">
            {cellShifts.length > 0 ? (
              <div className="flex h-full flex-col gap-1">
                {cellShifts.map((shift) => (
                  <button
                    key={shift.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onShiftClick(shift)}
                    className={`w-full rounded-lg border border-surface-4 bg-surface-3 px-2 py-1.5 text-left transition-colors ${
                      canEdit ? "hover:border-brand-gold/50 hover:bg-surface-4" : "cursor-default"
                    }`}
                  >
                    <span className="block text-[11px] font-medium text-text-primary">
                      {formatShiftWindow(shift.start_time, shift.end_time)}
                    </span>
                    <span className="block truncate text-[10px] text-text-muted">
                      {shift.labor_role_name || t("schedule.grid.unassignedRole")}
                    </span>
                  </button>
                ))}
              </div>
            ) : canEdit ? (
              <button
                type="button"
                onClick={() => onCellClick(person.id, iso)}
                aria-label={t("schedule.grid.clickToAdd")}
                className="group flex h-full min-h-[52px] w-full items-center justify-center rounded-lg border border-dashed border-surface-4/60 transition-colors hover:border-brand-gold/50"
              >
                <Plus className="h-3.5 w-3.5 text-transparent transition-colors group-hover:text-brand-gold" />
              </button>
            ) : (
              <div className="flex h-full min-h-[52px] items-center justify-center">
                <span className="text-[11px] text-text-muted/50">{t("schedule.grid.off")}</span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
