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
import { useTranslation } from "@/lib/i18n";

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

function fmtCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function confidenceNarrative(score: number | null | undefined, t: (key: string, variables?: Record<string, string | number>) => string): string {
  if (score == null) return t("workspace.today.itemDetail.confidenceNarrative.noHistory");
  if (score >= 0.8) return t("workspace.today.itemDetail.confidenceNarrative.high");
  if (score >= 0.6) return t("workspace.today.itemDetail.confidenceNarrative.moderate");
  if (score >= 0.4) return t("workspace.today.itemDetail.confidenceNarrative.lower");
  return t("workspace.today.itemDetail.confidenceNarrative.low");
}

function trendNarrative(trend: { trend?: string } | null | undefined, t: (key: string, variables?: Record<string, string | number>) => string): string {
  const val = trend?.trend;
  if (val === "IMPROVING") return t("workspace.today.itemDetail.trendNarrative.improving");
  if (val === "DEGRADING") return t("workspace.today.itemDetail.trendNarrative.degrading");
  if (val === "STABLE") return t("workspace.today.itemDetail.trendNarrative.stable");
  return "";
}

function varianceLabel(variance: number, unit: string, t: (key: string, variables?: Record<string, string | number>) => string): { text: string; tone: string } {
  if (Math.abs(variance) < 0.5) return { text: t("workspace.today.itemDetail.varianceLabel.matches"), tone: "text-text-muted" };
  if (variance > 0)
    return { text: t("workspace.today.itemDetail.varianceLabel.aboveSuggestion", { qty: fmtQty(variance, unit) }), tone: "text-status-warning" };
  return { text: t("workspace.today.itemDetail.varianceLabel.belowSuggestion", { qty: fmtQty(Math.abs(variance), unit) }), tone: "text-status-warning" };
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

// ── Financial scenario card ──────────────────────────────────────────────────
interface FinancialScenario {
  label: string;
  qty: number;
  revenue: number | null;
  wasteCost: number | null;
  netProfit: number | null;
  upside: string;
  downside: string;
  isHighlighted?: boolean;
}

function FinancialScenarios({
  scenarios,
  unit,
  pricingReliable,
}: {
  scenarios: FinancialScenario[];
  unit: string;
  pricingReliable: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
        {t("workspace.today.itemDetail.financial.whatCouldYouMake")}
      </p>
      <p className="mt-1 text-xs text-text-muted">
        {pricingReliable
          ? t("workspace.today.itemDetail.financial.revenueEstimates")
          : t("workspace.today.itemDetail.financial.relativeOutcomes")}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {scenarios.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border px-4 py-4 ${
              s.isHighlighted
                ? "border-brand-gold/40 bg-brand-gold/6"
                : "border-surface-4 bg-surface-2"
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <p className="text-xs font-semibold text-text-primary">{s.label}</p>
              {s.isHighlighted && (
                <span className="shrink-0 rounded-full bg-brand-gold/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-brand-gold">
                  {t("workspace.today.itemDetail.financial.aiPick")}
                </span>
              )}
            </div>
            <p className="mt-2 font-display text-xl font-semibold tabular-nums text-text-primary">
              {fmtQty(s.qty, unit)}
            </p>
            {s.revenue != null && (
              <p className="mt-1 text-sm font-semibold text-status-success">
                {t("workspace.today.itemDetail.financial.revenue", { amount: fmtCurrency(s.revenue) })}
              </p>
            )}
            {s.wasteCost != null && s.wasteCost > 0 && (
              <p className="text-xs text-status-warning">
                {t("workspace.today.itemDetail.financial.wasteCost", { amount: fmtCurrency(s.wasteCost) })}
              </p>
            )}
            {s.netProfit != null && (
              <p className="text-xs font-semibold text-text-primary">
                {t("workspace.today.itemDetail.financial.net", { amount: fmtCurrency(s.netProfit) })}
              </p>
            )}
            <div className="mt-3 space-y-1 border-t border-surface-4 pt-3">
              {s.upside && (
                <p className="text-[11px] text-status-success">{s.upside}</p>
              )}
              {s.downside && (
                <p className="text-[11px] text-status-warning">{s.downside}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
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
  const { t } = useTranslation();
  if (!history.length) return null;

  const lastSimilar = history.find((d) => d.weekday === targetWeekday);

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
        {t("workspace.today.itemDetail.trackRecord.title")}
      </p>

      {lastSimilar && (
        <div className="mt-3 rounded-xl border border-surface-4 bg-surface-3/40 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("workspace.today.itemDetail.trackRecord.lastSimilar", { weekday: lastSimilar.weekday, date: lastSimilar.date })}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <span>
              {t("workspace.today.itemDetail.trackRecord.prepped")}{" "}
              <span className="font-semibold text-text-primary">
                {fmtQty(lastSimilar.chef_plan_qty, unit)}
              </span>
            </span>
            <span>
              {t("workspace.today.itemDetail.trackRecord.sold")}{" "}
              <span className="font-semibold text-text-primary">
                {fmtQty(lastSimilar.actual_qty, unit)}
              </span>
            </span>
            {lastSimilar.stockout_flag ? (
              <span className="font-semibold text-status-critical">{t("workspace.today.itemDetail.trackRecord.ranOut")}</span>
            ) : lastSimilar.waste_qty > 0 ? (
              <span className="text-text-muted">
                {t("workspace.today.itemDetail.trackRecord.leftover", { qty: fmtQty(lastSimilar.waste_qty, unit) })}
              </span>
            ) : (
              <span className="text-status-success font-medium">{t("workspace.today.itemDetail.trackRecord.soldClean")}</span>
            )}
            {lastSimilar.chef_override && (
              <span className="text-xs text-text-muted italic">{t("workspace.today.itemDetail.trackRecord.overrodeModel")}</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-surface-4">
        <table className="w-full text-xs">
          <thead className="border-b border-surface-4/80 bg-surface-3/40">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.12em] text-text-muted">
                {t("workspace.today.itemDetail.trackRecord.colDate")}
              </th>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.12em] text-text-muted">
                {t("workspace.today.itemDetail.trackRecord.colAiSaid")}
              </th>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.12em] text-text-muted">
                {t("workspace.today.itemDetail.trackRecord.colPrepped")}
              </th>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.12em] text-text-muted">
                {t("workspace.today.itemDetail.trackRecord.colSold")}
              </th>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-[0.12em] text-text-muted">
                {t("workspace.today.itemDetail.trackRecord.colOutcome")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-4/50">
            {history.slice(0, 7).map((row) => {
              const outcome = row.stockout_flag
                ? { label: t("workspace.today.itemDetail.trackRecord.ranOut"), cls: "text-status-critical font-semibold" }
                : row.waste_qty > 0.5
                  ? { label: t("workspace.today.itemDetail.trackRecord.wasted", { qty: fmtQty(row.waste_qty, unit) }), cls: "text-status-warning" }
                  : { label: t("workspace.today.itemDetail.trackRecord.clean"), cls: "text-status-success" };
              return (
                <tr
                  key={row.date}
                  className={`hover:bg-surface-3/20 ${row.weekday === targetWeekday ? "bg-brand-gold/4" : ""}`}
                >
                  <td className="px-4 py-2.5 text-text-muted">
                    {row.weekday.slice(0, 3)} {row.date.slice(5)}
                    {row.weekday === targetWeekday && (
                      <span className="ml-1.5 text-[9px] font-semibold text-brand-gold uppercase tracking-widest">
                        {t("workspace.today.itemDetail.trackRecord.sameDay")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary tabular-nums">
                    {fmtQty(row.forecast_qty, unit)}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary font-medium tabular-nums">
                    {fmtQty(row.chef_plan_qty, unit)}
                    {row.chef_override && (
                      <span className="ml-1 text-[9px] text-text-muted">{t("workspace.today.itemDetail.trackRecord.override")}</span>
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
  const { t } = useTranslation();
  const params = useParams<{ prepPlanItemId: string }>();
  const searchParams = useSearchParams();

  const prepPlanItemId = params.prepPlanItemId;
  const branchId = searchParams.get("branch") ?? "";
  const targetDate = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const itemTitle = searchParams.get("title") ?? t("workspace.today.itemDetail.defaultTitle");
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

  const targetWeekday = new Date(targetDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });

  const dailyHistory: any[] = forecastMetrics?.daily_history ?? [];

  // Pricing info from forecast context (optional — may not be set for all items)
  const unitPrice: number | null = prepItem?.forecast_context?.unit_price ?? null;
  const unitCost: number | null = prepItem?.forecast_context?.unit_cost ?? null;
  const pricingReliable: boolean = prepItem?.forecast_context?.pricing_reliable ?? false;
  const lowerBound: number | null = prepItem?.forecast_context?.lower_bound ?? null;
  const upperBound: number | null = prepItem?.forecast_context?.upper_bound ?? null;
  const stockoutRisk: number = prepItem?.forecast_context?.risk_of_stockout ?? 0;
  const wasteRisk: number = prepItem?.forecast_context?.risk_of_waste ?? 0;

  // Build financial scenarios from available data
  const financialScenarios: FinancialScenario[] | null = useMemo(() => {
    if (suggestedQty == null) return null;

    const conservativeQty = lowerBound ?? Math.round(suggestedQty * 0.85);
    const aggressiveQty = upperBound ?? Math.round(suggestedQty * 1.15);

    function buildScenario(
      label: string,
      qty: number,
      expectedSell: number,
      opts: { isHighlighted?: boolean },
    ): FinancialScenario {
      const sold = Math.min(qty, expectedSell);
      const leftover = Math.max(0, qty - sold);

      const revenue = unitPrice && pricingReliable ? sold * unitPrice : null;
      const wasteCost = unitCost && pricingReliable ? leftover * unitCost : null;
      const netProfit =
        revenue != null && wasteCost != null ? revenue - wasteCost : null;

      const upside =
        qty >= suggestedQty
          ? stockoutRisk >= 0.3
            ? t("workspace.today.itemDetail.upside.coversHighRunOutRisk")
            : t("workspace.today.itemDetail.upside.goodCoverageDemandSpikes")
          : t("workspace.today.itemDetail.upside.lowerWasteSoftDemand");

      const downside =
        qty > suggestedQty
          ? wasteRisk >= 0.3
            ? t("workspace.today.itemDetail.downside.mayGoUnsold", { qty: fmtQty(leftover, unit) })
            : t("workspace.today.itemDetail.downside.smallWasteRisk")
          : stockoutRisk >= 0.3
            ? t("workspace.today.itemDetail.downside.runningShort")
            : t("workspace.today.itemDetail.downside.mayMissLateDemand");

      return { label, qty, revenue, wasteCost, netProfit, upside, downside, ...opts };
    }

    // Expected sell ≈ AI suggested (the most likely demand)
    const expectedDemand = suggestedQty;

    const scenarios: FinancialScenario[] = [
      buildScenario(t("workspace.today.itemDetail.scenario.conservative"), conservativeQty, expectedDemand, {}),
      buildScenario(t("workspace.today.itemDetail.scenario.followAi"), suggestedQty, expectedDemand, { isHighlighted: true }),
      buildScenario(t("workspace.today.itemDetail.scenario.extraBuffer"), aggressiveQty, expectedDemand, {}),
    ];

    // Insert "Your plan" only if meaningfully different from AI
    if (
      plannedQty != null &&
      Math.abs(plannedQty - suggestedQty) >= 0.5 &&
      plannedQty !== conservativeQty &&
      plannedQty !== aggressiveQty
    ) {
      return [
        buildScenario(t("workspace.today.itemDetail.scenario.conservative"), conservativeQty, expectedDemand, {}),
        buildScenario(t("workspace.today.itemDetail.scenario.followAi"), suggestedQty, expectedDemand, { isHighlighted: true }),
        buildScenario(t("workspace.today.itemDetail.scenario.yourPlan"), plannedQty, expectedDemand, {}),
      ];
    }

    return scenarios;
  }, [suggestedQty, plannedQty, unitPrice, unitCost, pricingReliable, lowerBound, upperBound, stockoutRisk, wasteRisk, unit, t]);

  // Build fallback scenarios for ScenarioBarChart if backend didn't provide them
  const chartScenarios = useMemo(() => {
    const backendScenarios: any[] = advancedForecast?.scenarios ?? [];
    if (backendScenarios.length) return backendScenarios;
    if (suggestedQty == null) return [];
    const lower = lowerBound ?? Math.round(suggestedQty * 0.85);
    const upper = upperBound ?? Math.round(suggestedQty * 1.15);
    return [
      { name: t("workspace.today.itemDetail.scenario.conservative"), forecast: lower, description: t("workspace.today.itemDetail.scenario.lowerWasteRisk") },
      { name: t("workspace.today.itemDetail.scenario.extraBuffer"), forecast: upper, description: t("workspace.today.itemDetail.scenario.coversDemandSpikes") },
    ];
  }, [advancedForecast?.scenarios, suggestedQty, lowerBound, upperBound, t]);

  const signalLabels: Record<string, string> = useMemo(() => ({
    reservation: t("workspace.today.itemDetail.signal.reservation"),
    event: t("workspace.today.itemDetail.signal.event"),
    weather: t("workspace.today.itemDetail.signal.weather"),
    staffing: t("workspace.today.itemDetail.signal.staffing"),
    kitchen_capacity: t("workspace.today.itemDetail.signal.kitchenCapacity"),
    delivery_mix: t("workspace.today.itemDetail.signal.deliveryMix"),
    traffic: t("workspace.today.itemDetail.signal.traffic"),
  }), [t]);

  // Load ingredient demand on mount (only once)
  useEffect(() => {
    if (!branchId || !productId || ingredientLoaded) return;
    ingredientDemandMutation
      .mutateAsync()
      .then((data) => {
        setIngredientData(data);
        setIngredientLoaded(true);
      })
      .catch(() => setIngredientLoaded(true));
  }, [branchId, productId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Reset after 2s so the chef can adjust again if needed
      setTimeout(() => setSubmitState("idle"), 2000);
    } catch {
      setSubmitState("error");
    }
  }

  const isLoading = advancedForecastQuery.isLoading || todayQuery.isLoading;

  return (
    <WorkspaceShell
      eyebrow={t("workspace.today.itemDetail.eyebrow")}
      title={itemTitle}
      description={t("workspace.today.itemDetail.description", { date: targetDate })}
      insight={t("workspace.today.itemDetail.insight")}
    >
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/workspace/today?branch_id=${branchId}&date=${targetDate}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("workspace.today.itemDetail.backToPrepPlan")}
        </Link>
      </div>

      {isLoading ? (
        <div className="py-20 text-center">
          <p className="text-sm text-text-muted">{t("workspace.today.itemDetail.loading")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* ============================================================
              MAIN COLUMN
          ============================================================ */}
          <div className="lg:col-span-2 space-y-8">

            {/* ── 1. Why this number ── */}
            {(prepItem?.forecast_context?.reasoning?.length ||
              advancedForecast?.signal_contributions) ? (
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  {t("workspace.today.itemDetail.whyThisNumber")}
                </p>

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

                {advancedForecast?.signal_contributions ? (
                  <div className="mt-5 rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                      {t("workspace.today.itemDetail.howForecastBuilt")}
                    </p>
                    <p className="mb-4 text-xs text-text-muted">
                      {t("workspace.today.itemDetail.howForecastBuiltDesc")}
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

                {!advancedForecast?.signal_contributions &&
                prepItem?.forecast_context?.applied_signals ? (
                  <div className="mt-4 space-y-1.5">
                    {Object.entries(prepItem.forecast_context.applied_signals).map(
                      ([key, signal]: [string, any]) => {
                        const modifier = signal?.modifier ?? 0;
                        if (Math.abs(modifier) < 0.005) return null;
                        const label = signalLabels[key] ?? key;
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
                {t("workspace.today.itemDetail.confidence")}
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
                      t,
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

                {advancedForecast?.chef_weight != null && (
                  <p className="mt-4 border-t border-surface-4 pt-3 text-xs text-text-muted">
                    {t("workspace.today.itemDetail.chefWeight.overrideWeight", { weight: fmtPct(advancedForecast.chef_weight) })}{" "}
                    {advancedForecast.chef_recommendation === "TRUST_CHEF"
                      ? t("workspace.today.itemDetail.chefWeight.trustChef")
                      : advancedForecast.chef_recommendation === "BLEND_WITH_MODEL"
                        ? t("workspace.today.itemDetail.chefWeight.blended")
                        : t("workspace.today.itemDetail.chefWeight.modelLed")}
                  </p>
                )}
              </div>
            </section>

            {/* ── 3. Scenario comparison (quantity) ── */}
            {suggestedQty != null ? (
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  {t("workspace.today.itemDetail.whatIf")}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {t("workspace.today.itemDetail.comparePrepQuantities")}
                </p>
                <div className="mt-3 rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
                  <ScenarioBarChart
                    baseValue={suggestedQty}
                    scenarios={chartScenarios}
                    unitLabel={unit}
                  />
                </div>
              </section>
            ) : null}

            {/* ── 4. Financial scenarios ── */}
            {financialScenarios && financialScenarios.length > 0 ? (
              <FinancialScenarios
                scenarios={financialScenarios}
                unit={unit}
                pricingReliable={pricingReliable}
              />
            ) : null}

            {/* ── 5. Track record ── */}
            {dailyHistory.length > 0 ? (
              <TrackRecord
                history={dailyHistory}
                unit={unit}
                targetWeekday={targetWeekday}
              />
            ) : forecastMetrics && !metricsQuery.isLoading ? (
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  {t("workspace.today.itemDetail.trackRecord.title")}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    {
                      label: t("workspace.today.itemDetail.metrics.pastAccuracy"),
                      value:
                        forecastMetrics.forecast_accuracy != null
                          ? `${(forecastMetrics.forecast_accuracy * 100).toFixed(0)}%`
                          : "—",
                    },
                    {
                      label: t("workspace.today.itemDetail.metrics.wasteRate"),
                      value:
                        forecastMetrics.waste_rate != null
                          ? `${(forecastMetrics.waste_rate * 100).toFixed(1)}%`
                          : "—",
                    },
                    {
                      label: t("workspace.today.itemDetail.metrics.stockoutRate"),
                      value:
                        forecastMetrics.stockout_rate != null
                          ? `${(forecastMetrics.stockout_rate * 100).toFixed(1)}%`
                          : "—",
                    },
                    {
                      label: t("workspace.today.itemDetail.metrics.daysTracked"),
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
                {trendNarrative(forecastMetrics?.trend, t) ? (
                  <p className="mt-3 text-xs text-text-secondary">
                    {trendNarrative(forecastMetrics.trend, t)}
                  </p>
                ) : null}
              </section>
            ) : null}

            {/* ── 6. What you'll need ── */}
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.today.itemDetail.ingredients.whatYouNeed")}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {t("workspace.today.itemDetail.ingredients.description", {
                  qty: plannedQty != null ? fmtQty(plannedQty, unit) : t("workspace.today.itemDetail.ingredients.yourPlannedQty"),
                  item: itemTitle,
                })}
              </p>
              <div className="mt-3 overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
                {!ingredientLoaded ? (
                  <div className="px-5 py-5 text-center">
                    <p className="text-sm text-text-muted">{t("workspace.today.itemDetail.ingredients.calculating")}</p>
                  </div>
                ) : !ingredientData || ingredientData.no_recipe ? (
                  <div className="px-5 py-5">
                    <p className="text-sm text-text-secondary">{t("workspace.today.itemDetail.ingredients.noRecipe")}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {t("workspace.today.itemDetail.ingredients.addRecipe")}
                    </p>
                    <Link
                      href={`/workspace/inventory?branch=${branchId}&org=${resolvedOrgId}&tab=recipes`}
                      className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-gold/40 px-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10"
                    >
                      {t("workspace.today.itemDetail.ingredients.buildRecipe")}
                    </Link>
                  </div>
                ) : ingredientData.ingredients?.length === 0 ? (
                  <div className="px-5 py-5">
                    <p className="text-sm text-text-muted">
                      {t("workspace.today.itemDetail.ingredients.emptyRecipe")}
                    </p>
                    {ingredientData.menu_item_id && (
                      <Link
                        href={`/workspace/inventory/recipes/${ingredientData.menu_item_id}?branch=${branchId}`}
                        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-gold/40 px-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10"
                      >
                        {t("workspace.today.itemDetail.ingredients.editRecipe")}
                      </Link>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="divide-y divide-surface-4">
                      {ingredientData.ingredients.map((ing: any, idx: number) => (
                        <div
                          key={ing.ingredient_id ?? idx}
                          className="flex items-center justify-between px-5 py-3 hover:bg-surface-3/30 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {ing.ingredient_name}
                            </p>
                            {ing.per_serving != null && (
                              <p className="mt-0.5 text-[11px] text-text-muted">
                                {t("workspace.today.itemDetail.ingredients.perServing", { amount: ing.per_serving, unit: ing.unit })}
                                {ing.waste_factor > 0
                                  ? ` · ${t("workspace.today.itemDetail.ingredients.wasteBuffer", { pct: (ing.waste_factor * 100).toFixed(0) })}`
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
                    <div className="flex items-center justify-between border-t border-surface-4 bg-surface-3/20 px-5 py-3">
                      <p className="text-[11px] text-text-muted">
                        {t("workspace.today.itemDetail.ingredients.basedOn", {
                          qty: ingredientData.planned_quantity != null
                            ? fmtQty(ingredientData.planned_quantity, unit)
                            : t("workspace.today.itemDetail.ingredients.plannedQuantity"),
                          name: ingredientData.item_name ?? itemTitle,
                        })}
                      </p>
                      {ingredientData.menu_item_id && (
                        <Link
                          href={`/workspace/inventory/recipes/${ingredientData.menu_item_id}?branch=${branchId}`}
                          className="text-[11px] font-semibold text-brand-gold hover:underline"
                        >
                          {t("workspace.today.itemDetail.ingredients.editRecipe")}
                        </Link>
                      )}
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
                  {t("workspace.today.itemDetail.decision.yourDecision")}
                </p>
              </div>
              <div className="px-5 py-4 space-y-4">

                {/* AI vs Your plan */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.today.itemDetail.decision.aiRecommends")}
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                      {suggestedQty != null ? fmtQty(suggestedQty, unit) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.today.itemDetail.decision.yourPlan")}
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                      {plannedQty != null ? fmtQty(plannedQty, unit) : t("workspace.today.itemDetail.decision.notSet")}
                    </p>
                  </div>
                </div>

                {variance != null && Math.abs(variance) >= 0.5 && (
                  <p className={`text-xs ${varianceLabel(variance, unit, t).tone}`}>
                    {varianceLabel(variance, unit, t).text}
                  </p>
                )}

                {/* Decision status */}
                {prepItem?.decision ? (
                  <div className="flex items-center justify-between border-t border-surface-4 pt-3">
                    <p className="text-xs text-text-muted">{t("workspace.today.itemDetail.decision.status")}</p>
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
                        ? t("workspace.today.itemDetail.decision.acceptedAi")
                        : prepItem.decision === "CHEF_OVERRIDE"
                          ? t("workspace.today.itemDetail.decision.yourOverride")
                          : t("workspace.today.itemDetail.decision.pending")}
                    </span>
                  </div>
                ) : null}

                {/* Save feedback */}
                {submitState === "done" && (
                  <p className="text-xs font-semibold text-status-success">
                    {t("workspace.today.itemDetail.decision.planSaved")}
                  </p>
                )}
                {submitState === "error" && (
                  <p className="text-xs text-status-critical">
                    {t("workspace.today.itemDetail.decision.couldNotSave")}
                  </p>
                )}

                {/* Action buttons — always visible (reset to idle after save) */}
                {!isPlanLocked && (
                  <div className="space-y-2 border-t border-surface-4 pt-3">
                    {suggestedQty != null && (
                      <button
                        type="button"
                        onClick={() => handleDecision(suggestedQty, true)}
                        disabled={submitState === "saving"}
                        className="w-full inline-flex h-9 items-center justify-center rounded-full border border-status-success/40 bg-status-success/15 text-xs font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98] disabled:opacity-60"
                      >
                        {submitState === "saving"
                          ? t("workspace.today.itemDetail.decision.saving")
                          : t("workspace.today.itemDetail.decision.accept", { qty: fmtQty(suggestedQty, unit) })}
                      </button>
                    )}

                    {/* Override input — always available */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder={
                          plannedQty != null ? String(Math.round(plannedQty)) : t("workspace.today.itemDetail.decision.qtyPlaceholder")
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
                        {t("workspace.today.itemDetail.decision.setOverride")}
                      </button>
                    </div>
                  </div>
                )}

                {isPlanLocked && (
                  <p className="border-t border-surface-4 pt-3 text-xs text-status-success">
                    {t("workspace.today.itemDetail.decision.planLocked")}
                  </p>
                )}
              </div>
            </div>

            {/* ── Risk snapshot ── */}
            {prepItem?.forecast_context && (
              <div className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("workspace.today.itemDetail.risk.riskToday")}
                </p>
                <div className="space-y-3.5">
                  <RiskBar
                    label={t("workspace.today.itemDetail.risk.runOutRisk")}
                    value={prepItem.forecast_context.risk_of_stockout ?? 0}
                  />
                  <RiskBar
                    label={t("workspace.today.itemDetail.risk.wasteRisk")}
                    value={prepItem.forecast_context.risk_of_waste ?? 0}
                  />
                </div>
                {prepItem.forecast_context.risk_of_stockout >= 0.45 && (
                  <p className="mt-3 text-xs text-status-critical">
                    {t("workspace.today.itemDetail.risk.highRunOut")}
                  </p>
                )}
                {prepItem.forecast_context.risk_of_waste >= 0.45 && (
                  <p className="mt-3 text-xs text-status-warning">
                    {t("workspace.today.itemDetail.risk.highWaste")}
                  </p>
                )}
              </div>
            )}

            {/* ── Quick stats ── */}
            {forecastMetrics && (
              <div className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("workspace.today.itemDetail.quickStats.past60Days")}
                </p>
                <div className="space-y-2 text-xs">
                  {forecastMetrics.forecast_accuracy != null && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">{t("workspace.today.itemDetail.quickStats.aiAccuracy")}</span>
                      <span className="font-semibold text-text-primary">
                        {(forecastMetrics.forecast_accuracy * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                  {forecastMetrics.stockout_rate != null && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">{t("workspace.today.itemDetail.quickStats.stockouts")}</span>
                      <span
                        className={`font-semibold ${forecastMetrics.stockout_rate > 0.05 ? "text-status-critical" : "text-text-primary"}`}
                      >
                        {(forecastMetrics.stockout_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {forecastMetrics.waste_rate != null && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">{t("workspace.today.itemDetail.quickStats.wasteRate")}</span>
                      <span
                        className={`font-semibold ${forecastMetrics.waste_rate > 0.08 ? "text-status-warning" : "text-text-primary"}`}
                      >
                        {(forecastMetrics.waste_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {forecastMetrics.data_points != null && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">{t("workspace.today.itemDetail.quickStats.daysTracked")}</span>
                      <span className="font-semibold text-text-primary">
                        {forecastMetrics.data_points}
                      </span>
                    </div>
                  )}
                </div>
                {trendNarrative(forecastMetrics?.trend, t) ? (
                  <p className="mt-3 border-t border-surface-4 pt-3 text-[11px] text-text-secondary">
                    {trendNarrative(forecastMetrics.trend, t)}
                  </p>
                ) : null}
              </div>
            )}

            <Link
              href={`/workspace/forecast-intelligence/${productId}?branch_id=${branchId}&date=${targetDate}`}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-brand-gold/30 px-4 py-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10"
            >
              {t("workspace.today.itemDetail.viewFullHistory")}
            </Link>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}

export default function DeepDivePage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div className="px-6 py-8 text-sm text-text-muted">{t("workspace.today.itemDetail.loading")}</div>}>
      <DeepDiveContent />
    </Suspense>
  );
}
