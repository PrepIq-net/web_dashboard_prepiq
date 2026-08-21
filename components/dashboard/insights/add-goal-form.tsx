"use client";

import { useState } from "react";
import { Plus, Xmark } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { useCreateGoal, useGoals } from "@/services/insights/hooks";

const COMPARATORS = ["gt", "gte", "lt", "lte"] as const;
type Comparator = (typeof COMPARATORS)[number];

/**
 * The structured counterpart to typing a sentence into the Analyst chat's
 * `remember` tool — same underlying `AnalystMemory` row, reached by picking
 * a metric from a dropdown instead of phrasing it in natural language.
 */
export function AddGoalForm({ branchId }: { branchId: string }) {
  const { t } = useTranslation();
  const { data } = useGoals(branchId);
  const createGoal = useCreateGoal(branchId);
  const metrics = data?.metrics ?? [];

  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState("");
  const [comparator, setComparator] = useState<Comparator>("gt");
  const [threshold, setThreshold] = useState("");

  const selectedMetric = metrics.find((m) => m.key === metric);

  const reset = () => {
    setOpen(false);
    setMetric("");
    setComparator("gt");
    setThreshold("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(threshold);
    if (!metric || !Number.isFinite(parsed)) return;
    createGoal.mutate(
      { metric, comparator, threshold: parsed },
      { onSuccess: reset },
    );
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-surface-4 px-3 py-2 text-[12px] text-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
      >
        <Plus width={13} height={13} />
        {t("workspace.insights.analysis.addGoal")}
      </button>
    );
  }

  const fieldClass =
    "h-9 w-full rounded-lg border border-surface-4 bg-surface-3 px-2.5 text-[12px] text-text-primary focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-lg border border-surface-4 bg-surface-2 p-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
          {t("workspace.insights.analysis.addGoal")}
        </p>
        <button
          type="button"
          onClick={reset}
          aria-label={t("workspace.insights.analysis.cancel")}
          className="text-text-muted hover:text-text-primary"
        >
          <Xmark width={13} height={13} />
        </button>
      </div>

      <select
        value={metric}
        onChange={(e) => setMetric(e.target.value)}
        className={fieldClass}
        required
      >
        <option value="">{t("workspace.insights.analysis.selectMetric")}</option>
        {metrics.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <select
          value={comparator}
          onChange={(e) => setComparator(e.target.value as Comparator)}
          className={fieldClass}
        >
          {COMPARATORS.map((c) => (
            <option key={c} value={c}>
              {t(`workspace.insights.analysis.comparator.${c}`)}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="any"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder={selectedMetric?.is_percent ? "80" : "40"}
          className={fieldClass}
          required
        />
      </div>

      <button
        type="submit"
        disabled={createGoal.isPending}
        className="h-9 w-full rounded-lg bg-brand-gold text-[12px] font-semibold text-surface-1 transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {createGoal.isPending
          ? t("workspace.insights.analysis.saving")
          : t("workspace.insights.analysis.save")}
      </button>
    </form>
  );
}
