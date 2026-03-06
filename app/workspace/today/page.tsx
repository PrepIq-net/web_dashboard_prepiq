"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shop, Calendar } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { ConfirmActionModal } from "@/components/dashboard/today/confirm-action-modal";
import { LogWasteModal } from "@/components/dashboard/today/log-waste-modal";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
} from "@/services";
import {
  useBranchDayToday,
  useCreateProductionLog,
  useEvaluatePrepPlan,
  useInitializeBranchDay,
  useUpdateBranchDayStatus,
  useUpdatePrepPlanItem,
} from "@/services/production-intelligence/hooks";

type ImpactPreview = {
  delta_quantity: number;
  waste_risk_increase: number;
  marginal_cost_risk: number;
  stockout_risk_change: number;
  sell_through_probability: number;
  estimated_extra_margin_if_sold: number;
  potential_unsold_loss: number;
  margin_impact_estimate: number;
};

const EMPTY_LIST: never[] = [];

function toPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function confidenceLabel(score: number) {
  if (score >= 0.75) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

function percent(value: number) {
  const normalized = Math.max(0, Math.min(1, value));
  return `${(normalized * 100).toFixed(0)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function riskTone(value: number) {
  if (value >= 0.45) return "text-status-critical";
  if (value >= 0.25) return "text-status-warning";
  return "text-status-success";
}

function riskLabel(value: number) {
  if (value >= 0.45) return "High";
  if (value >= 0.25) return "Medium";
  return "Low";
}

function signalToneClasses(direction: "up" | "down" | "neutral", valuePct: number) {
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

function popularityLabel(rank: number) {
  if (rank <= 3) return "Top 3 projected seller";
  if (rank <= 5) return "High-demand item";
  return `Projected rank #${rank}`;
}

function isDiscreteUnit(unit: string) {
  return ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes((unit || "").toUpperCase());
}

function formatQuantity(value: number, unit: string) {
  if (isDiscreteUnit(unit)) {
    return `${Math.round(value)} ${unit}`;
  }
  return `${value.toFixed(2)} ${unit}`;
}

function signedQuantity(value: number, unit: string) {
  const prefix = value > 0 ? "+" : "";
  if (isDiscreteUnit(unit)) {
    return `${prefix}${Math.round(value)} ${unit}`;
  }
  return `${prefix}${value.toFixed(2)} ${unit}`;
}

const FALLBACK_DEMAND_SIGNALS = [
  {
    key: "similar_day",
    label: "Similar days",
    value_pct: 0,
    direction: "neutral" as const,
    explanation: "Similar weekday baseline signal.",
  },
  {
    key: "reservation",
    label: "Reservation volume",
    value_pct: 0,
    direction: "neutral" as const,
    explanation: "Reservation-linked demand adjustment.",
  },
  {
    key: "weather",
    label: "Weather",
    value_pct: 0,
    direction: "neutral" as const,
    explanation: "Weather and temperature demand effect.",
  },
  {
    key: "local_event",
    label: "Local event",
    value_pct: 0,
    direction: "neutral" as const,
    explanation: "Local event and special activity effect.",
  },
];

export default function TodayWorkspacePage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const role = user?.organization_role ?? "";
  const canAccess = role === "STAFF_OPERATOR" || role === "BRANCH_MANAGER" || role === "GM";

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const branchOptions = useMemo(() => {
    const accessibleBranchIds = new Set(accessibleBranches.map((branch) => branch.id));
    const byId = new Map<string, (typeof branches)[number]>();
    for (const branch of branches) {
      byId.set(branch.id, branch);
    }
    for (const branch of accessibleBranches) {
      if (byId.has(branch.id)) continue;
      byId.set(branch.id, {
        id: branch.id,
        organization: user?.organization_id ?? "",
        organization_name: user?.organization_name ?? "",
        name: branch.name,
        code: "",
        address: "",
        phone: null,
        email: null,
        timezone: "UTC",
        is_primary: branch.is_primary,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    const merged = Array.from(byId.values());
    if (!accessibleBranchIds.size) return merged;
    return merged.filter((branch) => accessibleBranchIds.has(branch.id));
  }, [branches, accessibleBranches, user?.organization_id, user?.organization_name]);

  const defaultBranch =
    branchOptions.find((branch) => branch.id === accessScope?.default_branch_id) ??
    branchOptions.find((branch) => branch.is_primary) ??
    branchOptions[0] ??
    null;

  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState(defaultBranch?.id ?? "");
  const [plannedQtyByItem, setPlannedQtyByItem] = useState<Record<string, number | "">>({});
  const [impactByItem, setImpactByItem] = useState<Record<string, ImpactPreview>>({});
  const [confirmAction, setConfirmAction] = useState<null | "START_LIVE" | "CLOSE_DAY">(null);
  const [wasteItem, setWasteItem] = useState<null | { id: string; title: string; unit: string }>(null);

  const evaluateDebounce = useRef<Record<string, number>>({});
  const initializeAttemptedByKey = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!branchId && defaultBranch?.id) {
      setBranchId(defaultBranch.id);
    }
  }, [branchId, defaultBranch?.id]);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, canAccess]);

  const todayQuery = useBranchDayToday({ branch_id: branchId, date: targetDate }, Boolean(branchId));
  const initializeMutation = useInitializeBranchDay();
  const evaluateMutation = useEvaluatePrepPlan();
  const updateBranchDayStatusMutation = useUpdateBranchDayStatus();
  const createProductionLogMutation = useCreateProductionLog();
  const updatePrepPlanMutation = useUpdatePrepPlanItem();

  const initKey = branchId && targetDate ? `${branchId}:${targetDate}` : "";
  useEffect(() => {
    if (!todayQuery.isError) return;
    const err = todayQuery.error as { status?: number } | null;
    if (err?.status !== 404 || !branchId || !initKey || initializeMutation.isPending) return;
    if (initializeAttemptedByKey.current[initKey]) return;

    initializeAttemptedByKey.current[initKey] = true;
    if (err?.status === 404) {
      initializeMutation.mutate({ branch_id: branchId, date: targetDate });
    }
  }, [todayQuery.isError, todayQuery.error, branchId, targetDate, initializeMutation.isPending, initializeMutation.mutate, initKey]);

  const branchDay = initializeMutation.data ?? todayQuery.data;

  useEffect(() => {
    if (!branchDay) return;
    const initialPlans: Record<string, number | ""> = {};
    for (const item of branchDay.prep_plan_items) {
      initialPlans[item.id] = item.planned_quantity ?? item.suggested_quantity;
    }
    setPlannedQtyByItem(initialPlans);
  }, [branchDay?.id]);

  const isMorning = branchDay?.status === "MORNING";
  const isLive = branchDay?.status === "LIVE";
  const isClosed = branchDay?.status === "CLOSED";

  const rows = useMemo(() => {
    if (!branchDay) return [];
    const preparedRows = branchDay.prep_plan_items.map((item) => {
      const planned = plannedQtyByItem[item.id] === "" ? null : Number(plannedQtyByItem[item.id]);
      const variance = planned == null ? null : planned - item.suggested_quantity;
      const impact = impactByItem[item.id];
      const baseRisk = Math.max(item.forecast_context.risk_of_stockout, item.forecast_context.risk_of_waste);
      const impactRiskBoost =
        impact == null ? 0 : Math.max(Math.max(0, impact.waste_risk_increase) / 100, Math.max(0, impact.stockout_risk_change) / 100);
      const riskScore = Math.min(1, baseRisk + impactRiskBoost);
      return { item, planned, variance, impact, riskScore };
    });
    return preparedRows.sort((a, b) => b.riskScore - a.riskScore);
  }, [branchDay, plannedQtyByItem, impactByItem]);

  const highPriorityRows = useMemo(() => rows.filter((row) => row.riskScore >= 0.45), [rows]);
  const lowerImpactRows = useMemo(() => rows.filter((row) => row.riskScore < 0.45), [rows]);
  const forecastRowsByDemand = useMemo(
    () =>
      [...rows].sort(
        (a, b) => b.item.forecast_context.predicted_orders - a.item.forecast_context.predicted_orders,
      ),
    [rows],
  );

  const evaluateImpact = (prepPlanItemId: string, plannedQuantity: number) => {
    evaluateMutation.mutate(
      {
        prep_plan_item_id: prepPlanItemId,
        planned_quantity: plannedQuantity,
      },
      {
        onSuccess: (data) => {
          setImpactByItem((prev) => ({ ...prev, [prepPlanItemId]: data }));
        },
      },
    );
  };

  const onPlannedChange = (prepPlanItemId: string, value: string) => {
    const parsed = value === "" ? "" : Number(value);
    setPlannedQtyByItem((prev) => ({ ...prev, [prepPlanItemId]: parsed }));

    if (evaluateDebounce.current[prepPlanItemId]) {
      window.clearTimeout(evaluateDebounce.current[prepPlanItemId]);
    }

    if (parsed === "" || Number.isNaN(parsed)) return;

    evaluateDebounce.current[prepPlanItemId] = window.setTimeout(() => {
      evaluateImpact(prepPlanItemId, Number(parsed));
    }, 300);
  };

  const acceptSuggestion = (prepPlanItemId: string, suggestedQuantity: number) => {
    updatePrepPlanMutation.mutate(
      {
        prepPlanItemId,
        payload: {
          planned_quantity: suggestedQuantity,
          accepted_suggestion: true,
        },
      },
      {
        onSuccess: () => {
          setPlannedQtyByItem((prev) => ({ ...prev, [prepPlanItemId]: suggestedQuantity }));
        },
      },
    );
  };

  const keepMyPlan = (prepPlanItemId: string, plannedQuantity: number | null) => {
    if (plannedQuantity == null || Number.isNaN(plannedQuantity)) return;
    updatePrepPlanMutation.mutate({
      prepPlanItemId,
      payload: {
        planned_quantity: plannedQuantity,
        accepted_suggestion: false,
      },
    });
  };

  const startLiveService = () => {
    if (!branchDay?.id) return;
    updateBranchDayStatusMutation.mutate(
      {
        branchDayId: branchDay.id,
        payload: { status: "LIVE" },
      },
      {
        onSuccess: () => setConfirmAction(null),
      },
    );
  };

  const closeServiceDay = () => {
    if (!branchDay?.id) return;
    updateBranchDayStatusMutation.mutate(
      {
        branchDayId: branchDay.id,
        payload: { status: "CLOSED" },
      },
      {
        onSuccess: () => setConfirmAction(null),
      },
    );
  };

  const openWasteModal = (prepPlanItemId: string, productTitle: string, unit: string) => {
    setWasteItem({
      id: prepPlanItemId,
      title: productTitle,
      unit,
    });
  };

  const logProduction = (prepPlanItemId: string, quantityProduced: number) => {
    createProductionLogMutation.mutate({
      prep_plan_item_id: prepPlanItemId,
      quantity_produced: quantityProduced,
      waste_quantity: 0,
    });
  };

  const logWaste = (prepPlanItemId: string, wasteQuantity: number) => {
    createProductionLogMutation.mutate({
      prep_plan_item_id: prepPlanItemId,
      quantity_produced: 0,
      waste_quantity: wasteQuantity,
    }, {
      onSuccess: () => setWasteItem(null),
    });
  };

  const loading = isLoading || branchesQuery.isLoading || todayQuery.isLoading || initializeMutation.isPending;
  const noBranchContext = !loading && !branchOptions.length;
  const statusLabel = loading
    ? "Loading day context..."
    : noBranchContext
      ? "Status: NO_BRANCH_CONTEXT"
      : branchDay
        ? `Status: ${branchDay.status}`
        : branchId
          ? "Status: NOT_INITIALIZED"
          : "Status: SELECT_BRANCH";

  return (
    <WorkspaceShell
      eyebrow="Today"
      title="Today"
      description="Morning planning mode with demand signal, recommendation acceptance, and deviation capture before live service starts."
      insight="Deviation tracking compounds forecast quality when planned vs suggested decisions are consistently captured each morning."
    >
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Select
            label="Branch"
            leadingIcon={<Shop className="h-4 w-4" />}
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={branchId}
            onChange={setBranchId}
            disabled={noBranchContext}
            placeholder={noBranchContext ? "No branches available" : "Select branch"}
          />
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="h-12 w-full rounded-button border border-border-default bg-surface-3 pl-10 pr-3 text-sm text-text-primary transition-all duration-200 hover:bg-surface-4 focus:outline-none focus:ring-1 focus:border-brand-gold focus:ring-brand-gold/20"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Status
            </label>
            <div className="flex items-center h-12 px-4 rounded-button bg-surface-3 border border-border-default">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${
                  loading ? "bg-text-muted animate-pulse" :
                  noBranchContext ? "bg-status-critical" :
                  branchDay ? "bg-status-success" : "bg-status-warning"
                }`} />
                <p className="text-sm font-medium text-text-primary">
                  {statusLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {noBranchContext ? (
        <section className="mt-8">
          <div className="bg-surface-2 rounded-xl p-8 border border-surface-4 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-status-warning/20 mb-4">
              <Shop className="h-6 w-6 text-status-warning" />
            </div>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              No branch context is available for this account yet. Assign this user to at least one active branch,
              then refresh this page.
            </p>
          </div>
        </section>
      ) : null}

      {isMorning && branchDay ? (
        <>
          <section className="mb-10 border-b border-surface-4/70 pb-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Morning Decision Engine
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                  Plan Today&apos;s Prep
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                  Suggestions are pre-filled. Review each item, inspect the reason, and override only where needed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmAction("START_LIVE")}
                disabled={updateBranchDayStatusMutation.isPending}
                className="inline-flex h-11 items-center justify-center rounded-full border border-brand-gold/45 px-5 text-sm font-semibold text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateBranchDayStatusMutation.isPending ? "Starting service..." : "Start Live Service"}
              </button>
            </div>

            <div className="mt-8 border-t border-surface-4/60 pt-5">
              <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Demand Signal
                </p>
                <h4 className="mt-2 font-display text-xl font-semibold text-text-primary">
                  Today&apos;s Demand Signal
                </h4>
                <p className="mt-3 text-sm text-text-secondary">
                  Expected Demand:{" "}
                  <span className="font-semibold text-text-primary">
                    {toPercent(
                      branchDay.demand_signal.expected_demand_delta_pct ??
                        (branchDay.demand_signal.expected_demand_index - 1) * 100,
                    )}
                  </span>{" "}
                  vs typical{" "}
                  <span className="font-semibold text-text-primary">
                    {branchDay.demand_signal.typical_day_label ?? new Date(branchDay.date).toLocaleDateString("en-US", { weekday: "long" })}
                  </span>
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Confidence:{" "}
                  <span className="font-semibold text-text-primary">
                    {branchDay.demand_signal.confidence_label ?? confidenceLabel(branchDay.demand_signal.forecast_confidence)}
                  </span>{" "}
                  <span className="text-text-muted">
                    ({percent(branchDay.demand_signal.forecast_confidence)})
                  </span>
                </p>

                <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {(branchDay.demand_signal.signals ?? FALLBACK_DEMAND_SIGNALS).map((signal) => (
                    <div
                      key={signal.key}
                      className={`rounded-lg border px-3 py-3 ${signalToneClasses(signal.direction, signal.value_pct)}`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.14em]">{signal.label}</p>
                      <p className="mt-1 text-sm font-semibold">
                        {signal.direction === "neutral" ? "Neutral" : toPercent(signal.value_pct)}
                      </p>
                      <p className="mt-1 text-xs opacity-85">{signal.explanation}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">High Risk Items</p>
                    <p className="mt-1 text-base font-semibold text-status-warning">
                      {branchDay.morning_overview?.high_risk_items ?? branchDay.demand_signal.high_risk_items ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Prep Cost (Est.)</p>
                    <p className="mt-1 text-base font-semibold text-text-primary">
                      {formatCurrency(branchDay.morning_overview?.estimated_total_prep_cost ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Projected Margin</p>
                    <p className="mt-1 text-base font-semibold text-status-success">
                      {formatCurrency(branchDay.morning_overview?.projected_margin_total ?? 0)}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="mb-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Forecast Prep List
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Core Planning Interface
              </h3>
              <p className="mt-2 text-sm text-text-secondary">
                One row per prep item with forecast confidence and demand priority.
              </p>
            </div>

            <div className="mt-5 overflow-x-auto rounded-xl border border-surface-4 bg-surface-2">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-surface-4 bg-surface-3/35">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Item</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Forecast</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Confidence</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Risk</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Popularity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4/70">
                  {forecastRowsByDemand.map(({ item, riskScore }, index) => (
                    <tr key={`forecast-${item.id}`} className="align-top hover:bg-surface-3/30">
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-text-primary">{item.product_title}</p>
                        <p className="mt-1 text-xs text-text-muted">
                          Expected orders {Math.round(item.forecast_context.predicted_orders)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-text-primary">
                        {formatQuantity(item.suggested_quantity, item.unit)}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-text-primary">
                          {percent(item.forecast_context.confidence_score)}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          {confidenceLabel(item.forecast_context.confidence_score)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${riskTone(riskScore)}`}>
                          {riskLabel(riskScore)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {popularityLabel(index + 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Focus First</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Prioritized by stockout and waste risk so the team can decide quickly.
                </p>
              </div>

              <div className="space-y-3">
                {(highPriorityRows.length ? highPriorityRows : rows.slice(0, 3)).map(({ item, planned, variance, impact, riskScore }) => {
                  const context = item.forecast_context;
                  return (
                    <article key={item.id} className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-text-primary">{item.product_title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskTone(riskScore)}`}>
                              {riskLabel(riskScore)} risk
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-text-muted">
                            Suggested {formatQuantity(item.suggested_quantity, item.unit)} · Expected orders {Math.round(context.predicted_orders)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={plannedQtyByItem[item.id] ?? ""}
                            onChange={(event) => onPlannedChange(item.id, event.target.value)}
                            className="h-9 w-32 rounded-full border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                          />
                          <button
                            type="button"
                            onClick={() => acceptSuggestion(item.id, item.suggested_quantity)}
                            className="inline-flex h-8 items-center rounded-full border border-status-success/40 px-3 text-xs font-medium text-status-success transition-colors hover:bg-status-success/10"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => keepMyPlan(item.id, planned)}
                            className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-3"
                          >
                            Keep my plan
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                        <span>
                          Variance:{" "}
                          <span className={variance == null ? "text-text-muted" : variance > 0 ? "text-status-warning" : variance < 0 ? "text-status-critical" : "text-status-success"}>
                            {variance == null ? "-" : signedQuantity(variance, item.unit)}
                          </span>
                        </span>
                      </div>

                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-brand-gold">Reasoning and impact details</summary>
                        <div className="mt-2 space-y-2 text-xs text-text-secondary">
                          {context.reasoning.map((line) => (
                            <p key={`${item.id}-${line}`}>{line}</p>
                          ))}
                          {impact ? (
                            <>
                              <p>
                                {signedQuantity(impact.delta_quantity, item.unit)} {impact.delta_quantity >= 0 ? "above" : "below"} forecast
                              </p>
                              <p>Waste exposure risk increases by {impact.waste_risk_increase.toFixed(1)}%</p>
                              <p>Estimated extra margin if sold: {formatCurrency(impact.estimated_extra_margin_if_sold)}</p>
                              <p>Potential loss if unsold: {formatCurrency(impact.potential_unsold_loss)}</p>
                              <p>Sell-through probability: {percent(impact.sell_through_probability)}</p>
                            </>
                          ) : (
                            <p>Adjust quantity to preview impact.</p>
                          )}
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>

              {lowerImpactRows.length ? (
                <details className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                    Lower Impact Items ({lowerImpactRows.length})
                  </summary>
                  <div className="mt-3 space-y-3">
                    {lowerImpactRows.map(({ item, planned, variance, impact, riskScore }) => (
                      <article key={item.id} className="rounded-lg border border-surface-4/70 bg-surface-3/30 px-3 py-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{item.product_title}</p>
                            <p className={`mt-1 text-xs ${riskTone(riskScore)}`}>{riskLabel(riskScore)} risk</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={plannedQtyByItem[item.id] ?? ""}
                              onChange={(event) => onPlannedChange(item.id, event.target.value)}
                              className="h-8 w-28 rounded-full border border-surface-4 bg-surface-3 px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                            />
                            <button
                              type="button"
                              onClick={() => acceptSuggestion(item.id, item.suggested_quantity)}
                              className="inline-flex h-7 items-center rounded-full border border-status-success/40 px-3 text-[11px] font-medium text-status-success transition-colors hover:bg-status-success/10"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => keepMyPlan(item.id, planned)}
                              className="inline-flex h-7 items-center rounded-full border border-surface-4 px-3 text-[11px] font-medium text-text-primary transition-colors hover:bg-surface-3"
                            >
                              Keep
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-text-muted">
                          Variance {variance == null ? "-" : signedQuantity(variance, item.unit)}
                          {impact ? ` · Sell-through ${percent(impact.sell_through_probability)}` : ""}
                        </p>
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {isLive && branchDay ? (
        <section className="mt-12">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Live Service
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Production Logging
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setConfirmAction("CLOSE_DAY")}
              disabled={updateBranchDayStatusMutation.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-status-critical/40 bg-surface-3 px-4 text-sm font-medium text-status-critical transition-all duration-200 hover:border-status-critical hover:bg-status-critical/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateBranchDayStatusMutation.isPending ? "Closing..." : "Close Day"}
            </button>
          </div>
          
          <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead className="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Item</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Planned</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Produced</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Remaining</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4">
                  {branchDay.prep_plan_items.map((item) => {
                    const planned = item.planned_quantity ?? item.suggested_quantity;
                    const produced = item.final_quantity;
                    const remaining = Math.max(planned - produced, 0);
                    const completionPct = planned > 0 ? (produced / planned) * 100 : 0;
                    const liveMonitor = item.live_monitor;
                    return (
                      <tr key={item.id} className="align-middle transition-all duration-200 hover:bg-surface-3/50">
                        <td className="px-6 py-5">
                          <p className="text-sm font-semibold text-text-primary">{item.product_title}</p>
                          {liveMonitor?.signal ? (
                            <p className="mt-1 text-xs text-status-warning">{liveMonitor.signal}</p>
                          ) : (
                            <p className="mt-1 text-xs text-text-muted">
                              Sell-through {percent(liveMonitor?.sell_through_probability ?? 0)} · Sold{" "}
                              {formatQuantity(liveMonitor?.sold_today ?? 0, item.unit)}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-5 text-sm text-text-secondary">
                          {formatQuantity(planned, item.unit)}
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-text-primary">
                              {formatQuantity(produced, item.unit)}
                            </p>
                            <div className="w-32 h-1.5 bg-surface-4 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  completionPct >= 100 ? "bg-status-success" :
                                  completionPct >= 75 ? "bg-brand-gold" :
                                  completionPct >= 50 ? "bg-status-warning" : "bg-status-critical"
                                }`}
                                style={{ width: `${Math.min(completionPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className={`text-sm font-semibold ${
                            remaining === 0 ? "text-status-success" :
                            remaining <= planned * 0.25 ? "text-status-warning" : "text-text-secondary"
                          }`}>
                            {formatQuantity(remaining, item.unit)}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => logProduction(item.id, 1)}
                              className="inline-flex h-9 items-center justify-center min-w-[64px] rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-semibold text-text-primary transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 hover:text-brand-gold active:scale-[0.98]"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => logProduction(item.id, 5)}
                              className="inline-flex h-9 items-center justify-center min-w-[64px] rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-semibold text-text-primary transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 hover:text-brand-gold active:scale-[0.98]"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              onClick={() => openWasteModal(item.id, item.product_title, item.unit)}
                              className="inline-flex h-9 items-center justify-center min-w-[90px] rounded-lg border border-status-critical/40 bg-surface-3 px-3 text-xs font-semibold text-status-critical transition-all duration-200 hover:border-status-critical hover:bg-status-critical/10 active:scale-[0.98]"
                            >
                              Log Waste
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {isClosed && branchDay ? (
        <section className="mt-12">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Day Complete
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Performance Review
            </h3>
          </div>
          
          {branchDay.review_summary ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-5">
                <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                    Revenue
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                      ${branchDay.review_summary.total_revenue}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-surface-4">
                    <p className="text-xs text-text-muted">Total sales</p>
                  </div>
                </article>
                
                <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                    Waste Cost
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="font-display text-3xl font-semibold text-status-critical tracking-tight">
                      ${branchDay.review_summary.total_waste_cost}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-surface-4">
                    <p className="text-xs text-text-muted">Total waste</p>
                  </div>
                </article>
                
                <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                    Stockouts
                  </p>
                  <p className="font-display text-3xl font-semibold text-text-primary tracking-tight">
                    {branchDay.review_summary.stockout_count}
                  </p>
                  <div className="mt-4 pt-4 border-t border-surface-4">
                    <p className="text-xs text-text-muted">Items out of stock</p>
                  </div>
                </article>
                
                <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                    Lost Revenue
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="font-display text-3xl font-semibold text-status-warning tracking-tight">
                      ${branchDay.review_summary.lost_revenue_estimate}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-surface-4">
                    <p className="text-xs text-text-muted">Opportunity cost</p>
                  </div>
                </article>
                
                <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                    Forecast Accuracy
                  </p>
                  <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                    {branchDay.review_summary.forecast_accuracy_percentage.toFixed(1)}%
                  </p>
                  <div className="mt-4 pt-4 border-t border-surface-4">
                    <div className="w-full h-1.5 bg-surface-4 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-status-success rounded-full"
                        style={{ width: `${branchDay.review_summary.forecast_accuracy_percentage}%` }}
                      />
                    </div>
                  </div>
                </article>
              </div>

              {branchDay.review_insights?.length ? (
                <div className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-4">
                    AI Insights
                  </p>
                  <div className="space-y-3">
                    {branchDay.review_insights.slice(0, 3).map((insight, index) => (
                      <div key={`${index}-${insight}`} className="flex items-start gap-3 p-3 rounded-lg bg-surface-3/50 border border-surface-4">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold/20 text-xs font-bold text-brand-gold flex-shrink-0">
                          {index + 1}
                        </span>
                        <p className="text-sm leading-relaxed text-text-secondary flex-1">
                          {insight}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {branchDay.close_review ? (
                <div className="space-y-8 border-t border-surface-4/70 pt-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                      Forecast Accuracy Report
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                      <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">AI Accuracy</p>
                        <p className="mt-2 font-display text-2xl text-text-primary">
                          {branchDay.close_review.forecast_accuracy_report.ai_forecast_accuracy_percentage.toFixed(1)}%
                        </p>
                      </article>
                      <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Chef Plan Accuracy</p>
                        <p className="mt-2 font-display text-2xl text-text-primary">
                          {branchDay.close_review.forecast_accuracy_report.chef_plan_accuracy_percentage.toFixed(1)}%
                        </p>
                      </article>
                      <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Within Forecast</p>
                        <p className="mt-2 font-display text-2xl text-status-success">
                          {branchDay.close_review.forecast_accuracy_report.items_within_forecast_band}
                        </p>
                      </article>
                      <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Above Forecast</p>
                        <p className="mt-2 font-display text-2xl text-status-warning">
                          {branchDay.close_review.forecast_accuracy_report.items_over_forecast}
                        </p>
                      </article>
                      <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Below Forecast</p>
                        <p className="mt-2 font-display text-2xl text-status-critical">
                          {branchDay.close_review.forecast_accuracy_report.items_under_forecast}
                        </p>
                      </article>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                        Chef Adjustment Intelligence
                      </p>
                      <p className="mt-3 text-sm text-text-secondary">
                        Overrides:{" "}
                        <span className="font-semibold text-text-primary">
                          {branchDay.close_review.chef_adjustment_intelligence.adjustments_made}
                        </span>{" "}
                        · Demand-supported:{" "}
                        <span className="font-semibold text-status-success">
                          {branchDay.close_review.chef_adjustment_intelligence.adjustments_supported_by_demand}
                        </span>{" "}
                        (
                        <span className="font-semibold text-text-primary">
                          {branchDay.close_review.chef_adjustment_intelligence.support_rate_percentage.toFixed(1)}%
                        </span>
                        )
                      </p>
                      <p className="mt-3 text-sm text-text-secondary">
                        {branchDay.close_review.chef_adjustment_intelligence.pattern_hint}
                      </p>
                      {branchDay.close_review.chef_adjustment_intelligence.weekly_behavior_model ? (
                        <div className="mt-4 border-t border-surface-4 pt-3 text-sm text-text-secondary">
                          <p>
                            Weekly bias:{" "}
                            <span className="font-semibold text-text-primary">
                              {branchDay.close_review.chef_adjustment_intelligence.weekly_behavior_model.weekday}
                            </span>{" "}
                            tends{" "}
                            <span className="font-semibold text-brand-gold">
                              {branchDay.close_review.chef_adjustment_intelligence.weekly_behavior_model.direction === "up" ? "+" : "-"}
                              {Math.abs(
                                branchDay.close_review.chef_adjustment_intelligence.weekly_behavior_model.bias_quantity,
                              ).toFixed(2)}
                              {branchDay.close_review.chef_adjustment_intelligence.weekly_behavior_model.unit}
                            </span>{" "}
                            from forecast.
                          </p>
                          <p className="mt-1 text-xs text-text-muted">
                            {branchDay.close_review.chef_adjustment_intelligence.weekly_behavior_model.sample_size} samples ·{" "}
                            {branchDay.close_review.chef_adjustment_intelligence.weekly_behavior_model.support_rate_percentage.toFixed(1)}%
                            demand-supported.
                          </p>
                        </div>
                      ) : null}
                    </article>

                    <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                        Margin Protection Insight
                      </p>
                      <p className="mt-3 text-sm text-text-secondary">
                        {branchDay.close_review.margin_protection_insight.headline}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                        <p className="text-status-success">
                          Saved exposure:{" "}
                          <span className="font-semibold">
                            {formatCurrency(branchDay.close_review.margin_protection_insight.waste_cost_saved_estimate)}
                          </span>
                        </p>
                        <p className="text-status-critical">
                          Loss exposure:{" "}
                          <span className="font-semibold">
                            {formatCurrency(branchDay.close_review.margin_protection_insight.loss_exposure_estimate)}
                          </span>
                        </p>
                      </div>
                    </article>
                  </div>

                  {branchDay.close_review.learning_examples.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                        Learning Loop Samples
                      </p>
                      <div className="mt-3 overflow-x-auto border-y border-surface-4/70">
                        <table className="w-full min-w-[820px]">
                          <thead>
                            <tr className="border-b border-surface-4/70">
                              <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Item</th>
                              <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">AI Suggestion</th>
                              <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Chef Plan</th>
                              <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Actual Sold</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-4/55">
                            {branchDay.close_review.learning_examples.map((row) => (
                              <tr key={`${row.item_title}-${row.unit}-${row.suggested_quantity}`}>
                                <td className="px-3 py-3 text-sm font-medium text-text-primary">{row.item_title}</td>
                                <td className="px-3 py-3 text-sm text-text-secondary">{formatQuantity(row.suggested_quantity, row.unit)}</td>
                                <td className="px-3 py-3 text-sm text-text-secondary">{formatQuantity(row.planned_quantity, row.unit)}</td>
                                <td className="px-3 py-3 text-sm text-text-secondary">{formatQuantity(row.actual_sold_quantity, row.unit)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="bg-surface-2 rounded-xl p-8 border border-surface-4 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/20 mb-4">
                <div className="h-6 w-6 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-text-muted">Review summary is being prepared...</p>
            </div>
          )}
        </section>
      ) : null}

      {branchDay && branchDay.status !== "MORNING" && branchDay.status !== "LIVE" && branchDay.status !== "CLOSED" ? (
        <section className="mt-8">
          <div className="bg-surface-2 rounded-xl p-8 border border-surface-4 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/20 mb-4">
              <Calendar className="h-6 w-6 text-brand-gold" />
            </div>
            <p className="text-sm text-text-secondary">
              This screen is currently optimized for Morning Mode. Current status is{" "}
              <span className="font-semibold text-text-primary">{branchDay.status}</span>.
            </p>
          </div>
        </section>
      ) : null}

      {!loading && branchDay && branchDay.status === "MORNING" && branchDay.prep_plan_items.length === 0 ? (
        <section className="mt-8">
          <div className="bg-surface-2 rounded-xl p-8 border border-surface-4 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-status-warning/20 mb-4">
              <Calendar className="h-6 w-6 text-status-warning" />
            </div>
            <p className="text-sm text-text-secondary">
              Morning mode is initialized, but there are no active prep items for this branch yet.
            </p>
          </div>
        </section>
      ) : null}

      <ConfirmActionModal
        open={confirmAction === "START_LIVE"}
        title="Start Live Service?"
        description="This switches Today into live execution mode and enables rapid production logging."
        confirmLabel="Start Live Service"
        isConfirming={updateBranchDayStatusMutation.isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={startLiveService}
      />

      <ConfirmActionModal
        open={confirmAction === "CLOSE_DAY"}
        title="Close Service Day?"
        description="This finalizes today and runs the end-of-day review summary."
        confirmLabel="Close Day"
        tone="critical"
        isConfirming={updateBranchDayStatusMutation.isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={closeServiceDay}
      />

      <LogWasteModal
        open={Boolean(wasteItem)}
        itemTitle={wasteItem?.title ?? ""}
        unit={wasteItem?.unit ?? ""}
        isSubmitting={createProductionLogMutation.isPending}
        onClose={() => setWasteItem(null)}
        onSubmit={(wasteQuantity) => {
          if (!wasteItem) return;
          logWaste(wasteItem.id, wasteQuantity);
        }}
      />
    </WorkspaceShell>
  );
}
