"use client";

import { useTranslation } from "@/lib/i18n";
import { formatMoney, formatQuantity, formatSignedMoney } from "@/lib/format";
import type { MorningRiskAlert } from "./today-helpers";

/**
 * Pre-service risk callouts with a one-tap fix. Rendered above the prep table
 * while the plan is still editable.
 */
export function MorningRiskAlerts({
  alerts,
  isPlanLocked,
  canUseAssistant,
  onExplain,
  onApplyFix,
}: {
  alerts: MorningRiskAlert[];
  isPlanLocked: boolean;
  canUseAssistant: boolean;
  onExplain: (topic: string) => void;
  onApplyFix: (alert: MorningRiskAlert) => void;
}) {
  const { t } = useTranslation();
  if (!alerts.length || isPlanLocked) return null;

  return (
    <div className="mb-6 space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start justify-between gap-4 rounded-r-xl border-l-4 px-4 py-3 ${
            alert.severity === "HIGH"
              ? "border-l-status-critical bg-status-critical/8"
              : "border-l-status-warning bg-status-warning/8"
          }`}
        >
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-semibold uppercase tracking-[0.12em] ${alert.severity === "HIGH" ? "text-status-critical" : "text-status-warning"}`}
            >
              {alert.itemName} ·{" "}
              {alert.riskType === "STOCKOUT"
                ? t("today.alert.mayRunOut")
                : alert.riskType === "WASTE"
                  ? t("today.alert.riskOfWaste")
                  : t("today.alert.marginAtRisk")}
            </p>
            <p className="mt-0.5 text-sm text-text-secondary">
              {alert.riskType === "STOCKOUT"
                ? alert.financials.lostMarginIfStockout != null &&
                  alert.financials.lostMarginIfStockout > 0
                  ? t("today.alert.stockoutRiskWithMargin", {
                      amount: formatMoney(alert.financials.lostMarginIfStockout),
                    })
                  : t("today.alert.stockoutRisk")
                : alert.riskType === "WASTE"
                  ? alert.financials.wasteIfAll != null &&
                    alert.financials.wasteIfAll > 0
                    ? t("today.alert.wasteRiskWithCost", {
                        amount: formatMoney(alert.financials.wasteIfAll),
                      })
                    : t("today.alert.wasteRisk")
                  : alert.riskMetrics.marginImpact !== 0
                    ? t("today.alert.marginRiskWithImpact", {
                        amount: formatSignedMoney(alert.riskMetrics.marginImpact),
                      })
                    : t("today.alert.marginRisk")}
            </p>
          </div>
          {canUseAssistant ? (
            <button
              type="button"
              onClick={() =>
                onExplain(`${alert.itemName} ${alert.riskType.toLowerCase()} risk`)
              }
              className="shrink-0 inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-semibold text-text-secondary transition-colors hover:border-brand-gold hover:text-text-primary"
            >
              {t("today.alert.why")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onApplyFix(alert)}
            disabled={isPlanLocked}
            className={`shrink-0 inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
              alert.severity === "HIGH"
                ? "border-status-critical/40 bg-status-critical/10 text-status-critical hover:bg-status-critical/20"
                : "border-status-warning/40 bg-status-warning/10 text-status-warning hover:bg-status-warning/20"
            }`}
          >
            {t("today.alert.fixTo", {
              quantity: formatQuantity(alert.suggestedFixQty, alert.unit),
            })}
          </button>
        </div>
      ))}
    </div>
  );
}
