"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { DrawerShell } from "@/components/ui/drawer-shell";
import { Select } from "@/components/ui/select";
import { ToggleRow } from "@/components/ui/form-field";
import { TimeRangePicker, rangeHours, type TimeRange } from "@/components/ui/time-range-picker";
import { useTranslation } from "@/lib/i18n";
import type {
  LaborRole,
  Shift,
  ShiftTemplate,
  UserSummary,
} from "@/services/schedule/types";
import { formatTime } from "./schedule-helpers";

export type ShiftDraft = {
  userId: string;
  dateIso: string;
  shift?: Shift;
};

type AssignShiftModalProps = {
  draft: ShiftDraft | null;
  roster: UserSummary[];
  templates: ShiftTemplate[];
  roles: LaborRole[];
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: (values: {
    shiftTemplateId: string | null;
    laborRoleId: string | null;
    notes: string;
    startTime: string | null;
    endTime: string | null;
    isLocked: boolean;
  }) => void;
  onDelete: () => void;
  /** Other shifts this person already has that day, for overlap warnings. */
  sameDayShifts?: Shift[];
};

export function AssignShiftModal({
  draft,
  roster,
  templates,
  roles,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete,
  sameDayShifts = [],
}: AssignShiftModalProps) {
  const { t } = useTranslation();
  const [templateId, setTemplateId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [notes, setNotes] = useState("");
  const [custom, setCustom] = useState(false);
  const [range, setRange] = useState<TimeRange>({ start: "09:00", end: "17:00" });
  const [locked, setLocked] = useState(false);

  const editing = !!draft?.shift;

  useEffect(() => {
    if (!draft) return;
    const shift = draft.shift;
    setTemplateId(shift?.shift_template ?? templates[0]?.id ?? "");
    setRoleId(shift?.labor_role ?? "");
    setNotes(shift?.notes ?? "");
    setLocked(shift?.is_locked ?? false);

    // An existing shift with no template was placed by hand, so reopen it the
    // way it was created rather than snapping it back onto a template.
    const isCustom = !!shift && !shift.shift_template;
    setCustom(isCustom);
    setRange({
      start: (shift?.start_time ?? "09:00").slice(0, 5),
      end: (shift?.end_time ?? "17:00").slice(0, 5),
    });
  }, [draft, templates]);

  const person = useMemo(
    () => roster.find((member) => member.id === draft?.userId),
    [roster, draft?.userId],
  );

  if (!draft) return null;

  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: `${template.name} · ${formatTime(template.start_time)}–${formatTime(template.end_time)}`,
  }));

  const roleOptions = [
    { value: "", label: t("schedule.grid.unassignedRole") },
    ...roles.map((role) => ({ value: role.id, label: role.name })),
  ];

  const dayLabel = format(parseISO(draft.dateIso), "EEEE d MMM");

  const siblings = sameDayShifts
    .filter((shift) => shift.id !== draft.shift?.id)
    .map((shift) => ({ start: shift.start_time, end: shift.end_time }));

  const customHours = rangeHours(range.start, range.end);
  const customInvalid = custom && (customHours === null || customHours <= 0);
  const canSave = custom ? !customInvalid : !!templateId;

  return (
    <DrawerShell
      open
      title={editing ? t("schedule.actions.removeShift") : t("schedule.actions.addShift")}
      description={`${person?.name ?? ""} · ${dayLabel}`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          {editing ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting || saving}
              className="h-10 rounded-lg px-3 text-sm font-medium text-status-critical transition-colors hover:bg-status-critical/10 disabled:opacity-50"
            >
              {t("schedule.actions.removeShift")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg px-4 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              {t("schedule.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={saving || deleting || !canSave}
              onClick={() =>
                onSave({
                  // The API takes either a template or an explicit span, and
                  // has since it shipped — only the UI ever forced a template.
                  shiftTemplateId: custom ? null : templateId || null,
                  laborRoleId: roleId || null,
                  notes,
                  startTime: custom ? range.start : null,
                  endTime: custom ? range.end : null,
                  isLocked: locked,
                })
              }
              className="h-10 rounded-lg bg-brand-gold px-4 text-sm font-medium text-[#141416] transition-colors hover:bg-brand-gold-hover disabled:opacity-50"
            >
              {t("schedule.actions.save")}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <ToggleRow
          checked={custom}
          onChange={setCustom}
          label={t("schedule.actions.customWindow")}
        />
        {custom ? (
          <TimeRangePicker
            value={range}
            onChange={setRange}
            allowOvernight
            siblings={siblings}
          />
        ) : (
          <Select
            label={t("schedule.actions.addShift")}
            options={templateOptions}
            value={templateId}
            onChange={setTemplateId}
          />
        )}
        <Select
          label={t("schedule.coverage.role")}
          options={roleOptions}
          value={roleId}
          onChange={setRoleId}
        />
        <div>
          <label
            htmlFor="shift-notes"
            className="mb-1.5 block text-xs font-medium text-text-secondary"
          >
            {t("schedule.availability.note")}
          </label>
          <textarea
            id="shift-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-lg border border-surface-4 bg-surface-3 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-brand-gold"
          />
        </div>
        <ToggleRow
          checked={locked}
          onChange={setLocked}
          label={t("schedule.actions.pinShift")}
        />
      </div>
    </DrawerShell>
  );
}
