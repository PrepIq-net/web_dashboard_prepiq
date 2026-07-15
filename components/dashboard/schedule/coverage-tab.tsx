"use client";

import { format, parseISO } from "date-fns";
import { InfoCircle } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { CoverageResponse, DayCoverage } from "@/services/schedule/types";
import {
  COVERAGE_BG,
  COVERAGE_TONE,
  coverageLabelKey,
  formatHours,
  formatPercent,
} from "./schedule-helpers";

type CoverageTabProps = {
  data: CoverageResponse;
  canRecompute: boolean;
  recomputing: boolean;
  onRecompute: () => void;
};

export function CoverageTab({
  data,
  canRecompute,
  recomputing,
  onRecompute,
}: CoverageTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <InfoCircle className="h-3.5 w-3.5 shrink-0" />
          {/* Provenance is shown because a default standard is a guess, and the
              manager deserves to know when the number is not yet measured. */}
          <span>
            {t("schedule.coverage.standard")}:{" "}
            {t("schedule.coverage.perLaborHour", {
              value: data.standard.meals_per_labor_hour,
            })}{" "}
            · {data.standard.provenance_label}
          </span>
        </div>
        {canRecompute ? (
          <button
            type="button"
            onClick={onRecompute}
            disabled={recomputing}
            className="h-9 rounded-lg border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/50 hover:text-text-primary disabled:opacity-50"
          >
            {t("schedule.actions.recompute")}
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.days.map((day) => (
          <DayCard key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}

function DayCard({ day }: { day: DayCoverage }) {
  const { t } = useTranslation();
  const date = parseISO(day.date);

  return (
    <div className={`rounded-xl border p-4 ${COVERAGE_BG[day.status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {format(date, "EEEE d MMM")}
          </p>
          <p className={`text-xs ${COVERAGE_TONE[day.status]}`}>
            {t(coverageLabelKey(day.status))}
          </p>
        </div>
        <span className={`font-display text-2xl font-semibold ${COVERAGE_TONE[day.status]}`}>
          {formatPercent(day.coverage_pct)}
        </span>
      </div>

      {!day.has_requirement ? (
        <p className="mt-3 text-xs text-text-muted">{t("schedule.coverage.noRequirement")}</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
            <dt className="text-text-muted">{t("schedule.coverage.estimatedMeals")}</dt>
            <dd className="text-right text-text-secondary">
              {day.estimated_meals !== null ? Math.round(day.estimated_meals) : "—"}
            </dd>
            <dt className="text-text-muted">{t("schedule.coverage.estimatedHours")}</dt>
            <dd className="text-right text-text-secondary">
              {formatHours(day.required_hours)}
            </dd>
            <dt className="text-text-muted">{t("schedule.coverage.scheduled")}</dt>
            <dd className="text-right text-text-secondary">
              {formatHours(day.scheduled_hours)} · {day.scheduled_headcount}/
              {day.required_headcount} {t("schedule.coverage.people")}
            </dd>
          </dl>

          {day.roles.length > 0 ? (
            <div className="mt-3 space-y-1 border-t border-surface-4/60 pt-3">
              {day.roles.map((role) => (
                <div key={role.name} className="flex items-center justify-between text-xs">
                  <span className="truncate text-text-muted">{role.name}</span>
                  <span className={COVERAGE_TONE[role.status]}>
                    {role.scheduled_headcount}/{role.required_headcount}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
