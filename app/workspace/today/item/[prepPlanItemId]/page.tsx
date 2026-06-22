"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { ScenarioBarChart } from "@/components/dashboard/scenario-bar-chart";
import { ForecastDriverWaterfall } from "@/components/dashboard/today/forecast-driver-waterfall";
import { ConfidenceBreakdown } from "@/components/dashboard/today/confidence-breakdown";
import { useCurrentUserProfile } from "@/services";
import {
  useAdvancedForecast,
  useBranchDayToday,
  useForecastMetrics,
  useUpdatePrepPlanItem,
} from "@/services/production-intelligence/hooks";
import { useIngredientDemand } from "@/services/inventory/hooks";

// ============================================================================
// HELPERS
// ============================================================================

function fmtQty(value: number, unit: string) {
  const discrete = ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes(
    (unit || "").toUpperCase(),
  );
  return discrete
    ? `${Math.round(value)} ${unit}`
    : `${value.toFixed(2)} ${unit}`;
}

function fmtPct(value: number) {
  return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(0)}%`;
}

function confidenceNarrative(score?: number | null): string {
  if (score == null) return "Not enough history to score confidence yet.";
  if (score >= 0.8)
    return "High confidence — demand for this item has been consistent. The model knows it well.";
  if (score >= 0.6)
    return "Moderate confidence — some variability in demand. Your judgment is a valuable input here.";
  if (score >= 0.4)
    return "Lower confidence — this item has volatile demand. Consider your recent experience alongside this number.";
  return "Low confidence — the model has limited history for this item. Rely heavily on your own read today.";
}

function trendNarrative(trend?: { trend?: string } | null): string {
  const t = trend?.trend;
  if (t === "IMPROVING") return "The model has been getting more accurate on this item lately.";
  if (t === "DEGRADING") return "Accuracy has been declining — flag this if the pattern continues.";
  if (t === "STABLE") return "Accuracy is consistent. No unusual drift.";
  return "";
}

function varianceLabel(variance: number, unit: string): { text: string; tone: string } {
  if (Math.abs(variance) < 0.5) return { text: "Matches the suggestion", tone: "text-text-muted" };
  if (variance > 0)
    return { text: `${fmtQty(variance, unit)} above suggestion`, tone: "text-status-warning" };
  return { text: `${fmtQty(Math.abs(variance), unit)} below suggestion`, tone: "text-status-warning" };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function RiskBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  const tone =
    value >= 0.45
      ? { bar: "bg-status-critical", text: "text-status-critical" }
      : value >= 0.25
        ? { bar: "bg-status-warning", text: "text-status-warning" }
        : { bar: "bg-status-success", text: "text-status-success" };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-text-muted">{label}</p>
        <p className={`text-xs font-semibold ${tone.text}`}>{fmtPct(value)}</p>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-4">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${tone.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TrackRecord({
  history,
  unit,
  targetWeekday,
}: {
  history: {
    date: string;
    weekday: string;
    forecast_qty: number;
    actual_qty: number;
    chef_plan_qty: number;
    waste_qty: number;
    stockout_flag: boolean;
    chef_override: boolean;
  }[];
  unit: string;
  targetWeekday: string;
}) {
  if (!history.length) return null;

  const lastSimilar = history.find((d) => d.weekday === targetWeekday);

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
        Track record
      </p>

      {/* Last similar day callout */}
      {lastSimilar && (
        <div className="mt-3 rounded-xl border border-surface-4 bg-surface-3/40 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Last {lastSimilar.weekday} · {lastSimilar.date}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <span>
              Prepped:{" "}
              <span className="font-semibold text-text-primary">
                {fmtQty(lastSimilar.chef_plan_qty, unit)}
              </span>
            </span>
            <span>
              Sold:{" "}
              <span className="font-semibold text-text-primary">
                {fmtQty(lastSimilar.actual_qty, unit)}
              </span>
            </span>
            {lastSimilar.stockout_flag ? (
              <span className="font-semibold text-status-critical">Ran out</span>
            ) : lastSimilar.waste_qty > 0 ? (
              <span className="text-text-muted">
                {fmtQty(lastSimilar.waste_qty, unit)} leftover
              </span>
            ) : (
              <span className="text-status-success font-medium">Sold clean</span>
            )}
            {lastSimilar.chef_override && (
              <span className="text-xs text-text-muted italic">You overrode the model</span>
            )}
          </div>
        </div>
      )}

      {/* Last N days table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-surface-4">
        <table className="w-full text-xs">
          <thead className="border-b border-surface-4/80 bg-surface-3/40">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.12em] text-text-muted">
                Date
              </th>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.12em] text-text-muted">
                AI said
              </th>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.12em] text-text-muted">
                Prepped
              </th>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.12em] text-text-muted">
                Sold
              </th>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.12em] text-text-muted">
                Outcome
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-4/50">
            {history.slice(0, 7).map((row) => {
              const outcome = row.stockout_flag
                ? { label: "Ran out", cls: "text-status-critical font-semibold" }
                : row.waste_qty > 0.5
                  ? { label: `${fmtQty(row.waste_qty, unit)} wasted`, cls: "text-status-warning" }
                  : { label: "Clean", cls: "text-status-success" };
              return (
                <tr
                  key={row.date}
                  className={`hover:bg-surface-3/20 ${row.weekday === targetWeekday ? "bg-brand-gold/4" : ""}`}
                >
                  <td className="px-4 py-2.5 text-text-muted">
                    {row.weekday.slice(0, 3)} {row.date.slice(5)}
                    {row.weekday === targetWeekday && (
                      <span className="ml-1.5 text-[9px] font-semibold text-brand-gold uppercase tracking-widest">
                        same day
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary tabular-nums">
                    {fmtQty(row.forecast_qty, unit)}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary font-medium tabular-nums">
                    {fmtQty(row.chef_plan_qty, unit)}
                    {row.chef_override && (
                      <span className="ml-1 text-[9px] text-text-muted">override</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary tabular-nums">
                    {fmtQty(row.actual_qty, unit)}
                  </td>
                  <td className={`px-4 py-2.5 ${outcome.cls}`}>{outcome.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================================
// PAGE
// ============================================================================

function DeepDiveContent() {
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

  const advancedForecastQuery = useAdvancedForecast(
    { branch_id: branchId, item_id: productId, target_date: targetDate },
    Boolean(branchId && productId),
  );
  const metricsQuery = useForecastMetrics(
    { branch_id: branchId, item_id: productId, lookback_days: 60 },
    Boolean(branchId && productId),
  );
  const todayQuery = useBranchDayToday(
    { branch_id: branchId, date: targetDate },
    Boolean(branchId),
  );
  const updatePrepPlanMutation = useUpdatePrepPlanItem();
  const ingredientDemandMutation = useIngredientDemand(branchId, targetDate, productId);

  const [ingredientData, setIngredientData] = useState<any>(null);
  const [ingredientLoaded, setIngredientLoaded] = useState(false);
  const [customQty, setCustomQty] = useState<string>("");
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const advancedForecast = advancedForecastQuery.data as any;
  const forecastMetrics = metricsQuery.data as any;
  const branchDay = todayQuery.data;

  const prepItem = useMemo(
    () => branchDay?.prep_plan_items?.find((i) => i.id === prepPlanItemId) ?? null,
    [branchDay, prepPlanItemId],
  );

  const isPlanLocked = Boolean(branchDay?.plan_lock?.is_locked);
  const unit = prepItem?.unit ?? "PCS";

  const suggestedQty = prepItem?.suggested_quantity ?? advancedForecast?.ensemble_forecast ?? null;
  const plannedQty = prepItem?.planned_quantity ?? suggestedQty;
  const variance =
    suggestedQty != null && plannedQty != null ? plannedQty - suggestedQty : null;

  // Weekday of the target date — for "last similar day" lookup
  const targetWeekday = new Date(targetDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });

  const dailyHistory: any[] = forecastMetrics?.daily_history ?? [];

  // Load ingredient demand for this item on mount
  useEffect(() => {
    if (!branchId || !productId || ingredientLoaded) return;
    ingredientDemandMutation
      .mutateAsync()
      .then((data) => {
        setIngredientData(data);
        setIngredientLoaded(true);
      })
      .catch(() => setIngredientLoaded(true));
  }, [branchId, productId]);

  async function handleDecision(qty: number, accepted: boolean) {
    if (!prepPlanItemId || isPlanLocked || submitState === "saving") return;
    setSubmitState("saving");
    try {
      await updatePrepPlanMutation.mutateAsync({
        prepPlanItemId,
        payload: {
          planned_quantity: qty,
          accepted_suggestion: accepted,
        },
      });
      setSubmitState("done");
    } catch {
      setSubmitState("error");
    }
  }

  const isLoading = advancedForecastQuery.isLoading || todayQuery.isLoading;

  return (
    <WorkspaceShell
      eyebrow="Today · Deep Dive"
      title={itemTitle}
      description={`Forecast intelligence · ${targetDate}`}
      insight="Every signal behind this number is here. Use it to make a confident call."
    >
      {/* Back nav */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/workspace/today?branch_id=${branchId}&date=${targetDate}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to prep plan
        </Link>
      </div>

      {isLoading ? (
        <div className="py-20 text-center">
          <p className="text-sm text-text-muted">Loading forecast…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* ============================================================
              MAIN COLUMN
          ============================================================ */}
          <div className="lg:col-span-2 space-y-8">

            {/* ── Decision confirmed banner ── */}
            {submitState === "done" && (
              <div className="flex items-center justify-between rounded-xl border border-status-success/40 bg-status-success/10 px-5 py-4">
                <p className="text-sm font-semibold text-status-success">
                  Plan updated
                </p>
                <Link
                  href={`/workspace/today?branch_id=${branchId}&date=${targetDate}`}
                  className="text-xs font-semibold text-status-success hover:underline"
                >
                  Back to prep plan →
                </Link>
              </div>
            )}
            {submitState === "error" && (
              <div className="rounded-xl border border-status-critical/40 bg-status-critical/10 px-5 py-3">
                <p className="text-sm text-status-critical">
                  Couldn't save — try again or update from the prep plan.
                </p>
              </div>
            )}

            {/* ── 1. Why this number ── */}
            {(prepItem?.forecast_context?.reasoning?.length ||
              advancedForecast?.signal_contributions) ? (
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Why this number
                </p>

                {/* Plain reasoning */}
                {prepItem?.forecast_context?.reasoning?.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {prepItem.forecast_context.reasoning.map((line: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="mt-0.5 shrink-0 text-brand-gold/60">·</span>
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {/* Signal waterfall — how each driver moved the base number */}
                {advancedForecast?.signal_contributions ? (
                  <div className="mt-5 rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                      How the forecast was built
                    </p>
                    <p className="mb-4 text-xs text-text-muted">
                      Starting from your baseline, each signal adjusted the final number.
                    </p>
                    <ForecastDriverWaterfall
                      baselineQty={advancedForecast.signal_contributions.baseline_qty}
                      finalQty={advancedForecast.signal_contributions.final_qty}
                      steps={advancedForecast.signal_contributions.waterfall_steps}
                      unit={unit}
                    />
                    {advancedForecast.signal_contributions.drivers?.length ? (
                      <div className="mt-4 space-y-2 border-t border-surface-4 pt-4">
                        {advancedForecast.signal_contributions.drivers.map((d: any) => (
                          <div key={d.signal_name} className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">{d.signal_name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-text-muted">{d.explanation}</span>
                              <span
                                className={`font-semibold tabular-nums ${
                                  d.direction === "up" ? "text-status-success" : "text-status-warning"
                                }`}
                              >
                                {d.direction === "up" ? "+" : ""}
                                {d.contribution_pct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Applied signals (fallback if no waterfall) */}
                {!advancedForecast?.signal_contributions &&
                prepItem?.forecast_context?.applied_signals ? (
                  <div className="mt-4 space-y-1.5">
                    {Object.entries(prepItem.forecast_context.applied_signals).map(
                      ([key, signal]: [string, any]) => {
                        const modifier = signal?.modifier ?? 0;
                        if (Math.abs(modifier) < 0.005) return null;
                        const label =
                          key === "reservation" ? "Reservations" :
                          key === "event" ? "Event" :
                          key === "weather" ? "Weather" :
                          key === "staffing" ? "Staffing" :
                          key === "kitchen_capacity" ? "Kitchen capacity" :
                          key === "delivery_mix" ? "Delivery mix" :
                          key === "traffic" ? "Traffic" : key;
                        return (
                          <div key={key} className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">{label}</span>
                            <span
                              className={`font-semibold ${modifier > 0 ? "text-status-success" : "text-status-warning"}`}
                            >
                              {modifier > 0 ? "↑" : "↓"}{" "}
                              {(Math.abs(modifier) * 100).toFixed(1)}%
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* ── 2. Confidence ── */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                How confident is the model?
              </p>
              <div className="mt-3 rounded-xl border border-surface-4 bg-surface-2 p-5">
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    <p className="font-display text-4xl font-semibold tracking-[-0.5px] text-text-primary">
                      {advancedForecast?.confidence != null
                        ? fmtPct(advancedForecast.confidence)
                        : prepItem?.forecast_context?.confidence_score != null
                          ? fmtPct(prepItem.forecast_context.confidence_score)
                          : "—"}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        (advancedForecast?.confidence ??
                          prepItem?.forecast_context?.confidence_score ??
                          0) >= 0.65
                          ? "bg-status-success/15 text-status-success"
                          : (advancedForecast?.confidence ??
                                prepItem?.forecast_context?.confidence_score ??
                                0) >= 0.4
                            ? "bg-status-warning/15 text-status-warning"
                            : "bg-status-critical/15 text-status-critical"
                      }`}
                    >
                      {advancedForecast?.confidence_label ?? "—"}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {confidenceNarrative(
                      advancedForecast?.confidence ??
                        prepItem?.forecast_context?.confidence_score,
                    )}
                  </p>
                </div>

                {advancedForecast?.confidence_breakdown ? (
                  <div className="mt-4 border-t border-surface-4 pt-4">
                    <ConfidenceBreakdown
                      dataQualityScore={
                        advancedForecast.confidence_breakdown.data_quality_score
                      }
                      historicalAccuracyScore={
                        advancedForecast.confidence_breakdown.historical_accuracy_score
                      }
                      signalReliabilityScore={
                        advancedForecast.confidence_breakdown.signal_reliability_score
                      }
                      patternValidationScore={
                        advancedForecast.confidence_breakdown.pattern_validation_score
                      }
                      confidenceFactors={
                        advancedForecast.confidence_breakdown.confidence_factors
                      }
                    />
                  </div>
                ) : null}

                {/* Chef weight context */}
                {advancedForecast?.chef_weight != null && (
                  <p className="mt-4 border-t border-surface-4 pt-3 text-xs text-text-muted">
                    Your overrides on this item carry{" "}
                    <span className="font-semibold text-text-primary">
                      {fmtPct(advancedForecast.chef_weight)}
                    </span>{" "}
                    weight in today's recommendation.{" "}
                    {advancedForecast.chef_recommendation === "TRUST_CHEF"
                      ? "Your track record is strong here."
                      : advancedForecast.chef_recommendation === "BLEND_WITH_MODEL"
                        ? "Blended with model output."
                        : "Model-led today."}
                  </p>
                )}
              </div>
            </section>

            {/* ── 3. What if you prep differently ── */}
            {advancedForecast?.scenarios?.length ? (
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  What if you prep differently?
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Compare outcomes across prep quantities.
                </p>
                <div className="mt-3 rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
                  <ScenarioBarChart scenarios={advancedForecast.scenarios} />
                </div>
              </section>
            ) : null}

            {/* ── 4. Track record ── */}
            {dailyHistory.length > 0 ? (
              <TrackRecord
                history={dailyHistory}
                unit={unit}
                targetWeekday={targetWeekday}
              />
            ) : forecastMetrics && !metricsQuery.isLoading ? (
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Track record
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      label: "Past accuracy",
                      value:
                        forecastMetrics.forecast_accuracy != null
                          ? `${(forecastMetrics.forecast_accuracy * 100).toFixed(0)}%`
                          : "—",
                    },
                    {
                      label: "Waste rate",
                      value:
                        forecastMetrics.waste_rate != null
                          ? `${(forecastMetrics.waste_rate * 100).toFixed(1)}%`
                          : "—",
                    },
                    {
                      label: "Stockout rate",
                      value:
                        forecastMetrics.stockout_rate != null
                          ? `${(forecastMetrics.stockout_rate * 100).toFixed(1)}%`
                          : "—",
                    },
                    {
                      label: "Data points",
                      value: forecastMetrics.data_points ?? "—",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-surface-4 bg-surface-2 px-4 py-3"
                    >
                      <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                        {stat.label}
                      </p>
                      <p className="mt-1 font-display text-xl font-semibold text-text-primary">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
                {trendNarrative(forecastMetrics?.trend) ? (
                  <p className="mt-3 text-xs text-text-secondary">
                    {trendNarrative(forecastMetrics.trend)}
                  </p>
                ) : null}
              </section>
            ) : null}

            {/* ── 5. What you'll need ── */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                What you&apos;ll need
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Ingredients for{" "}
                {plannedQty != null ? fmtQty(plannedQty, unit) : "your planned quantity"} of{" "}
                {itemTitle}
              </p>
              <div className="mt-3 overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
                {!ingredientLoaded ? (
                  <div className="px-5 py-5 text-center">
                    <p className="text-sm text-text-muted">Calculating…</p>
                  </div>
                ) : !ingredientData || ingredientData.no_recipe ? (
                  <div className="px-5 py-5">
                    <p className="text-sm text-text-secondary">No recipe linked to this item.</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Add a recipe in Inventory to see what you&apos;ll need for any planned
                      quantity.
                    </p>
                    <Link
                      href={`/workspace/inventory?branch=${branchId}&org=${resolvedOrgId}&tab=recipes`}
                      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-gold/40 px-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10"
                    >
                      Build recipe →
                    </Link>
                  </div>
                ) : ingredientData.ingredients?.length === 0 ? (
                  <div className="px-5 py-5">
                    <p className="text-sm text-text-muted">
                      Recipe exists but has no ingredient lines yet.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="divide-y divide-surface-4">
                      {ingredientData.ingredients.map((ing: any) => (
                        <div
                          key={ing.ingredient_id}
                          className="flex items-center justify-between px-5 py-3 hover:bg-surface-3/30 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {ing.ingredient_name}
                            </p>
                            {ing.per_serving != null && (
                              <p className="mt-0.5 text-[11px] text-text-muted">
                                {ing.per_serving} {ing.unit} per serving
                                {ing.waste_factor > 0
                                  ? ` · +${(ing.waste_factor * 100).toFixed(0)}% waste buffer`
                                  : ""}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-display text-base font-semibold tabular-nums text-text-primary">
                              {ing.quantity_for_plan != null
                                ? `${ing.quantity_for_plan}`
                                : `${parseFloat(ing.predicted_usage ?? 0).toFixed(3)}`}
                            </span>
                            <span className="ml-1 text-xs text-text-muted">{ing.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-surface-4 px-5 py-3 bg-surface-3/20">
                      <p className="text-[11px] text-text-muted">
                        Based on{" "}
                        {ingredientData.planned_quantity != null
                          ? fmtQty(ingredientData.planned_quantity, unit)
                          : "planned quantity"}{" "}
                        of {ingredientData.item_name ?? itemTitle}.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ============================================================
              SIDEBAR
          ============================================================ */}
          <div className="space-y-5">

            {/* ── Decision panel ── */}
            <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
              <div className="border-b border-surface-4 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Your decision
                </p>
              </div>
              <div className="px-5 py-4 space-y-4">

                {/* AI vs Your plan comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      AI recommends
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                      {suggestedQty != null ? fmtQty(suggestedQty, unit) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Your plan
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                      {plannedQty != null ? fmtQty(plannedQty, unit) : "Not set"}
                    </p>
                  </div>
                </div>

                {/* Variance note */}
                {variance != null && Math.abs(variance) >= 0.5 && (
                  <p className={`text-xs ${varianceLabel(variance, unit).tone}`}>
                    {varianceLabel(variance, unit).text}
                  </p>
                )}

                {/* Current decision state */}
                {prepItem?.decision ? (
                  <div className="flex items-center justify-between border-t border-surface-4 pt-3">
                    <p className="text-xs text-text-muted">Status</p>
                    <span
                      className={`text-xs font-semibold uppercase tracking-[0.08em] ${
                        prepItem.decision === "ACCEPTED_AI"
                          ? "text-status-success"
                          : prepItem.decision === "CHEF_OVERRIDE"
                            ? "text-status-warning"
                            : "text-text-muted"
                      }`}
                    >
                      {prepItem.decision === "ACCEPTED_AI"
                        ? "Accepted AI"
                        : prepItem.decision === "CHEF_OVERRIDE"
                          ? "Your override"
                          : "Pending"}
                    </span>
                  </div>
                ) : null}

                {/* Action buttons */}
                {!isPlanLocked && submitState !== "done" && (
                  <div className="space-y-2 border-t border-surface-4 pt-3">
                    {suggestedQty != null && (
                      <button
                        type="button"
                        onClick={() => handleDecision(suggestedQty, true)}
                        disabled={submitState === "saving"}
                        className="w-full inline-flex h-9 items-center justify-center rounded-full border border-status-success/40 bg-status-success/15 text-xs font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98] disabled:opacity-60"
                      >
                        {submitState === "saving" ? "Saving…" : `✓ Accept — prep ${fmtQty(suggestedQty, unit)}`}
                      </button>
                    )}

                    {/* Custom quantity entry */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder={
                          plannedQty != null ? String(Math.round(plannedQty)) : "Qty"
                        }
                        value={customQty}
                        onChange={(e) => setCustomQty(e.target.value)}
                        disabled={submitState === "saving"}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 disabled:opacity-60"
                      />
                      <span className="shrink-0 text-xs text-text-muted">{unit}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const v = parseFloat(customQty);
                          if (!isNaN(v) && v > 0) handleDecision(v, false);
                        }}
                        disabled={!customQty || submitState === "saving"}
                        className="shrink-0 inline-flex h-9 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 active:scale-[0.98] disabled:opacity-50"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                )}

                {isPlanLocked && (
                  <p className="border-t border-surface-4 pt-3 text-xs text-status-success">
                    Plan is locked — decisions are set.
                  </p>
                )}
              </div>
            </div>

            {/* ── Risk snapshot ── */}
            {prepItem?.forecast_context && (
              <div className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Risk today
                </p>
                <div className="space-y-3.5">
                  <RiskBar
                    label="Run-out risk"
                    value={prepItem.forecast_context.risk_of_stockout ?? 0}
                  />
                  <RiskBar
                    label="Waste risk"
                    value={prepItem.forecast_context.risk_of_waste ?? 0}
                  />
                </div>
                {prepItem.forecast_context.risk_of_stockout >= 0.45 && (
                  <p className="mt-3 text-xs text-status-critical">
                    High run-out risk — consider prepping at or above the AI suggestion.
                  </p>
                )}
                {prepItem.forecast_context.risk_of_waste >= 0.45 && (
                  <p className="mt-3 text-xs text-status-warning">
                    High waste risk — prep conservatively unless you have a strong signal.
                  </p>
                )}
              </div>
            )}

            {/* ── Quick stats from metrics ── */}
            {forecastMetrics && (
              <div className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Past 60 days
                </p>
                <div className="space-y-2 text-xs">
                  {forecastMetrics.forecast_accuracy != null && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">AI accuracy</span>
                      <span className="font-semibold text-text-primary">
                        {(forecastMetrics.forecast_accuracy * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                  {forecastMetrics.stockout_rate != null && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Stockouts</span>
                      <span className={`font-semibold ${forecastMetrics.stockout_rate > 0.05 ? "text-status-critical" : "text-text-primary"}`}>
                        {(forecastMetrics.stockout_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {forecastMetrics.waste_rate != null && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Waste rate</span>
                      <span className={`font-semibold ${forecastMetrics.waste_rate > 0.08 ? "text-status-warning" : "text-text-primary"}`}>
                        {(forecastMetrics.waste_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {forecastMetrics.data_points != null && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Days tracked</span>
                      <span className="font-semibold text-text-primary">
                        {forecastMetrics.data_points}
                      </span>
                    </div>
                  )}
                </div>
                {trendNarrative(forecastMetrics?.trend) ? (
                  <p className="mt-3 border-t border-surface-4 pt-3 text-[11px] text-text-secondary">
                    {trendNarrative(forecastMetrics.trend)}
                  </p>
                ) : null}
              </div>
            )}

            {/* ── Full history link ── */}
            <Link
              href={`/workspace/forecast-intelligence/${productId}?branch_id=${branchId}&date=${targetDate}`}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-brand-gold/30 px-4 py-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10"
            >
              View full history →
            </Link>
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
