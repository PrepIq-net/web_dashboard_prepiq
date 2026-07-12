import type { BranchDayToday, PrepPlanItem } from "@/services/production-intelligence/types";
import {
  formatMoney,
  formatQuantity,
  formatSignedMoney,
  isDiscreteUnit,
  percent01,
  signedQuantity,
} from "@/lib/format";

/** Shape of the i18n translate function threaded through helpers. */
export type Translator = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

/** Result of the prep-plan evaluate endpoint used for override previews. */
export type ImpactPreview = {
  delta_quantity: number;
  waste_risk_increase: number;
  marginal_cost_risk: number;
  stockout_risk_change: number;
  sell_through_probability: number;
  estimated_extra_margin_if_sold: number;
  potential_unsold_loss: number;
  margin_impact_estimate: number;
  deviation: number;
  deviation_threshold: number;
  impact_simulation_triggered: boolean;
  impact_simulation: {
    suggested_qty: number;
    waste_probability_change: number;
    stockout_probability_change: number;
    margin_savings: number;
  };
  narrative?: string;
  food_cost_at_risk?: number;
  shortfall_margin_risk?: number;
};

/** One reviewable prep-plan row with its editing state folded in. */
export type PrepRow = {
  item: PrepPlanItem;
  planned: number | null;
  variance: number | null;
  impact: ImpactPreview | undefined;
  riskScore: number;
};

/** One live-monitor row with resolved quantities. */
export type LiveRow = {
  item: PrepPlanItem;
  monitor: PrepPlanItem["live_monitor"];
  planned: number;
  additional: number;
  sold: number;
  remaining: number;
};

// ── Labels & tones ───────────────────────────────────────────────────────────

export function confidenceLabel(t: Translator, score: number) {
  if (score >= 0.75) return t("today.confidence.high");
  if (score >= 0.5) return t("today.confidence.medium");
  return t("today.confidence.low");
}

export function riskTone(value: number) {
  if (value >= 0.45) return "text-status-critical";
  if (value >= 0.25) return "text-status-warning";
  return "text-status-success";
}

export function riskLabel(t: Translator, value: number) {
  if (value >= 0.45) return t("today.riskLabel.high");
  if (value >= 0.25) return t("today.riskLabel.medium");
  return t("today.riskLabel.low");
}

export function signalToneClasses(
  direction: "up" | "down" | "neutral",
  valuePct: number,
) {
  if (direction === "neutral") {
    return "text-text-muted border-surface-4 bg-surface-3/35";
  }
  if (direction === "down") {
    return "text-status-critical border-status-critical/35 bg-status-critical/10";
  }
  if (Math.abs(valuePct) >= 8) {
    return "text-status-success border-status-success/35 bg-status-success/10";
  }
  return "text-status-warning border-status-warning/35 bg-status-warning/10";
}

export function popularityLabel(t: Translator, rank: number) {
  if (rank <= 3) return t("today.popularity.top3");
  if (rank <= 5) return t("today.popularity.highDemand");
  return t("today.popularity.rank", { rank });
}

export function signalLabel(t: Translator, key: string): string {
  const map: Record<string, string> = {
    reservation: t("today.signalLabel.reservation"),
    event: t("today.signalLabel.event"),
    weather: t("today.signalLabel.weather"),
    staffing: t("today.signalLabel.staffing"),
    kitchen_capacity: t("today.signalLabel.kitchenCapacity"),
    delivery_mix: t("today.signalLabel.deliveryMix"),
    traffic: t("today.signalLabel.traffic"),
    similar_day: t("today.signalLabel.similarDay"),
    local_event: t("today.signalLabel.localEvent"),
  };
  return map[key] ?? key;
}

export function getFallbackDemandSignals(t: Translator) {
  return [
    {
      key: "similar_day",
      label: t("today.fallbackSignal.similarDay.label"),
      value_pct: 0,
      direction: "neutral" as const,
      explanation: t("today.fallbackSignal.similarDay.explanation"),
    },
    {
      key: "reservation",
      label: t("today.fallbackSignal.reservation.label"),
      value_pct: 0,
      direction: "neutral" as const,
      explanation: t("today.fallbackSignal.reservation.explanation"),
    },
    {
      key: "weather",
      label: t("today.fallbackSignal.weather.label"),
      value_pct: 0,
      direction: "neutral" as const,
      explanation: t("today.fallbackSignal.weather.explanation"),
    },
    {
      key: "local_event",
      label: t("today.fallbackSignal.localEvent.label"),
      value_pct: 0,
      direction: "neutral" as const,
      explanation: t("today.fallbackSignal.localEvent.explanation"),
    },
  ];
}

