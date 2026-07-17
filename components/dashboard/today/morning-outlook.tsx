"use client";

import { useMemo } from "react";
import { InfoCircle } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { percent01, toPercent } from "@/lib/format";
import type { BranchDayToday } from "@/services/production-intelligence/types";
import type { PrepRow } from "./today-helpers";

/**
 * The always-visible morning strip: expected demand vs normal (with a
 * plain-language tooltip), an actionable outlook sentence, and how reliable
 * the plan is — explained without algorithm jargon. The demand-signal chips
 * moved to the global DemandSignalsBanner.
 */
export function MorningOutlook({
  branchDay,
  rows,
  rowsByDemand,
  onExplainReliability,
}: {
  branchDay: BranchDayToday;
  rows: PrepRow[];
  rowsByDemand: PrepRow[];
  /** Opens the assistant with a conversational explanation of the score. */
  onExplainReliability?: () => void;
}) {
  const { t } = useTranslation();

  const demandDeltaPct =
    branchDay.demand_signal.expected_demand_delta_pct ??
    (branchDay.demand_signal.expected_demand_index - 1) * 100;

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

  const expectedDemandHint = t("today.expectedDemandHint", {
    typicalDay:
      branchDay.demand_signal.typical_day_label ??
      t("today.signalsBanner.typicalDay"),
  });

  // Plain-language verdict: is this score fine or does it need a buffer?
  const reliabilityVerdict =
    riskLevel === "low"
      ? t("today.reliability.verdictSolid")
      : riskLevel === "medium"
        ? t("today.reliability.verdictOkay")
        : t("today.reliability.verdictRisky");

  return (
    <div className="mb-8 pb-8 border-b border-surface-4/50">
      <div className="flex flex-wrap items-start gap-8">
        {/* Demand KPI + meter */}
        <div className="shrink-0">
          <div className="group relative flex items-center gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("today.expectedDemand")}
            </p>
            <InfoCircle
              className="h-3 w-3 cursor-help text-text-muted/70"
              aria-label={expectedDemandHint}
            />
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-64 rounded-lg border border-surface-4 bg-surface-2 px-3 py-2.5 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-text-secondary shadow-lg group-hover:block"
            >
              {expectedDemandHint}
            </div>
          </div>
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

        {/* Outlook action sentence */}
        <div className="flex-1 min-w-[180px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.outlook.eyebrow")}
          </p>
          {outlookActionSentence ? (
            <p className="mt-2 text-sm text-text-secondary">
              <span className="mr-1 font-semibold text-brand-gold">→</span>
              {outlookActionSentence}
            </p>
          ) : (
            <p className="mt-2 text-sm text-text-muted">
              {t("today.outlook.noItems")}
            </p>
          )}
        </div>

        <div className="hidden sm:block w-px self-stretch bg-surface-4/60" />

        {/* Plan reliability — plain language, no algorithm jargon */}
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
          <p className="mt-2 max-w-[210px] text-[11px] leading-snug text-text-secondary">
            {reliabilityVerdict}
          </p>
          <div className="mt-2 flex items-center gap-6 text-[11px]">
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
            {onExplainReliability ? (
              <button
                type="button"
                onClick={onExplainReliability}
                className="self-end text-[11px] font-semibold text-brand-gold transition-colors hover:text-brand-gold/80"
              >
                {t("today.why")}?
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
