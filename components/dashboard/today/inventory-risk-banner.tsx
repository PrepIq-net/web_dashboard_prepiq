"use client";

import { WarningTriangle, NavArrowRight } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { IngredientRequirement } from "@/services/production-intelligence/types";

/**
 * Morning-phase headline for store-room readiness, task.md's literal
 * framing: "N inventory risks need attention". The full per-ingredient
 * breakdown (now with a coverage_pct per line, "Chicken ⚠️ 82%") already
 * lives in IngredientRequirements further down the page — this is the
 * one-line summary a chef sees before scrolling there, sitting where the
 * per-item risk cards already are so store-room risk reads as part of the
 * same morning triage, not a separate world.
 *
 * Renders nothing when there is no computed requirement yet, or when
 * nothing is short — a quiet morning has nothing to announce.
 */
export function InventoryRiskBanner({
  requirement,
}: {
  requirement: IngredientRequirement | null | undefined;
}) {
  const { t } = useTranslation();
  if (!requirement || requirement.shortfall_count <= 0) return null;

  return (
    <a
      href="#ingredient-requirements"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-status-warning/30 bg-status-warning/8 px-4 py-3 transition-colors hover:bg-status-warning/12"
    >
      <div className="flex min-w-0 items-center gap-3">
        <WarningTriangle
          className="h-4 w-4 shrink-0 text-status-warning"
          strokeWidth={1.5}
        />
        <p className="truncate text-sm font-medium text-text-primary">
          {t("today.ingredients.risksNeedAttention", {
            count: requirement.shortfall_count,
          })}
          {requirement.coverage_pct != null ? (
            <span className="text-text-secondary">
              {" "}
              · {t("today.ingredients.coveragePct", {
                pct: requirement.coverage_pct.toFixed(0),
              })}
            </span>
          ) : null}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-status-warning">
        {t("today.ingredients.viewDetails")}
        <NavArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
      </span>
    </a>
  );
}
