"use client";

import Link from "next/link";
import { ForecastDriverWaterfall } from "./forecast-driver-waterfall";
import { ConfidenceBreakdown } from "./confidence-breakdown";
import { ActionRecommendationCard } from "./action-recommendation-card";
import { ScenarioBarChart } from "@/components/dashboard/scenario-bar-chart";

type AdvancedForecastModalContentProps = {
  advancedForecast: any;
  forecastMetrics: any;
  dataQuality: any;
  velocitySnapshot: any;
  velocityLastUpdated: Date | null;
  velocityMutation: any;
  branchDay: any;
  selectedPrepItem: any;
  safeBranchId: string;
  selectedItemId: string;
  targetDate: string;
  isPlanLocked: boolean;
  onAcceptAction: (recommendedQty?: number) => void;
  onPlannedChange: (prepPlanItemId: string, value: string, unit: string) => void;
  acceptSuggestion: (prepPlanItemId: string, suggestedQuantity: number, unit: string) => void;
};

function percent(value: number) {
  const normalized = Math.max(0, Math.min(1, value));
  return `${(normalized * 100).toFixed(0)}%`;
}

function confidenceNarrative(score?: number | null) {
  if (score == null) return "Insufficient history to score confidence.";
  if (score >= 0.75) return "High confidence based on stable recent demand.";
  if (score >= 0.5) return "Moderate confidence with some expected variance.";
  return "Low confidence; demand is volatile or sparse.";
}

function agreementNarrative(score?: number | null) {
  if (score == null) return "Consensus not available for this forecast.";
  if (score >= 0.75) return "Models align closely on expected demand.";
  if (score >= 0.5) return "Models partially agree; signals are mixed.";
  return "Models diverge; treat the forecast as less certain.";
}

function velocitySummary(comparison?: {
  status?: string;
  deviation_pct?: number;
}) {
  if (!comparison || !comparison.status) {
    return "No live pace check yet. Tap update to compare today's sales pace to plan.";
  }
  const deviation = comparison.deviation_pct ?? 0;
  const absDeviation = Math.abs(deviation);
  const deviationLabel = `${absDeviation.toFixed(0)}%`;
  if (comparison.status === "HIGH_DEMAND") {
    return `Selling faster than plan by ${deviationLabel}. Consider a quick batch cook to protect revenue.`;
  }
  if (comparison.status === "LOW_DEMAND") {
    return `Sales are ${deviationLabel} below plan. Slow prep to reduce waste.`;
  }
  return "Sales pace matches the plan. Keep the current prep rhythm.";
}

function velocityStatusTone(status?: string) {
  if (status === "HIGH_DEMAND") return "text-status-critical";
  if (status === "LOW_DEMAND") return "text-status-warning";
  return "text-status-success";
}

function formatQuantity(value: number, unit: string) {
  const isDiscrete = ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes(
    unit.toUpperCase(),
  );
  return isDiscrete ? `${Math.round(value)} ${unit}` : `${value.toFixed(2)} ${unit}`;
}