// ── Financial snapshot ───────────────────────────────────────────────────────

export function buildFinancialSnapshot(params: {
  plannedQty: number;
  predictedQty: number;
  unit: string;
  unitPrice?: number | null;
  unitCost?: number | null;
  unitMargin?: number | null;
}) {
  const { plannedQty, predictedQty, unit, unitPrice, unitCost, unitMargin } =
    params;
  const revenueIfSold = unitPrice != null ? plannedQty * unitPrice : null;
  const marginIfSold = unitMargin != null ? plannedQty * unitMargin : null;
  const wasteIfAll = unitCost != null ? plannedQty * unitCost : null;
  const shortfallQty = Math.max(0, predictedQty - plannedQty);
  const lostMarginIfStockout =
    unitMargin != null ? shortfallQty * unitMargin : null;
  return {
    revenueIfSold,
    marginIfSold,
    wasteIfAll,
    shortfallQty,
    lostMarginIfStockout,
    unit,
  };
}

export type FinancialSnapshot = ReturnType<typeof buildFinancialSnapshot>;

export function hasPricing(item: PrepPlanItem): boolean {
  return (
    item.forecast_context.unit_price != null ||
    item.forecast_context.unit_cost != null ||
    item.forecast_context.unit_margin != null
  );
}

export function overrideImpactLine(
  t: Translator,
  impact: ImpactPreview | undefined,
  variance: number | null,
  suggestedQty: number,
): { text: string; tone: "warning" | "critical" } | null {
  if (!impact || variance == null || Math.abs(variance) < suggestedQty * 0.06)
    return null;
  if (variance > 0 && impact.food_cost_at_risk && impact.food_cost_at_risk > 0) {
    return {
      text: t("today.override.foodAtRisk", {
        amount: formatMoney(impact.food_cost_at_risk),
      }),
      tone: "warning",
    };
  }
  if (
    variance < 0 &&
    impact.shortfall_margin_risk &&
    impact.shortfall_margin_risk > 0
  ) {
    return {
      text: t("today.override.marginAtRisk", {
        amount: formatMoney(impact.shortfall_margin_risk),
      }),
      tone: "critical",
    };
  }
  return null;
}

// ── Derived aggregates ───────────────────────────────────────────────────────

export function deriveDecisionSummary(rows: PrepRow[]) {
  const reviewed = rows.filter((row) => row.planned != null).length;
  const accepted = rows.filter(
    (row) =>
      row.item.decision === "ACCEPTED_AI" || row.item.accepted_suggestion,
  ).length;
  const overridden = rows.filter(
    (row) => row.item.decision === "CHEF_OVERRIDE",
  ).length;
  const projectedWaste = rows.length
    ? (rows.reduce(
        (sum, row) => sum + row.item.forecast_context.risk_of_waste,
        0,
      ) /
        rows.length) *
      100
    : 0;
  const avgDeviation = rows.length
    ? rows.reduce((sum, row) => sum + Math.abs(row.variance ?? 0), 0) /
      rows.length
    : 0;
  const avgSuggested = rows.length
    ? rows.reduce(
        (sum, row) => sum + Math.max(1, row.item.suggested_quantity),
        0,
      ) / rows.length
    : 1;
  const accuracyImpact = Math.max(
    -5,
    Math.min(5, ((avgSuggested - avgDeviation) / avgSuggested - 0.5) * 4),
  );
  return { reviewed, accepted, overridden, projectedWaste, accuracyImpact };
}

export type DecisionSummary = ReturnType<typeof deriveDecisionSummary>;

export function deriveLiveRows(
  items: PrepPlanItem[] | undefined,
): LiveRow[] {
  return (items ?? []).map((item) => {
    const monitor = item.live_monitor;
    const planned =
      monitor?.planned_qty ?? item.planned_quantity ?? item.suggested_quantity;
    const additional =
      monitor?.additional_qty ?? Math.max(item.final_quantity - planned, 0);
    const sold = monitor?.sold_today ?? 0;
    const remaining =
      monitor?.remaining_qty ?? Math.max(item.final_quantity - sold, 0);
    return { item, monitor, planned, additional, sold, remaining };
  });
}

