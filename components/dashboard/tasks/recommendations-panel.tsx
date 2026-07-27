"use client";

import { useState } from "react";
import { Brain, Plus } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { TaskRecommendation } from "@/services/execution/types";

/**
 * Predictive recommendations mined from this kitchen's own task history:
 * "on days like today you usually run these tasks, and this is who usually
 * does them". Distinct from the SuggestionsTray (which splits the locked
 * plan) — these are recurring operational tasks the plan doesn't know about.
 * Adding one creates a real board task assigned per the recommendation.
 */
export function RecommendationsPanel({
  recommendations,
  adding,
  onAdd,
}: {
  recommendations: TaskRecommendation[];
  adding: boolean;
  onAdd: (recommendation: TaskRecommendation) => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [addedTitles, setAddedTitles] = useState<Set<string>>(new Set());

  const visible = recommendations.filter((row) => !addedTitles.has(row.title));
  if (visible.length === 0) return null;

  const handleAdd = (recommendation: TaskRecommendation) => {
    onAdd(recommendation);
    setAddedTitles((previous) => new Set(previous).add(recommendation.title));
  };

  return (
    <section className="mb-8 rounded-xl border border-surface-4 bg-surface-2">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-brand-gold" />
          <p className="text-sm font-semibold text-text-primary">
            {t("tasks.recommendations.title", { count: visible.length })}
          </p>
        </div>
        <span className="text-xs text-text-muted">
          {collapsed
            ? t("tasks.recommendations.show")
            : t("tasks.recommendations.hide")}
        </span>
      </button>

      {collapsed ? null : (
        <div className="divide-y divide-surface-4 border-t border-surface-4">
          {visible.map((recommendation) => (
            <div
              key={`${recommendation.category}:${recommendation.title}`}
              className="flex flex-wrap items-center gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">
                  {recommendation.title}
                  {recommendation.estimated_minutes ? (
                    <span className="ml-2 text-xs text-text-muted">
                      ~{recommendation.estimated_minutes} min
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {recommendation.explanation}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAdd(recommendation)}
                disabled={adding}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-3 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {recommendation.suggested_staff
                  ? t("tasks.recommendations.addAssigned", {
                      name: recommendation.suggested_staff.name,
                    })
                  : t("tasks.recommendations.add")}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
