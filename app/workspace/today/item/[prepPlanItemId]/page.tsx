"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { ScenarioBarChart } from "@/components/dashboard/scenario-bar-chart";
import { ForecastDriverWaterfall } from "@/components/dashboard/today/forecast-driver-waterfall";
import { ConfidenceBreakdown } from "@/components/dashboard/today/confidence-breakdown";
import { ActionRecommendationCard } from "@/components/dashboard/today/action-recommendation-card";
import { useCurrentUserProfile } from "@/services";
import {
  useAdvancedForecast,
  useBranchDayToday,
  useForecastMetrics,
  useDataQualityReport,
  useRealTimeVelocity,
  useUpdatePrepPlanItem,
} from "@/services/production-intelligence/hooks";
import { useIngredientDemand } from "@/services/inventory/hooks";

// ============================================================================
// HELPERS
// ============================================================================

function percent(value: number) {
  return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(0)}%`;
}

function formatQty(value: number, unit: string) {
  const discrete = ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes(
    (unit || "").toUpperCase(),
  );
  return discrete ? `${Math.round(value)} ${unit}` : `${value.toFixed(2)} ${unit}`;
}

function confidenceNarrative(score?: number | null) {
  if (score == null) return "Insufficient history to score confidence.";
  if (score >= 0.75) return "High confidence based on stable recent demand.";
  if (score >= 0.5) return "Moderate confidence with some expected variance.";
  return "Low confidence; demand is volatile or sparse.";
}

// ============================================================================
// PAGE
// ============================================================================

function DeepDiveContent() {
  const router = useRouter();
  const params = useParams<{ prepPlanItemId: string }>();
  const searchParams = useSearchParams();

  const prepPlanItemId = params.prepPlanItemId;
  const branchId = searchParams.get("branch") ?? "";
  const targetDate = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const itemTitle = searchParams.get("title") ?? "Item";
  const productId = searchParams.get("product_id") ?? "";
  const orgId = searchParams.get("org") ?? "";

  const { data: user } = useCurrentUserProfile();
  const resolvedOrgId = orgId || user?.organization_id || "";

  // Data queries
  const advancedForecastQuery = useAdvancedForecast(
    { branch_id: branchId, item_id: productId, target_date: targetDate },
    Boolean(branchId && productId),
  );
  const metricsQuery = useForecastMetrics(
    { branch_id: branchId, item_id: productId, lookback_days: 60 },
    Boolean(branchId && productId),
  );
  const dataQualityQuery = useDataQualityReport(
    { branch_id: branchId, days_window: 30 },
    Boolean(branchId),
  );
  const todayQuery = useBranchDayToday(
    { branch_id: branchId, date: targetDate },
    Boolean(branchId),
  );
  const velocityMutation = useRealTimeVelocity();
  const updatePrepPlanMutation = useUpdatePrepPlanItem();
  const ingredientDemandMutation = useIngredientDemand(branchId, targetDate);

  const [ingredientData, setIngredientData] = useState<any>(null);
  const [ingredientLoaded, setIngredientLoaded] = useState(false);
  const [acceptedQty, setAcceptedQty] = useState<number | null>(null);
  const [acceptSuccess, setAcceptSuccess] = useState(false);

  const advancedForecast = advancedForecastQuery.data as any;
  const forecastMetrics = metricsQuery.data;
  const dataQuality = dataQualityQuery.data;
  const branchDay = todayQuery.data;

  // Find the prep plan item
  const prepItem = useMemo(
    () => branchDay?.prep_plan_items?.find((i) => i.id === prepPlanItemId) ?? null,
    [branchDay, prepPlanItemId],
  );

  const isPlanLocked = Boolean(branchDay?.plan_lock?.is_locked);
  const unit = prepItem?.unit ?? "PCS";

  // Load ingredient demand on mount
  useEffect(() => {
    if (!branchId || ingredientLoaded) return;
    ingredientDemandMutation.mutateAsync().then((data) => {
      setIngredientData(data);
      setIngredientLoaded(true);
    }).catch(() => setIngredientLoaded(true));
  }, [branchId]);

  // Filter ingredient demand to only this item's ingredients
  // We match by looking at the recipe data embedded in the demand response
  const itemIngredients = useMemo(() => {
    if (!ingredientData?.ingredients?.length) return [];
    // The demand endpoint returns all ingredients for the branch.
    // We show all of them with context — the chef needs the full picture.
    return ingredientData.ingredients;
  }, [ingredientData]);

  async function handleAccept(recommendedQty: number) {
    if (!prepPlanItemId || isPlanLocked) return;
    setAcceptedQty(recommendedQty);
    try {
      await updatePrepPlanMutation.mutateAsync({
        prepPlanItemId,
        payload: { planned_quantity: recommendedQty, accepted_suggestion: true },
      });
      setAcceptSuccess(true);
    } catch {
      setAcceptedQty(null);
    }
  }

  const isLoading = advancedForecastQuery.isLoading || todayQuery.isLoading;

  return (
    <WorkspaceShell
      eyebrow="Deep Dive"
      title={itemTitle}
      description={`Forecast intelligence for ${targetDate} · ${branchId ? "Branch loaded" : "No branch"}`}
      insight="Every signal that shaped this forecast is visible here. Use it to make a confident prep decision."
    >
      {/* Back nav */}
      <div className="mb-8 flex items-center justify-between">
        <Link
          href={`/workspace/today?branch_id=${branchId}&date=${targetDate}`}
          className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Today
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              advancedForecastQuery.refetch();
              metricsQuery.refetch();
            }}
            className="inline-flex h-9 items-center rounded-lg border border-surface-4 px-4 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-surface-4/80 transition-colors"
          >
            Refresh
          </button>
          <Link
            href={`/workspace/forecast-intelligence/${productId}?branch_id=${branchId}&date=${targetDate}`}
            className="inline-flex h-9 items-center rounded-lg border border-brand-gold/40 px-4 text-xs font-semibold text-brand-gold hover:bg-brand-gold/10 transition-colors"
          >
            Full history →
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <p className="text-sm text-text-muted">Loading forecast data…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* ============================================================
              MAIN COLUMN (2/3)
          ============================================================ */}
          <div className="lg:col-span-2 space-y-8">

            {/* ── Accept success banner ── */}
            {acceptSuccess && (
              <div className="rounded-xl border border-status-success/40 bg-status-success/10 px-5 py-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-status-success">
                  Plan updated to {acceptedQty != null ? formatQty(acceptedQty, unit) : "—"}
                </p>
                <Link
                  href={`/workspace/today?branch_id=${branchId}&date=${targetDate}`}
                  className="text-xs font-semibold text-status-success hover:underline"
                >
                  Back to prep plan →
                </Link>
              </div>
            )}

            {/* ── 1. Actions ── */}
            {advancedForecast?.action_recommendations?.length ? (
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-3">
                  Recommended Actions
                </p>
                <div className="space-y-3">
                  {advancedForecast.action_recommendations.map((action: any, i: number) => (
                    <ActionRecommendationCard
                      key={i}
                      action={action}
                      unit={unit}
                      onAccept={(recommendedQty) => {
                        if (recommendedQty != null) handleAccept(recommendedQty);
                      }}
                      disabled={isPlanLocked || acceptSuccess}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* ── 2. Confidence ── */}
            <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                    Forecast Confidence
                  </p>
                  <div className="mt-2 flex items-baseline gap-3">
                    <p className="font-display text-4xl font-semibold text-text-primary">
                      {advancedForecast?.confidence != null ? percent(advancedForecast.confidence) : "—"}
                    </p>
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                      (advancedForecast?.confidence ?? 0) >= 0.75
                        ? "bg-status-success/20 text-status-success"
                        : (advancedForecast?.confidence ?? 0) >= 0.5
                          ? "bg-status-warning/20 text-status-warning"
                          : "bg-status-critical/20 text-status-critical"
                    }`}>
                      {advancedForecast?.confidence_label ?? "—"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    {confidenceNarrative(advancedForecast?.confidence)}
                  </p>
                </div>
                <div className="rounded-lg border border-surface-4 bg-surface-3/50 px-4 py-3 text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Recommended</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                    {advancedForecast?.ensemble_forecast != null
                      ? formatQty(advancedForecast.ensemble_forecast, unit)
                      : "—"}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Risk-adjusted:{" "}
                    {advancedForecast?.loss_optimized_qty != null
                      ? formatQty(advancedForecast.loss_optimized_qty, unit)
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

            {/* ── 3. Forecast Drivers ── */}
            {advancedForecast?.signal_contributions ? (
              <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-1">
                  What's Driving This Forecast
                </p>
                <p className="text-sm text-text-secondary mb-4">
                  Starting from baseline, here's how each signal adjusted the final number.
                </p>
                <ForecastDriverWaterfall
                  baselineQty={advancedForecast.signal_contributions.baseline_qty}
                  finalQty={advancedForecast.signal_contributions.final_qty}
                  steps={advancedForecast.signal_contributions.waterfall_steps}
                  unit={unit}
                />
                {advancedForecast.signal_contributions.drivers?.length ? (
                  <div className="mt-4 space-y-2 border-t border-surface-4 pt-4">
                    {advancedForecast.signal_contributions.drivers.map((driver: any) => (
                      <div key={driver.signal_name} className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">{driver.signal_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-text-muted">{driver.explanation}</span>
                          <span className={`font-semibold tabular-nums ${driver.direction === "up" ? "text-status-success" : "text-status-critical"}`}>
                            {driver.direction === "up" ? "+" : ""}{driver.contribution_pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* ── 4. Ingredient Requirements for this item ── */}
            <section className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                    Ingredient Requirements
                  </p>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    What your kitchen needs to make today's plan
                  </p>
                </div>
                {!ingredientLoaded && (
                  <span className="text-xs text-text-muted">Loading…</span>
                )}
              </div>

              {!ingredientLoaded ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-sm text-text-muted">Calculating ingredient demand…</p>
                </div>
              ) : itemIngredients.length === 0 ? (
                <div className="px-5 py-6">
                  <p className="text-sm text-text-secondary">No ingredient data found.</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Set up a recipe for this item in the Inventory section to unlock ingredient forecasting.
                  </p>
                  <Link
                    href={`/workspace/inventory?branch=${branchId}&org=${resolvedOrgId}&tab=recipes`}
                    className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-gold/40 px-3 text-xs font-semibold text-brand-gold hover:bg-brand-gold/10 transition-colors"
                  >
                    Build recipe →
                  </Link>
                </div>
              ) : (
                <div>
                  <div className="divide-y divide-surface-4">
                    {itemIngredients.map((ing: any) => {
                      const qty = parseFloat(ing.predicted_usage);
                      return (
                        <div key={ing.ingredient_id} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-3/40 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{ing.ingredient_name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums text-text-primary">
                              {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(3)}
                            </span>
                            <span className="text-xs uppercase text-text-muted w-8 text-right">{ing.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {ingredientData?.items_with_no_recipe?.length > 0 && (
                    <div className="border-t border-surface-4 px-5 py-3 bg-status-warning/5">
                      <p className="text-xs text-status-warning">
                        {ingredientData.items_with_no_recipe.length} item{ingredientData.items_with_no_recipe.length !== 1 ? "s" : ""} missing recipes —{" "}
                        <Link href={`/workspace/inventory?branch=${branchId}&org=${resolvedOrgId}&tab=recipes`} className="underline">
                          fix in Inventory
                        </Link>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── 5. Scenarios ── */}
            {advancedForecast?.scenarios?.length ? (
              <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-1">
                  Prep Scenarios
                </p>
                <p className="text-sm text-text-secondary mb-4">
                  Compare outcomes across different prep quantities.
                </p>
                <ScenarioBarChart scenarios={advancedForecast.scenarios} />
              </section>
            ) : null}

            {/* ── 6. Historical Performance (collapsed) ── */}
            {forecastMetrics ? (
              <details className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 list-none hover:bg-surface-3/30 transition-colors">
                  <p className="text-sm font-semibold text-text-primary">Historical Performance</p>
                  <span className="text-xs text-text-muted">Expand ↓</span>
                </summary>
                <div className="border-t border-surface-4 px-5 py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: "Forecast Accuracy", value: forecastMetrics.forecast_accuracy != null ? `${(forecastMetrics.forecast_accuracy * 100).toFixed(1)}%` : "—" },
                      { label: "Waste Rate", value: forecastMetrics.waste_rate != null ? `${(forecastMetrics.waste_rate * 100).toFixed(1)}%` : "—" },
                      { label: "Stockout Rate", value: forecastMetrics.stockout_rate != null ? `${(forecastMetrics.stockout_rate * 100).toFixed(1)}%` : "—" },
                      { label: "MAPE", value: forecastMetrics.mape != null ? `${forecastMetrics.mape.toFixed(1)}%` : "—" },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{stat.label}</p>
                        <p className="mt-1 font-display text-xl font-semibold text-text-primary">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}

            {/* ── 7. Data Health (collapsed) ── */}
            {dataQuality ? (
              <details className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 list-none hover:bg-surface-3/30 transition-colors">
                  <p className="text-sm font-semibold text-text-primary">Data Health</p>
                  <span className="text-xs text-text-muted">Expand ↓</span>
                </summary>
                <div className="border-t border-surface-4 px-5 py-5 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-text-muted">Quality Score</p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">
                        {dataQuality.overall_quality_score != null
                          ? `${(dataQuality.overall_quality_score * 100).toFixed(0)}%`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Checks Passed</p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">
                        {dataQuality.passed_checks != null && dataQuality.total_checks != null
                          ? `${dataQuality.passed_checks} / ${dataQuality.total_checks}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {dataQuality.recommendation ? (
                    <p className="text-xs text-text-secondary">{dataQuality.recommendation}</p>
                  ) : (
                    <p className="text-xs text-status-success">No data quality issues detected.</p>
                  )}
                </div>
              </details>
            ) : null}
          </div>

          {/* ============================================================
              SIDEBAR (1/3)
          ============================================================ */}
          <div className="space-y-6">
            {/* Current plan */}
            {prepItem && (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-4">
                  Current Plan
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-text-muted">Suggested</p>
                    <p className="text-sm font-semibold text-text-primary">
                      {formatQty(prepItem.suggested_quantity, unit)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-text-muted">Your plan</p>
                    <p className="text-sm font-semibold text-text-primary">
                      {prepItem.planned_quantity != null
                        ? formatQty(prepItem.planned_quantity, unit)
                        : "Not set"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-text-muted">Decision</p>
                    <span className={`text-xs font-semibold uppercase tracking-[0.08em] ${
                      prepItem.decision === "ACCEPTED_AI"
                        ? "text-status-success"
                        : prepItem.decision === "CHEF_OVERRIDE"
                          ? "text-status-warning"
                          : "text-text-muted"
                    }`}>
                      {prepItem.decision === "ACCEPTED_AI"
                        ? "Accepted"
                        : prepItem.decision === "CHEF_OVERRIDE"
                          ? "Override"
                          : "Pending"}
                    </span>
                  </div>
                  {isPlanLocked && (
                    <p className="text-xs text-status-success border-t border-surface-4 pt-3">
                      Plan is locked
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Risk snapshot */}
            {prepItem && (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
                  Risk Snapshot
                </p>
                <div className="space-y-3">
                  {[
                    {
                      label: "Stockout risk",
                      value: prepItem.forecast_context?.risk_of_stockout ?? 0,
                      criticalAt: 0.45,
                    },
                    {
                      label: "Waste risk",
                      value: prepItem.forecast_context?.risk_of_waste ?? 0,
                      criticalAt: 0.45,
                    },
                  ].map((risk) => (
                    <div key={risk.label}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-text-muted">{risk.label}</p>
                        <p className={`text-xs font-semibold ${risk.value >= risk.criticalAt ? "text-status-critical" : risk.value >= 0.25 ? "text-status-warning" : "text-status-success"}`}>
                          {percent(risk.value)}
                        </p>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-4">
                        <div
                          className={`h-1.5 rounded-full ${risk.value >= risk.criticalAt ? "bg-status-critical" : risk.value >= 0.25 ? "bg-status-warning" : "bg-status-success"}`}
                          style={{ width: percent(risk.value) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reasoning */}
            {prepItem?.forecast_context?.reasoning?.length ? (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
                  Why This Number
                </p>
                <div className="space-y-2">
                  {prepItem.forecast_context.reasoning.map((line: string, i: number) => (
                    <p key={i} className="text-xs text-text-secondary leading-relaxed">
                      {i + 1}. {line}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Applied signals */}
            {prepItem?.forecast_context?.applied_signals ? (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
                  Signal Adjustments
                </p>
                <div className="space-y-2">
                  {Object.entries(prepItem.forecast_context.applied_signals).map(([key, signal]: [string, any]) => {
                    const modifier = signal?.modifier ?? 0;
                    if (Math.abs(modifier) < 0.005) return null;
                    const label = key === "reservation" ? "Reservations" : key === "event" ? "Event" : key === "weather" ? "Weather" : key === "staffing" ? "Staffing" : key === "kitchen_capacity" ? "Kitchen capacity" : key === "delivery_mix" ? "Delivery mix" : key === "traffic" ? "Traffic" : key;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary">{label}</span>
                        <span className={`text-xs font-semibold ${modifier > 0 ? "text-status-success" : "text-status-warning"}`}>
                          {modifier > 0 ? "↑" : "↓"} {(Math.abs(modifier) * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}

export default function DeepDivePage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-sm text-text-muted">Loading…</div>}>
      <DeepDiveContent />
    </Suspense>
  );
}