/** Tiers for the live monitor: needs-action → watch → on-track. */
export function tierLiveRows(rows: LiveRow[]) {
  const criticalRows: LiveRow[] = [];
  const watchRows: LiveRow[] = [];
  const okRows: LiveRow[] = [];
  for (const row of rows) {
    const sr = row.monitor?.risk_engine?.stockout_risk ?? "LOW";
    const wr = row.monitor?.risk_engine?.waste_risk ?? "LOW";
    if (sr === "HIGH") criticalRows.push(row);
    else if (sr === "MEDIUM" || wr === "HIGH" || wr === "MEDIUM")
      watchRows.push(row);
    else okRows.push(row);
  }
  return { criticalRows, watchRows, okRows };
}

// ── Morning risk alerts ──────────────────────────────────────────────────────

export type MorningRiskAlert = {
  id: string;
  itemName: string;
  unit: string;
  riskType: "STOCKOUT" | "WASTE" | "MARGIN";
  severity: "HIGH" | "MEDIUM" | "WATCH";
  riskMetrics: {
    stockoutRiskPct: number;
    wasteRiskPct: number;
    marginImpact: number;
    variance: number;
    suggestedBuffer: number;
  };
  varianceLabel: string;
  bufferLabel: string;
  suggestedFixQty: number;
  drivers: string[];
  impact: ImpactPreview | undefined;
  financials: FinancialSnapshot;
  hasPricing: boolean;
};

export function buildMorningRiskAlerts(
  t: Translator,
  rows: PrepRow[],
): MorningRiskAlert[] {
  const candidates = rows
    .filter(
      (row) =>
        row.riskScore >= 0.45 ||
        row.item.forecast_context.confidence_score < 0.65 ||
        Math.abs(row.variance ?? 0) > row.item.suggested_quantity * 0.15,
    )
    .slice(0, 3);
  return candidates.map(({ item, riskScore, impact, planned, variance }) => {
    const confidence = confidenceLabel(
      t,
      item.forecast_context.confidence_score,
    );
    const stockoutRiskPct = item.forecast_context.risk_of_stockout * 100;
    const wasteRiskPct = item.forecast_context.risk_of_waste * 100;
    const plannedQty = planned ?? item.suggested_quantity;
    const shortfallQty = Math.max(0, item.suggested_quantity - plannedQty);
    const overprepQty = Math.max(0, plannedQty - item.suggested_quantity);
    const suggestedBuffer = Math.max(
      1,
      isDiscreteUnit(item.unit)
        ? Math.round(item.suggested_quantity * 0.08)
        : Number((item.suggested_quantity * 0.08).toFixed(2)),
    );
    const primaryRiskType =
      stockoutRiskPct >= wasteRiskPct && stockoutRiskPct >= 42
        ? "STOCKOUT"
        : wasteRiskPct >= 38
          ? "WASTE"
          : "MARGIN";
    const primaryRiskSeverity =
      riskScore >= 0.65 || stockoutRiskPct >= 60 || wasteRiskPct >= 60
        ? "HIGH"
        : riskScore >= 0.45 || stockoutRiskPct >= 45 || wasteRiskPct >= 45
          ? "MEDIUM"
          : "WATCH";
    const drivers: string[] = [
      t("today.riskAlert.driver.planVsSuggested", {
        planned: formatQuantity(plannedQty, item.unit),
        suggested: formatQuantity(item.suggested_quantity, item.unit),
      }),
      t("today.riskAlert.driver.expectedOrders", {
        orders: Math.round(item.forecast_context.predicted_orders),
        confidence,
        pct: percent01(item.forecast_context.confidence_score),
      }),
    ];
    if (primaryRiskType === "STOCKOUT") {
      drivers.push(
        shortfallQty > 0
          ? t("today.riskAlert.driver.stockoutBelow", {
              quantity: formatQuantity(shortfallQty, item.unit),
            })
          : t("today.riskAlert.driver.stockoutPressure"),
      );
    }
    if (primaryRiskType === "WASTE") {
      drivers.push(
        overprepQty > 0
          ? t("today.riskAlert.driver.wasteAbove", {
              quantity: formatQuantity(overprepQty, item.unit),
            })
          : t("today.riskAlert.driver.wasteSignal"),
      );
    }
    if (primaryRiskType === "MARGIN" && impact) {
      drivers.push(
        t("today.riskAlert.driver.marginShift", {
          amount: formatSignedMoney(impact.margin_impact_estimate),
        }),
      );
    }
    const suggestedFixQty =
      primaryRiskType === "STOCKOUT"
        ? isDiscreteUnit(item.unit)
          ? Math.round(item.suggested_quantity + suggestedBuffer)
          : Number((item.suggested_quantity + suggestedBuffer).toFixed(2))
        : primaryRiskType === "WASTE"
          ? isDiscreteUnit(item.unit)
            ? Math.round(item.suggested_quantity - suggestedBuffer * 0.5)
            : Number(
                (item.suggested_quantity - suggestedBuffer * 0.5).toFixed(2),
              )
          : isDiscreteUnit(item.unit)
            ? Math.round(item.suggested_quantity)
            : item.suggested_quantity;
    const financials = buildFinancialSnapshot({
      plannedQty,
      predictedQty: item.forecast_context.predicted_quantity_needed,
      unit: item.unit,
      unitPrice: item.forecast_context.unit_price,
      unitCost: item.forecast_context.unit_cost,
      unitMargin: item.forecast_context.unit_margin,
    });
    return {
      id: item.id,
      itemName: item.product_title,
      unit: item.unit,
      riskType: primaryRiskType,
      severity: primaryRiskSeverity,
      riskMetrics: {
        stockoutRiskPct,
        wasteRiskPct,
        marginImpact: impact?.margin_impact_estimate ?? 0,
        variance: variance ?? 0,
        suggestedBuffer,
      },
      varianceLabel: signedQuantity(variance ?? 0, item.unit),
      bufferLabel: formatQuantity(suggestedBuffer, item.unit),
      suggestedFixQty,
      drivers,
      impact,
      financials,
      hasPricing: hasPricing(item),
    };
  });
}

