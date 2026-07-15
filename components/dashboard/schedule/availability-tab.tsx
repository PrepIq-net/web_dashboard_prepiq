"use client";

import { Check, Xmark } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import type {
  AvailabilityStatus,
  AvailabilityWeek,
  EmployeeAvailability,
} from "@/services/schedule/types";
import { weekDates, formatDayLabel, toIso } from "./schedule-helpers";

type AvailabilityTabProps = {
  data: AvailabilityWeek;
  canReview: boolean;
  reviewingId: string | null;
  onReview: (availabilityId: string, status: "APPROVED" | "REJECTED") => void;
};

const STATUS_VARIANT: Record<AvailabilityStatus, "default" | "secondary" | "destructive"> = {
  APPROVED: "default",
  PENDING: "secondary",
  REJECTED: "destructive",
};

export function AvailabilityTab({
  data,
  canReview,
  reviewingId,
  onReview,
}: AvailabilityTabProps) {
  const { t } = useTranslation();
  const days = weekDates(data.week_start_date);

  if (data.submissions.length === 0 && data.missing.length === 0) {
    return (
      <div className="rounded-xl border border-surface-4/60 bg-surface-2 p-10 text-center">
        <p className="text-sm text-text-muted">{t("schedule.availability.emptyRoster")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-sm">
        <Stat label={t("schedule.availability.submitted", { count: data.summary.submitted })} />
        <Stat
          label={t("schedule.availability.pendingReview", { count: data.summary.pending })}
          tone={data.summary.pending > 0 ? "text-status-warning" : undefined}
        />
        <Stat
          label={t("schedule.availability.missing", { count: data.summary.missing })}
          tone={data.summary.missing > 0 ? "text-status-critical" : undefined}
        />
      </div>

      {data.submissions.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[760px] space-y-px overflow-hidden rounded-xl border border-surface-4/60 bg-surface-4/60">
            <div className="grid grid-cols-[200px_repeat(7,1fr)_150px] gap-px">
              <div className="bg-surface-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {t("schedule.grid.employee")}
              </div>
              {days.map((day) => (
                <div
                  key={toIso(day)}
                  className="bg-surface-2 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"
                >
                  {formatDayLabel(day)}
                </div>
              ))}
              <div className="bg-surface-2 px-3 py-2" />
            </div>

            {data.submissions.map((submission) => (
              <SubmissionRow
                key={submission.id}
                submission={submission}
                canReview={canReview}
                reviewing={reviewingId === submission.id}
                onReview={onReview}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-4/60 bg-surface-2 p-10 text-center">
          <p className="text-sm text-text-muted">{t("schedule.availability.empty")}</p>
        </div>
      )}

      {data.missing.length > 0 ? (
        <div className="rounded-xl border border-surface-4/60 bg-surface-2 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("schedule.availability.missing", { count: data.missing.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            {data.missing.map((person) => (
              <span
                key={person.id}
                title={t("schedule.availability.notSubmittedYet")}
                className="rounded-full border border-surface-4 bg-surface-3 px-3 py-1 text-xs text-text-secondary"
              >
                {person.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, tone }: { label: string; tone?: string }) {
  return <span className={tone ?? "text-text-secondary"}>{label}</span>;
}

type SubmissionRowProps = {
  submission: EmployeeAvailability;
  canReview: boolean;
  reviewing: boolean;
  onReview: (availabilityId: string, status: "APPROVED" | "REJECTED") => void;
};

function SubmissionRow({ submission, canReview, reviewing, onReview }: SubmissionRowProps) {
  const { t } = useTranslation();
  const days = weekDates(submission.week_start_date);

  // One dot per shift the person offered that day — enough to read the shape of
  // a week at a glance without rendering a full template matrix.
  const availableByWeekday = new Map<number, string[]>();
  for (const entry of submission.entries) {
    if (!entry.is_available) continue;
    const list = availableByWeekday.get(entry.weekday) ?? [];
    list.push(entry.shift_template_name);
    availableByWeekday.set(entry.weekday, list);
  }

  return (
    <div className="grid grid-cols-[200px_repeat(7,1fr)_150px] gap-px">
      <div className="bg-surface-2 px-3 py-3">
        <p className="truncate text-sm text-text-primary">{submission.user.name}</p>
        <Badge variant={STATUS_VARIANT[submission.status]} className="mt-1">
          {t(`schedule.status.${submission.status.toLowerCase()}`)}
        </Badge>
        {submission.note ? (
          <p className="mt-1 truncate text-[11px] text-text-muted" title={submission.note}>
            {submission.note}
          </p>
        ) : null}
      </div>

      {days.map((day, index) => {
        const shifts = availableByWeekday.get(index) ?? [];
        return (
          <div
            key={toIso(day)}
            className="flex items-center justify-center bg-surface-2 px-2 py-3"
            title={shifts.join(", ")}
          >
            {shifts.length > 0 ? (
              <div className="flex gap-1">
                {shifts.map((name) => (
                  <span
                    key={name}
                    className="h-1.5 w-1.5 rounded-full bg-status-success"
                    aria-label={name}
                  />
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-text-muted/40">—</span>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-end gap-1 bg-surface-2 px-3 py-3">
        {canReview && submission.status !== "APPROVED" ? (
          <button
            type="button"
            disabled={reviewing}
            onClick={() => onReview(submission.id, "APPROVED")}
            aria-label={t("schedule.actions.approve")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-4 text-status-success transition-colors hover:bg-status-success/10 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
        ) : null}
        {canReview && submission.status !== "REJECTED" ? (
          <button
            type="button"
            disabled={reviewing}
            onClick={() => onReview(submission.id, "REJECTED")}
            aria-label={t("schedule.actions.reject")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-surface-4 text-status-critical transition-colors hover:bg-status-critical/10 disabled:opacity-50"
          >
            <Xmark className="h-4 w-4" />
          </button>
        ) : null}
        {submission.reviewed_by ? (
          <span className="truncate text-[10px] text-text-muted">
            {t("schedule.availability.reviewedBy", { name: submission.reviewed_by.name })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
