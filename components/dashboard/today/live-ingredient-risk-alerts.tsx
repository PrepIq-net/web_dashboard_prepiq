"use client";

import { WarningTriangle } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { useIgnoreBranchDayLiveAlert } from "@/services/production-intelligence/hooks";
import type { BranchDayToday } from "@/services/production-intelligence/types";

/**
 * Ingredient-level stockout risk during live service — the raw-stock
 * counterpart to the per-dish STOCKOUT_RISK/WASTE_RISK/SALES_SPIKE cards.
 * Both come back in the same `live_alerts` feed (inventory.live_risk merges
 * into BranchDayTodaySerializer.get_live_alerts); this filters to the
 * ingredient-typed ones and renders them as compact dismissible rows.
 *
 * Snoozing reuses the same RiskEvent cooldown mechanism the dish-level
 * alerts use — see ignore_branch_day_live_alert — so a dismissed alert
 * stays quiet for the same 45 minutes rather than reappearing next refresh.
 */
export function LiveIngredientRiskAlerts({
  branchDay,
}: {
  branchDay: BranchDayToday;
}) {
  const { t } = useTranslation();
  const ignoreMutation = useIgnoreBranchDayLiveAlert();

  const alerts = (branchDay.live_alerts ?? []).filter(
    (alert) => alert.type === "INGREDIENT_STOCKOUT_RISK",
  );
  if (!alerts.length) return null;

  return (
    <div className="mb-4 space-y-2">
      {alerts.map((alert) => {
        const critical = alert.severity === "CRITICAL";
        return (
          <div
            key={alert.id}
            className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
              critical
                ? "border-status-critical/30 bg-status-critical/8"
                : "border-status-warning/30 bg-status-warning/8"
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <WarningTriangle
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  critical ? "text-status-critical" : "text-status-warning"
                }`}
                strokeWidth={1.5}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  {alert.message}
                </p>
                {alert.suggested_action ? (
                  <p className="mt-1 text-xs text-text-secondary">
                    {alert.suggested_action}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={ignoreMutation.isPending}
              onClick={() => {
                if (!branchDay.id || !alert.ingredient_id) return;
                ignoreMutation.mutate({
                  branchDayId: branchDay.id,
                  payload: {
                    ingredient_id: alert.ingredient_id,
                    alert_type: "INGREDIENT_STOCKOUT_RISK",
                  },
                });
              }}
              className="shrink-0 text-xs font-semibold text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
            >
              {t("today.liveAlerts.snooze")}
            </button>
          </div>
        );
      })}
    </div>
  );
}