export function AdvancedForecastModalContent({
  advancedForecast,
  forecastMetrics,
  dataQuality,
  velocitySnapshot,
  velocityLastUpdated,
  velocityMutation,
  branchDay,
  selectedPrepItem,
  safeBranchId,
  selectedItemId,
  targetDate,
  isPlanLocked,
  onAcceptAction,
  onPlannedChange,
  acceptSuggestion,
}: AdvancedForecastModalContentProps) {
  return (
    <div className="space-y-6">
      {/* ── 1. Action Recommendations (Top Priority) ── */}
      {advancedForecast?.action_recommendations?.length ? (
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-3">
            Recommended Actions
          </p>
          <div className="space-y-2">
            {advancedForecast.action_recommendations.map((action: any, index: number) => (
              <ActionRecommendationCard
                key={index}
                action={action}
                unit={selectedPrepItem?.unit ?? "PCS"}
                onAccept={(recommendedQty) => {
                  if (recommendedQty && selectedPrepItem) {
                    onPlannedChange(selectedPrepItem.id, String(recommendedQty), selectedPrepItem.unit);
                    acceptSuggestion(selectedPrepItem.id, recommendedQty, selectedPrepItem.unit);
                  }
                }}
                disabled={isPlanLocked}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── 2. Confidence Hero + Breakdown ── */}
      <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Forecast Confidence
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <p className="font-display text-4xl font-semibold text-text-primary">
                {advancedForecast?.confidence != null
                  ? percent(advancedForecast.confidence)
                  : "—"}
              </p>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                  (advancedForecast?.confidence ?? 0) >= 0.75
                    ? "bg-status-success/20 text-status-success"
                    : (advancedForecast?.confidence ?? 0) >= 0.50
                      ? "bg-status-warning/20 text-status-warning"
                      : "bg-status-critical/20 text-status-critical"
                }`}
              >
                {advancedForecast?.confidence_label ?? "—"}
              </span>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              {confidenceNarrative(advancedForecast?.confidence)}
            </p>
          </div>
          <div className="rounded-lg border border-surface-4 bg-surface-3/50 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
              Recommended Prep
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
              {advancedForecast?.ensemble_forecast != null
                ? formatQuantity(
                    advancedForecast.ensemble_forecast,
                    selectedPrepItem?.unit ?? "PCS",
                  )
                : "—"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Risk-adjusted:{" "}
              {advancedForecast?.loss_optimized_qty != null
                ? formatQuantity(
                    advancedForecast.loss_optimized_qty,
                    selectedPrepItem?.unit ?? "PCS",
                  )
                : "—"}
            </p>
          </div>
        </div>

        {advancedForecast?.confidence_breakdown ? (
          <ConfidenceBreakdown
            dataQualityScore={advancedForecast.confidence_breakdown.data_quality_score}
            historicalAccuracyScore={advancedForecast.confidence_breakdown.historical_accuracy_score}
            signalReliabilityScore={advancedForecast.confidence_breakdown.signal_reliability_score}
            patternValidationScore={advancedForecast.confidence_breakdown.pattern_validation_score}
            confidenceFactors={advancedForecast.confidence_breakdown.confidence_factors}
          />
        ) : null}
      </section>

      {/* ── 3. Forecast Driver Breakdown ── */}
      {advancedForecast?.signal_contributions ? (
        <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-3">
            What's Driving This Forecast
          </p>
          <p className="text-sm text-text-secondary mb-4">
            Starting from baseline, here's how each signal adjusted the final number.
          </p>
          <ForecastDriverWaterfall
            baselineQty={advancedForecast.signal_contributions.baseline_qty}
            finalQty={advancedForecast.signal_contributions.final_qty}
            steps={advancedForecast.signal_contributions.waterfall_steps}
            unit={selectedPrepItem?.unit ?? "PCS"}
          />
          
          {advancedForecast.signal_contributions.drivers?.length ? (
            <div className="mt-4 rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-2">
                Signal Contributions
              </p>
              <div className="space-y-2">
                {advancedForecast.signal_contributions.drivers.map((driver: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary">{driver.signal_name}</span>
                      <span className="text-text-muted text-[10px]">
                        {(driver.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <span
                      className={`font-semibold ${
                        driver.direction === "up"
                          ? "text-status-success"
                          : "text-status-critical"
                      }`}
                    >
                      {driver.direction === "up" ? "↑" : "↓"}{" "}
                      {Math.abs(driver.contribution_pct).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ── 4. Scenario Analysis ── */}
      {advancedForecast?.scenarios?.length ? (
        <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-3">
            Scenario Analysis
          </p>
          <p className="text-sm text-text-secondary mb-4">
            How different conditions could affect demand.
          </p>
          <ScenarioBarChart
            baseValue={advancedForecast.ensemble_forecast ?? null}
            scenarios={advancedForecast.scenarios}
            unitLabel={selectedPrepItem?.unit ?? "PCS"}
          />
        </section>
      ) : null}

      {/* ── 5. Historical Performance (Collapsed) ── */}
      <details className="rounded-xl border border-surface-4 bg-surface-2">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-text-primary hover:bg-surface-3/30 transition-colors">
          Historical Performance (Last 60 Days)
        </summary>
        <div className="px-5 pb-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Forecast Accuracy
              </p>
              <p className="mt-1 text-lg font-semibold text-text-primary">
                {forecastMetrics?.forecast_accuracy != null
                  ? `${forecastMetrics.forecast_accuracy.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Avg Error (MAPE)
              </p>
              <p className="mt-1 text-lg font-semibold text-text-primary">
                {forecastMetrics?.mape != null
                  ? `${forecastMetrics.mape.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Stockout Rate
              </p>
              <p className="mt-1 text-lg font-semibold text-status-critical">
                {forecastMetrics?.stockout_rate != null
                  ? `${forecastMetrics.stockout_rate.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Waste Rate
              </p>
              <p className="mt-1 text-lg font-semibold text-status-warning">
                {forecastMetrics?.waste_rate != null
                  ? `${forecastMetrics.waste_rate.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </details>

      {/* ── 6. Data Health (Collapsed) ── */}
      <details className="rounded-xl border border-surface-4 bg-surface-2">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-text-primary hover:bg-surface-3/30 transition-colors">
          Data Health Check
        </summary>
        <div className="px-5 pb-5">
          <div className="flex items-baseline gap-3 mb-3">
            <p className="font-display text-3xl font-semibold text-text-primary">
              {dataQuality?.overall_quality_score != null
                ? `${dataQuality.overall_quality_score.toFixed(0)}%`
                : "—"}
            </p>
            <p className="text-sm text-text-secondary">
              {dataQuality?.quality_label ?? "No quality score yet."}
            </p>
          </div>
          <p className="text-xs text-text-muted">
            {dataQuality?.recommendation ??
              "We'll flag missing or unusual data when it appears."}
          </p>
          {(advancedForecast?.quality_issues ?? []).length > 0 && (
            <div className="mt-3 rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2">
              <p className="text-xs font-semibold text-status-warning mb-1">
                Data Issues Detected
              </p>
              <ul className="space-y-0.5">
                {(advancedForecast?.quality_issues ?? []).map((issue: string, index: number) => (
                  <li key={index} className="text-[11px] text-text-secondary">
                    • {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      {/* ── 7. Live Sales Pace (Only during LIVE status) ── */}
      {branchDay?.status === "LIVE" && (
        <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-2">
            Live Sales Pace
          </p>
          <p className="text-sm text-text-secondary mb-3">
            Comparing last hour of sales to today's plan.
          </p>
          <button
            type="button"
            onClick={() => {
              if (!safeBranchId || !selectedItemId) return;
              velocityMutation.mutate({
                branch_id: safeBranchId,
                item_id: selectedItemId,
                window_minutes: 60,
              });
            }}
            className="inline-flex h-9 items-center rounded-full border border-surface-4 px-3 text-xs font-semibold text-text-primary transition-all duration-200 hover:border-surface-4 hover:bg-surface-3"
            disabled={velocityMutation.isPending}
          >
            {velocityMutation.isPending ? "Updating..." : "Update pace now"}
          </button>
          {velocitySnapshot?.comparison ? (
            <div className="mt-3 rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
              <p
                className={`text-sm font-semibold ${velocityStatusTone(velocitySnapshot.comparison.status)}`}
              >
                {velocitySnapshot.comparison.status === "HIGH_DEMAND"
                  ? "Selling faster than plan"
                  : velocitySnapshot.comparison.status === "LOW_DEMAND"
                    ? "Selling slower than plan"
                    : "On pace with plan"}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {velocitySummary(velocitySnapshot.comparison)}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-text-muted">
                <span>
                  Sales pace:{" "}
                  {velocitySnapshot.comparison.actual_velocity_per_hour?.toFixed(1) ?? "—"}
                  /hr
                </span>
                <span>
                  Plan pace:{" "}
                  {velocitySnapshot.comparison.forecast_velocity_per_hour?.toFixed(1) ?? "—"}
                  /hr
                </span>
                {velocityLastUpdated ? (
                  <span>
                    Updated{" "}
                    {velocityLastUpdated.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-text-muted">
              {velocitySummary()}
            </p>
          )}
        </section>
      )}

      {/* ── 8. Additional Context ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-2">
            Model Consensus
          </p>
          <p className="text-lg font-semibold text-text-primary">
            {advancedForecast?.model_agreement != null
              ? percent(advancedForecast.model_agreement)
              : "—"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {agreementNarrative(advancedForecast?.model_agreement)}
          </p>
        </div>
        <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-2">
            Chef Influence
          </p>
          <p className="text-lg font-semibold text-text-primary">
            {advancedForecast?.chef_weight != null
              ? percent(advancedForecast.chef_weight)
              : "—"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {advancedForecast?.chef_recommendation ?? "No chef signal yet"}
          </p>
        </div>
      </div>
    </div>
  );
}
