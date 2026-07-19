"use client";

import { useEffect, useMemo, useState } from "react";
import { NavArrowLeft, NavArrowRight } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { TextArea } from "@/components/ui/form-field";
import {
  useMyAvailability,
  useMyContext,
  useSubmitAvailability,
} from "@/services/schedule/hooks";
import type { AvailabilityStatus } from "@/services/schedule/types";
import {
  addWeeks,
  formatDayLabel,
  formatDayNumber,
  formatTime,
  formatWeekRange,
  weekDates,
} from "@/components/dashboard/schedule/schedule-helpers";

/** Key for one (weekday, shift) toggle. Weekday is Monday=0, mirroring the
 *  backend's `date.weekday()`. */
function slotKey(weekday: number, templateId: string) {
  return `${weekday}|${templateId}`;
}

const STATUS_VARIANT: Record<
  AvailabilityStatus,
  "default" | "secondary" | "destructive"
> = {
  APPROVED: "default",
  PENDING: "secondary",
  REJECTED: "destructive",
};

/**
 * The web port of mobile's availability editor. Submit-and-edit weekly
 * availability — which shifts you can work — without any management permission.
 * Self-contained: it reads the branches you're rostered at from `me/context`
 * rather than the page's (manager-oriented) branch selector.
 */
export function AvailabilityEditor() {
  const { t } = useTranslation();

  const contextQuery = useMyContext();
  const branches = useMemo(
    () => contextQuery.data?.branches ?? [],
    [contextQuery.data],
  );

  const [branchId, setBranchId] = useState<string | null>(null);
  // Default to next week: this is a forward-looking declaration, and the
  // current week is usually already scheduled.
  const [weekIso, setWeekIso] = useState<string | null>(null);

  useEffect(() => {
    if (!contextQuery.data) return;
    if (!branchId && branches.length > 0) setBranchId(branches[0].id);
    if (!weekIso) {
      setWeekIso(
        contextQuery.data.next_week_start ?? contextQuery.data.current_week_start,
      );
    }
  }, [contextQuery.data, branches, branchId, weekIso]);

  const branch = branches.find((item) => item.id === branchId) ?? null;

  const availabilityQuery = useMyAvailability(
    branchId ?? undefined,
    weekIso ?? undefined,
  );
  const submit = useSubmitAvailability();

  const [slots, setSlots] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);

  const templates =
    availabilityQuery.data?.shift_templates ?? branch?.shift_templates ?? [];
  const availability = availabilityQuery.data?.availability ?? null;

  // Reset the form whenever the server's answer for this week changes, unless
  // the user has unsaved edits — never clobber someone mid-entry.
  useEffect(() => {
    if (!availabilityQuery.data || dirty) return;
    const next: Record<string, boolean> = {};
    for (const entry of availability?.entries ?? []) {
      if (entry.is_available)
        next[slotKey(entry.weekday, entry.shift_template_id)] = true;
    }
    setSlots(next);
    setNote(availability?.note ?? "");
  }, [availabilityQuery.data, availability, dirty]);

  const selectedCount = useMemo(
    () => Object.values(slots).filter(Boolean).length,
    [slots],
  );

  const toggle = (weekday: number, templateId: string) => {
    setDirty(true);
    setSlots((prev) => {
      const key = slotKey(weekday, templateId);
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const changeWeek = (delta: number) => {
    if (!weekIso) return;
    setDirty(false);
    setWeekIso(addWeeks(weekIso, delta));
  };

  const handleSubmit = () => {
    if (!branchId || !weekIso) return;
    const entries = Object.entries(slots)
      .filter(([, value]) => value)
      .map(([key]) => {
        const [weekday, templateId] = key.split("|");
        return {
          weekday: Number(weekday),
          shift_template_id: templateId,
          is_available: true,
        };
      });

    submit.mutate(
      { branch_id: branchId, week_start_date: weekIso, note, entries },
      { onSuccess: () => setDirty(false) },
    );
  };

  if (contextQuery.isLoading || (branches.length > 0 && !weekIso)) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="rounded-xl border border-surface-4/60 bg-surface-2 p-10 text-center">
        <p className="text-sm text-text-muted">
          {t("tasks.availability.noBranch")}
        </p>
      </div>
    );
  }

  const days = weekIso ? weekDates(weekIso) : [];

  return (
    <div className="max-w-3xl space-y-5">
      {/* Branch picker only when the person works more than one branch. */}
      {branches.length > 1 ? (
        <div className="w-64">
          <Select
            options={branches.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            value={branchId ?? ""}
            onChange={(value) => {
              setDirty(false);
              setBranchId(value);
            }}
          />
        </div>
      ) : null}

      {/* Week navigator + status */}
      <div className="flex items-center justify-between rounded-xl border border-surface-4/60 bg-surface-2 px-4 py-3">
        <button
          type="button"
          onClick={() => changeWeek(-1)}
          aria-label={t("tasks.availability.prevWeek")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-4 text-text-secondary transition-colors hover:bg-surface-3"
        >
          <NavArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-text-primary">
            {weekIso ? formatWeekRange(weekIso) : ""}
          </p>
          {availability ? (
            <Badge variant={STATUS_VARIANT[availability.status]}>
              {t(`tasks.availability.status.${availability.status.toLowerCase()}`)}
            </Badge>
          ) : (
            <span className="text-xs text-text-muted">
              {t("tasks.availability.notSubmitted")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => changeWeek(1)}
          aria-label={t("tasks.availability.nextWeek")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-4 text-text-secondary transition-colors hover:bg-surface-3"
        >
          <NavArrowRight className="h-4 w-4" />
        </button>
      </div>

      {branch ? (
        <p className="text-sm text-text-muted">
          {t("tasks.availability.intro", { branch: branch.name })}
        </p>
      ) : null}

      {availabilityQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : availabilityQuery.isError ? (
        <p className="py-10 text-center text-sm text-status-critical">
          {t("tasks.availability.loadError")}
        </p>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-surface-4/60 bg-surface-2 p-10 text-center">
          <p className="text-sm text-text-muted">
            {t("tasks.availability.noShifts")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day, weekday) => (
            <div
              key={weekday}
              className="rounded-xl border border-surface-4/60 bg-surface-2 p-4"
            >
              <div className="mb-3 flex items-baseline gap-2">
                <p className="text-sm font-semibold text-text-primary">
                  {formatDayLabel(day)}
                </p>
                <span className="text-xs text-text-muted">
                  {formatDayNumber(day)}
                </span>
              </div>
              <div className="space-y-2">
                {templates.map((template) => {
                  const key = slotKey(weekday, template.id);
                  return (
                    <label
                      key={template.id}
                      className="flex cursor-pointer items-center justify-between gap-3"
                    >
                      <span className="text-sm text-text-secondary">
                        {template.name} ·{" "}
                        {formatTime(template.start_time)}–
                        {formatTime(template.end_time)}
                      </span>
                      <Switch
                        checked={!!slots[key]}
                        onCheckedChange={() => toggle(weekday, template.id)}
                        disabled={submit.isPending}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t("tasks.availability.noteLabel")}
        </label>
        <TextArea
          rows={3}
          value={note}
          onChange={(event) => {
            setDirty(true);
            setNote(event.target.value);
          }}
          placeholder={t("tasks.availability.notePlaceholder")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={submit.isPending || templates.length === 0}
        >
          {availability
            ? t("tasks.availability.resubmit")
            : t("tasks.availability.submit")}
        </Button>
        <span className="text-xs text-text-muted">
          {t("tasks.availability.selectedCount", { count: selectedCount })}
        </span>
      </div>

      {availability?.status === "APPROVED" && dirty ? (
        <p className="text-xs text-status-warning">
          {t("tasks.availability.resubmitWarning")}
        </p>
      ) : null}

      {availability?.review_note ? (
        <p className="text-xs text-text-muted">
          {t("tasks.availability.reviewNote", { note: availability.review_note })}
        </p>
      ) : null}
    </div>
  );
}
