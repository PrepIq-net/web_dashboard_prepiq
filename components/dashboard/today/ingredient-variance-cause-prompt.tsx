"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { formatQuantity } from "@/lib/format";
import { useUpdateIngredientVarianceCause } from "@/services/inventory/hooks";
import type { BranchDayToday } from "@/services/production-intelligence/types";

const CAUSES = [
  "OVER_PORTIONING",
  "RECIPE_CHANGE",
  "EXTRA_WASTE",
  "SHRINKAGE_OR_THEFT",
  "COUNT_ERROR",
  "HIGHER_SALES",
  "OTHER",
] as const;

type Cause = (typeof CAUSES)[number];
type IngredientVarianceRow = NonNullable<
  NonNullable<BranchDayToday["review_phase"]>["ingredient_variance_review"]
>[number];

/**
 * Ingredient-grain sibling of DayVarianceCausePrompt: the day-level prompt
 * asks why the day's total sales volume missed forecast (one question, one
 * answer). This asks why individual ingredients' consumption missed
 * prediction (task.md §10 — over-portioning, shrinkage, a recipe that
 * changed), which is a per-ingredient list, not a single number, so each row
 * gets its own cause selector rather than one shared control.
 *
 * Only ever shows rows the server already decided are worth asking about
 * (exceeds_threshold, or already answered) — same "server decides, client
 * never re-derives" rule the day-level prompt documents.
 */
function IngredientVarianceRowPrompt({
  row,
  branchId,
}: {
  row: IngredientVarianceRow;
  branchId: string;
}) {
  const { t } = useTranslation();
  const mutation = useUpdateIngredientVarianceCause(branchId);

  const [cause, setCause] = useState<Cause | "">((row.cause ?? "") as Cause | "");
  const [note, setNote] = useState(row.cause_note ?? "");
  const [saved, setSaved] = useState(Boolean(row.cause));

  const ratioPct = Math.round(row.variance_ratio * 100);

  const save = (nextCause: Cause | "", nextNote: string) => {
    mutation.mutate(
      { usageId: row.usage_id, cause: nextCause, cause_note: nextNote },
      { onSuccess: () => setSaved(Boolean(nextCause)) },
    );
  };

  const selectCause = (next: Cause) => {
    const value = cause === next ? "" : next;
    setCause(value);
    setSaved(false);
    // OTHER carries no information without the note, so hold the write
    // until there's something to store — same rule as the day-level prompt.
    if (value === "OTHER" && !note.trim()) return;
    save(value, value ? note : "");
  };

  return (
    <div className="rounded-xl border border-surface-4 bg-surface-3 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-text-primary">{row.ingredient_name}</p>
        <p
          className={`text-sm font-semibold ${ratioPct > 0 ? "text-status-warning" : "text-brand-gold"}`}
        >
          {ratioPct > 0 ? "+" : ""}
          {ratioPct}%
        </p>
      </div>
      <p className="mt-0.5 text-xs text-text-muted">
        {t("today.closed.ingredientVariance.predictedVsActual", {
          predicted: formatQuantity(row.predicted_usage, row.unit),
          actual: formatQuantity(row.actual_usage, row.unit),
        })}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {CAUSES.map((value) => {
          const isActive = cause === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => selectCause(value)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                isActive
                  ? "border-brand-gold bg-brand-gold/10 text-brand-gold"
                  : "border-surface-4 bg-surface-2 text-text-muted hover:border-brand-gold/30 hover:bg-brand-gold/5"
              }`}
            >
              {t(`today.closed.ingredientVariance.cause.${value}`)}
            </button>
          );
        })}
      </div>

      {cause === "OTHER" && (
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
          className="mt-2.5 h-9 w-full max-w-sm rounded-lg border border-surface-4 bg-surface-2 px-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-gold focus:outline-none"
        />
      )}

      {saved && (
        <p className="mt-2 text-[11px] text-text-muted">
          {t("today.closed.variance.saved")}
        </p>
      )}
    </div>
  );
}

export function IngredientVarianceCausePrompt({
  branchDay,
  branchId,
}: {
  branchDay: BranchDayToday;
  branchId: string;
}) {
  const { t } = useTranslation();
  const rows = branchDay.review_phase?.ingredient_variance_review ?? [];
  if (!rows.length) return null;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-text-primary">
          {t("today.closed.ingredientVariance.title")}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {t("today.closed.ingredientVariance.subtitle")}
        </p>
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <IngredientVarianceRowPrompt key={row.usage_id} row={row} branchId={branchId} />
        ))}
      </div>
    </section>
  );
}
