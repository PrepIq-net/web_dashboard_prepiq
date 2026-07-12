"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { percent01, toPercent } from "@/lib/format";
import type { BranchDayToday } from "@/services/production-intelligence/types";
import {
  getFallbackDemandSignals,
  signalToneClasses,
  type PrepRow,
} from "./today-helpers";

/**
 * The always-visible morning strip: expected demand vs normal, the signals
 * driving it, an actionable outlook sentence, and how reliable the plan is.
 * All derivations from the branch day live here so the page stays thin.
 */
export function MorningOutlook({
  branchDay,
  rows,
  rowsByDemand,
  hideSignals,
}: {
  branchDay: BranchDayToday;
  rows: PrepRow[];
  rowsByDemand: PrepRow[];
  /** The morning brief already shows audited signals — avoid two signal rows. */
  hideSignals: boolean;
}) {
  const { t } = useTranslation();

  const demandDeltaPct =
    branchDay.demand_signal.expected_demand_delta_pct ??
    (branchDay.demand_signal.expected_demand_index - 1) * 100;

  const demandSignals = useMemo(
    () =>
      branchDay.demand_signal.signals?.length
        ? branchDay.demand_signal.signals
        : getFallbackDemandSignals(t),
    [branchDay.demand_signal.signals, t],
  );

  const prepConfidenceGauge = useMemo(() => {
    if (!rows.length) return 0;
    const avgItemConfidence =
      rows.reduce(
        (sum, row) => sum + row.item.forecast_context.confidence_score,
        0,
      ) / rows.length;
    const avgRisk =
      rows.reduce((sum, row) => sum + row.riskScore, 0) / rows.length;
    const base =
      branchDay.demand_signal.forecast_confidence * 0.45 +
      avgItemConfidence * 0.4 +
      (1 - avgRisk) * 0.15;
    return Math.max(0, Math.min(1, base));
  }, [rows, branchDay.demand_signal.forecast_confidence]);

  const riskLevel =
    prepConfidenceGauge >= 0.75
      ? "low"
      : prepConfidenceGauge >= 0.55
        ? "medium"
        : "high";

  const outlookActionSentence = useMemo(() => {
    if (!rows.length) return null;
    const delta = demandDeltaPct;
    const directionWord = delta >= 2 ? "up" : delta <= -2 ? "down" : "steady";
    const deltaPlan =
      delta >= 2
        ? `+${Math.round(Math.abs(delta))}%`
        : delta <= -2
          ? `${Math.round(delta)}%`
          : null;
    const topRiskItems = rows
      .filter((row) => row.riskScore >= 0.35)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 2)
      .map((row) => row.item.product_title);
    const topDemandItems = rowsByDemand
      .slice(0, 2)
      .map((row) => row.item.product_title);
    const priorityItems = topRiskItems.length ? topRiskItems : topDemandItems;
    if (directionWord === "steady") {
      return priorityItems.length
        ? t("today.outlook.maintainBaselineWatch", {
            items: priorityItems.join(t("today.outlook.and")),
          })
        : t("today.outlook.maintainBaselineAll");
    }
    const planAction = deltaPlan
      ? t("today.outlook.planAcrossAll", { delta: deltaPlan })
      : "";
    const suffix =
      directionWord === "up"
        ? t("today.outlook.sensitiveSuffix")
        : t("today.outlook.wasteSuffix");
    return priorityItems.length
      ? `${planAction} ${t("today.outlook.prioritize", { items: priorityItems.join(t("today.outlook.and")), suffix })}`
      : `${planAction} ${t("today.outlook.reviewHighDemand")}`;
  }, [rows, rowsByDemand, demandDeltaPct, t]);

  const demandMeterPosition = (() => {
    const clamped = Math.max(-20, Math.min(20, demandDeltaPct));
    return ((clamped + 20) / 40) * 100;
  })();

  return (
    <div className="mb-8 pb-8 border-b border-surface-4/50">
      <div className="flex flex-wrap items-start gap-8">
        {/* Demand KPI + meter */}
        <div className="shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.expectedDemand")}
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className={`font-display text-4xl font-semibold tracking-[-0.5px] ${
                demandDeltaPct >= 2
                  ? "text-status-success"
                  : demandDeltaPct <= -2
                    ? "text-status-warning"
                    : "text-text-primary"
              }`}
            >
              {toPercent(demandDeltaPct)}
            </span>
            <span className="text-sm text-text-muted">
              {demandDeltaPct <= -2
                ? t("today.demand.quieter")
                : demandDeltaPct >= 2
                  ? t("today.demand.busier")
                  : t("today.demand.normal")}
            </span>
          </div>
          <div className="mt-3 relative h-[3px] w-40 rounded-full bg-surface-4">
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-brand-gold shadow-sm"
              style={{ left: `calc(${demandMeterPosition}% - 6px)` }}
            />
          </div>
          <div className="mt-1 flex w-40 justify-between text-[9px] text-text-muted/60">
            <span>{t("today.demand.quiet")}</span>
            <span>{t("today.demand.normalShort")}</span>
            <span>{t("today.demand.busy")}</span>
          </div>
        </div>

        <div className="hidden sm:block w-px self-stretch bg-surface-4/60" />

        {/* Signal chips + action sentence */}
        <div className="flex-1 min-w-[180px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.demandSignals")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(() => {
              if (hideSignals) return null;
              const activeSignals = demandSignals.filter(
                (s) => s.direction !== "neutral",
              );
              if (activeSignals.length === 0) {
                return (
                  <span className="text-[11px] italic text-text-muted">
                    {t("today.demandSignals.noStrong")}
                  </span>
                );
              }
              return activeSignals.slice(0, 4).map((signal) => {
                const learned = "learned" in signal ? signal.learned : null;
                return (
                  <span
                    key={signal.key}
                    title={
                      learned && learned.sample_count > 0
                        ? t("today.signalLearnedFrom", {
                            count: learned.sample_count,
                          })
                        : undefined
                    }
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${signalToneClasses(signal.direction, signal.value_pct)}`}
                  >
                    {signal.label}
                    <span className="font-semibold">
                      {toPercent(signal.value_pct)}
                    </span>
                    {learned && learned.sample_count > 0 ? (
                      <span
                        className="h-1 w-1 rounded-full bg-brand-gold"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                );
              });
            })()}
          </div>
          {outlookActionSentence ? (
            <p className="mt-3 text-xs text-text-secondary">
              <span className="mr-1 font-semibold text-brand-gold">→</span>
              {outlookActionSentence}
            </p>
          ) : null}
        </div>

        <div className="hidden sm:block w-px self-stretch bg-surface-4/60" />

        {/* Plan reliability */}
        <div className="shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.planReliability")}
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-4xl font-semibold tracking-[-0.5px] text-text-primary">
              {percent01(prepConfidenceGauge)}
            </span>
            <span
              className={`text-sm font-medium ${
                riskLevel === "low"
                  ? "text-status-success"
                  : riskLevel === "medium"
                    ? "text-status-warning"
                    : "text-status-critical"
              }`}
            >
              {riskLevel === "low"
                ? t("today.prepRiskLabel.goodShape")
                : riskLevel === "medium"
                  ? t("today.prepRiskLabel.reviewItems")
                  : t("today.prepRiskLabel.checkAlerts")}
            </span>
          </div>
          <div className="mt-2 h-[3px] w-40 overflow-hidden rounded-full bg-surface-4">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                riskLevel === "low"
                  ? "bg-status-success"
                  : riskLevel === "medium"
                    ? "bg-status-warning"
                    : "bg-status-critical"
              }`}
              style={{ width: percent01(prepConfidenceGauge) }}
            />
          </div>
          <div className="mt-2 flex gap-6 text-[11px]">
            <div>
              <p className="text-text-muted">{t("today.needsAttention")}</p>
              <p className="font-semibold text-text-primary">
                {branchDay.morning_overview?.high_risk_items ??
                  branchDay.demand_signal.high_risk_items ??
                  0}
              </p>
            </div>
            <div>
              <p className="text-text-muted">{t("today.tracked")}</p>
              <p className="font-semibold text-text-primary">
                {branchDay.demand_signal.tracked_items ?? rows.length}
              </p>
            </div>
          </div>
          {branchDay.demand_signal.confidence_breakdown &&
          branchDay.demand_signal.forecast_confidence < 0.75 ? (
            <p className="mt-2 max-w-[180px] text-[10px] leading-snug text-text-muted">
              <span className="font-semibold text-status-warning">
                {t("today.why")}:{" "}
              </span>
              {branchDay.demand_signal.confidence_breakdown.limiting_factor}.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
