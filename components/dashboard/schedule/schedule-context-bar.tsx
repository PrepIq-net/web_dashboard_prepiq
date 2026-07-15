"use client";

import { NavArrowLeft, NavArrowRight, Sparks } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import type { CoverageStatus, WeeklySchedule } from "@/services/schedule/types";
import {
  COVERAGE_TONE,
  coverageLabelKey,
  currentWeekIso,
  formatPercent,
  formatWeekRange,
} from "./schedule-helpers";

type ScheduleContextBarProps = {
  weekIso: string;
  onWeekChange: (weekIso: string) => void;
  coveragePct: number | null;
  coverageStatus: CoverageStatus;
  schedule: WeeklySchedule | null;
  canManage: boolean;
  canPublish: boolean;
  generating: boolean;
  publishing: boolean;
  copying: boolean;
  onGenerate: () => void;
  onPublish: () => void;
  onCopyPrevious: () => void;
};

export function ScheduleContextBar({
  weekIso,
  onWeekChange,
  coveragePct,
  coverageStatus,
  schedule,
  canManage,
  canPublish,
  generating,
  publishing,
  copying,
  onGenerate,
  onPublish,
  onCopyPrevious,
}: ScheduleContextBarProps) {
  const { t } = useTranslation();
  const isCurrentWeek = weekIso === currentWeekIso();
  const published = schedule?.status === "PUBLISHED";
  // Publishing an empty week is rejected by the API; don't offer it.
  const canPublishNow = canPublish && !!schedule && !published && schedule.shifts.length > 0;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <WeekButton
          direction="prev"
          label={t("schedule.actions.previousWeek")}
          onClick={() => onWeekChange(shiftWeek(weekIso, -1))}
        />
        <div className="min-w-[168px] text-center">
          <p className="text-sm font-medium text-text-primary">{formatWeekRange(weekIso)}</p>
          {!isCurrentWeek ? (
            <button
              type="button"
              onClick={() => onWeekChange(currentWeekIso())}
              className="text-[11px] text-brand-gold transition-colors hover:text-brand-gold-hover"
            >
              {t("schedule.actions.thisWeek")}
            </button>
          ) : null}
        </div>
        <WeekButton
          direction="next"
          label={t("schedule.actions.nextWeek")}
          onClick={() => onWeekChange(shiftWeek(weekIso, 1))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            {t("schedule.coverage.score")}
          </span>
          <span className={`font-display text-lg font-semibold ${COVERAGE_TONE[coverageStatus]}`}>
            {formatPercent(coveragePct)}
          </span>
          <span className={`text-xs ${COVERAGE_TONE[coverageStatus]}`}>
            {t(coverageLabelKey(coverageStatus))}
          </span>
        </div>

        {schedule ? (
          <Badge variant={published ? "default" : "secondary"}>
            {t(`schedule.status.${schedule.status.toLowerCase()}`)}
          </Badge>
        ) : null}

        {canManage && !published ? (
          <>
            <button
              type="button"
              onClick={onCopyPrevious}
              disabled={copying || generating}
              className="h-9 rounded-lg border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/50 hover:text-text-primary disabled:opacity-50"
            >
              {t("schedule.actions.copyPrevious")}
            </button>
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating || copying}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/50 hover:text-text-primary disabled:opacity-50"
            >
              <Sparks className="h-3.5 w-3.5" />
              {generating ? t("schedule.actions.generating") : t("schedule.actions.generate")}
            </button>
          </>
        ) : null}

        {canPublishNow ? (
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="h-9 rounded-lg bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-colors hover:bg-brand-gold-hover disabled:opacity-50"
          >
            {publishing ? t("schedule.actions.publishing") : t("schedule.actions.publish")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function WeekButton({
  direction,
  label,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? NavArrowLeft : NavArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-4 text-text-secondary transition-colors hover:border-brand-gold/50 hover:text-text-primary"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function shiftWeek(weekIso: string, delta: number): string {
  const date = new Date(`${weekIso}T00:00:00`);
  date.setDate(date.getDate() + delta * 7);
  return date.toISOString().slice(0, 10);
}
