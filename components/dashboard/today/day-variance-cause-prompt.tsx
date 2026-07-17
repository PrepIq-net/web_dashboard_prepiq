"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useUpdateBranchDayNotes } from "@/services/production-intelligence/hooks";
import type { BranchDayToday } from "@/services/production-intelligence/types";

const CAUSES = [
  "HEAVY_RAIN",
  "PUBLIC_HOLIDAY",
  "ROAD_CLOSURE",
  "EVENT_CANCELLED",
  "PRIVATE_EVENT",
  "STAFF_SHORTAGE",
  "SUPPLIER_ISSUE",
  "EQUIPMENT_FAILURE",
  "POWER_OUTAGE",
  "OTHER",
] as const;

type Cause = (typeof CAUSES)[number];

/**
 * Asks why the day's volume missed forecast, when it missed by enough to be
 * worth a manager's attention. Rendered only when the server says
 * variance_review.exceeds_threshold — a normal day shows nothing at all.
 *
 * The answer is a training label, not a note: it decides whether the day
 * teaches a demand pattern or gets dropped from training entirely.
 */
export function DayVarianceCausePrompt({
  branchDay,
}: {
  branchDay: BranchDayToday;
}) {
  const { t } = useTranslation();
  const updateBranchDayNotes = useUpdateBranchDayNotes();
  const variance = branchDay.review_phase?.variance_review;

  const [cause, setCause] = useState<Cause | "">(
    (variance?.cause ?? "") as Cause | "",
  );
  const [note, setNote] = useState(variance?.cause_note ?? "");
  const [saved, setSaved] = useState(Boolean(variance?.cause));

  if (!variance?.exceeds_threshold || variance.variance_ratio === null) {
    return null;
  }

  const ratioPct = Math.round(variance.variance_ratio * 100);
  const isBelow = ratioPct < 0;

  const save = (nextCause: Cause | "", nextNote: string) => {
    if (!branchDay.id) return;
    updateBranchDayNotes.mutate(
      {
        branchDayId: branchDay.id,
        variance_cause: nextCause,
        variance_cause_note: nextNote,
      },
      { onSuccess: () => setSaved(Boolean(nextCause)) },
    );
  };

  const selectCause = (next: Cause) => {
    const value = cause === next ? "" : next;
    setCause(value);
    setSaved(false);
    // OTHER carries no information without the note, so hold the write until
    // there is something to store.
    if (value === "OTHER" && !note.trim()) return;
    save(value, value ? note : "");
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-text-primary">
          {t("today.closed.variance.title")}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {isBelow
            ? t("today.closed.variance.subtitleBelow")
            : t("today.closed.variance.subtitleAbove")}
        </p>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            {t("today.closed.variance.expected")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {Math.round(variance.forecast_total)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            {t("today.closed.variance.actual")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">
            {Math.round(variance.actual_total)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            {t("today.closed.variance.difference")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-brand-gold">
            {ratioPct > 0 ? "+" : ""}
            {ratioPct}%
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs text-text-muted">
          {t("today.closed.variance.whatHappened")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CAUSES.map((value) => {
            const isActive = cause === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => selectCause(value)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? "border-brand-gold bg-brand-gold/10 text-brand-gold"
                    : "border-surface-4 bg-surface-3 text-text-muted hover:border-brand-gold/30 hover:bg-brand-gold/5"
                }`}
              >
                {t(`today.closed.variance.cause.${value}`)}
              </button>
            );
          })}
        </div>
      </div>

      {cause === "OTHER" && (
        <div className="max-w-lg">
          <input
            type="text"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(false);
            }}
            onBlur={() => {
              if (note.trim()) save("OTHER", note.trim());
            }}
            placeholder={t("today.closed.variance.otherPlaceholder")}
            className="h-10 w-full rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold focus:outline-none"
          />
        </div>
      )}

      {saved && (
        <p className="text-xs text-text-muted">
          {t("today.closed.variance.saved")}
        </p>
      )}
    </section>
  );
}