// ── Network intelligence ─────────────────────────────────────────────────────

type KitchenNetwork = NonNullable<
  BranchDayToday["kitchen_intelligence_network"]
>;

export function deriveNetworkLearnings(network: KitchenNetwork | null | undefined) {
  if (!network) return [];
  const learnings: Array<{
    label: string;
    detail: string;
    confidence?: number;
  }> = [];
  const activeLocations = network.network_aggregation.active_locations ?? 0;
  const positivePattern = (network.network_aggregation.detected_patterns ?? [])
    .filter((pattern) => pattern.is_validated && pattern.effect_pct > 0)
    .sort((a, b) => b.effect_pct - a.effect_pct)[0];
  if (positivePattern) {
    learnings.push({
      label: `${positivePattern.item_name} demand trending ${positivePattern.effect_pct >= 0 ? "+" : ""}${positivePattern.effect_pct.toFixed(1)}%`,
      detail: `Observed across ${activeLocations} location${activeLocations === 1 ? "" : "s"}.`,
      confidence: positivePattern.confidence,
    });
  }
  const rainPattern = (network.network_aggregation.detected_patterns ?? [])
    .filter(
      (pattern) =>
        pattern.is_validated &&
        pattern.trigger_factor === "rain" &&
        pattern.effect_pct > 0,
    )
    .sort((a, b) => b.confidence - a.confidence)[0];
  if (rainPattern) {
    const supported =
      network.knowledge_transfer.find(
        (row) =>
          row.item_id === rainPattern.item_id && row.trigger_factor === "rain",
      )?.supporting_kitchens_count ?? 0;
    learnings.push({
      label: `Rain increases ${rainPattern.item_name.toLowerCase()} demand`,
      detail: `Validated in ${supported || 1} similar branch${supported === 1 ? "" : "es"}.`,
      confidence: rainPattern.confidence,
    });
  }
  const wastePattern = (network.network_aggregation.cross_location_patterns ??
    [])[0];
  if (wastePattern) {
    learnings.push({
      label: `${wastePattern.item_name} waste variance detected`,
      detail: `Visible across at least 2 locations (spread ${wastePattern.spread_pct.toFixed(1)}%).`,
      confidence: wastePattern.confidence,
    });
  }
  return learnings.slice(0, 3);
}

export function deriveNetworkSuggestedAction(
  t: Translator,
  network: KitchenNetwork | null | undefined,
) {
  const transfer = network?.knowledge_transfer?.[0];
  if (transfer?.suggested_action) return transfer.suggested_action;
  const wastePattern =
    network?.network_aggregation?.cross_location_patterns?.[0];
  if (!wastePattern) return t("today.network.noAction");
  return t("today.network.reduceExposure", {
    itemName: wastePattern.item_name,
  });
}
