"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shop, Calendar } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
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
  waste_risk_increase: number;
  marginal_cost_risk: number;
  stockout_risk_change: number;
};

function toPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function confidenceLabel(score: number) {
  if (score >= 0.75) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

export default function TodayWorkspacePage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const role = user?.organization_role ?? "";
  const canAccess = role === "STAFF_OPERATOR" || role === "BRANCH_MANAGER" || role === "GM";

  const branches = branchesQuery.data ?? [];
  const accessibleBranches = accessScope?.accessible_branches ?? [];
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

  const evaluateDebounce = useRef<Record<string, number>>({});

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

  useEffect(() => {
    const err = todayQuery.error as { status?: number } | null;
    if (err?.status === 404 && branchId) {
      initializeMutation.mutate({ branch_id: branchId, date: targetDate });
    }
  }, [todayQuery.error, branchId, targetDate, initializeMutation]);

  const branchDay = initializeMutation.data ?? todayQuery.data;

  useEffect(() => {
    if (!branchDay) return;
    const initialPlans: Record<string, number | ""> = {};
    for (const item of branchDay.prep_plan_items) {
      initialPlans[item.id] = item.planned_quantity ?? "";
    }
    setPlannedQtyByItem(initialPlans);
  }, [branchDay?.id]);

  const isMorning = branchDay?.status === "MORNING";
  const isLive = branchDay?.status === "LIVE";
  const isClosed = branchDay?.status === "CLOSED";

  const rows = useMemo(() => {
    if (!branchDay) return [];
    return branchDay.prep_plan_items.map((item) => {
      const planned = plannedQtyByItem[item.id] === "" ? null : Number(plannedQtyByItem[item.id]);
      const variance = planned == null ? null : planned - item.suggested_quantity;
      const impact = impactByItem[item.id];
      return { item, planned, variance, impact };
    });
  }, [branchDay, plannedQtyByItem, impactByItem]);

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
    updateBranchDayStatusMutation.mutate({
      branchDayId: branchDay.id,
      payload: { status: "LIVE" },
    });
  };

  const closeServiceDay = () => {
    if (!branchDay?.id) return;
    updateBranchDayStatusMutation.mutate({
      branchDayId: branchDay.id,
      payload: { status: "CLOSED" },
    });
  };

  const logProduction = (prepPlanItemId: string, quantityProduced: number) => {
    createProductionLogMutation.mutate({
      prep_plan_item_id: prepPlanItemId,
      quantity_produced: quantityProduced,
      waste_quantity: 0,
    });
  };

  const logWaste = (prepPlanItemId: string) => {
    const input = window.prompt("Waste quantity");
    if (!input) return;
    const wasteQuantity = Number(input);
    if (!Number.isFinite(wasteQuantity) || wasteQuantity <= 0) return;
    createProductionLogMutation.mutate({
      prep_plan_item_id: prepPlanItemId,
      quantity_produced: 0,
      waste_quantity: wasteQuantity,
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

      {isMorning && branchDay ? (
        <section className="mb-8">
          <button
            type="button"
            onClick={startLiveService}
            disabled={updateBranchDayStatusMutation.isPending}
            className="inline-flex h-12 items-center gap-2.5 rounded-lg border border-brand-gold/40 bg-gradient-to-br from-brand-gold/15 to-brand-gold/5 px-6 text-sm font-bold text-brand-gold transition-all duration-200 hover:border-brand-gold hover:from-brand-gold/20 hover:to-brand-gold/10 hover:shadow-[0_0_24px_rgba(168,130,31,0.2)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateBranchDayStatusMutation.isPending ? "Starting service..." : "Start Service (Live Mode)"}
          </button>
        </section>
      ) : null}

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
          <section className="mb-12">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Demand Signal
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Today's Forecast
              </h3>
            </div>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  Expected Demand
                </p>
                <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                  {toPercent((branchDay.demand_signal.expected_demand_index - 1) * 100)}
                </p>
                <div className="mt-4 pt-4 border-t border-surface-4">
                  <p className="text-xs text-text-muted">vs baseline</p>
                </div>
              </article>
              
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  Confidence
                </p>
                <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                  {confidenceLabel(branchDay.demand_signal.forecast_confidence)}
                </p>
                <div className="mt-4 pt-4 border-t border-surface-4">
                  <p className="text-xs text-text-muted">
                    {(branchDay.demand_signal.forecast_confidence * 100).toFixed(0)}% score
                  </p>
                </div>
              </article>
              
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  Event Modifier
                </p>
                <p className="font-display text-4xl font-semibold text-status-warning tracking-tight">
                  {toPercent(branchDay.demand_signal.event_modifier_percentage * 100)}
                </p>
                <div className="mt-4 pt-4 border-t border-surface-4">
                  <p className="text-xs text-text-muted">Special events</p>
                </div>
              </article>
            </div>
          </section>

          <section className="mt-12">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Morning Planning
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Prep Recommendations
              </h3>
            </div>
            
            <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1260px]">
                  <thead className="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Item</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Suggested</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Your Plan</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Variance</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Impact</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-4">
                    {rows.map(({ item, planned, variance, impact }) => (
                      <tr key={item.id} className="align-top transition-all duration-200 hover:bg-surface-3/50">
                        <td className="px-6 py-6 text-sm font-semibold text-text-primary">{item.product_title}</td>
                        <td className="px-6 py-6 text-sm text-text-secondary">
                          {item.suggested_quantity} {item.unit}
                        </td>
                        <td className="px-6 py-6">
                          <input
                            value={plannedQtyByItem[item.id] ?? ""}
                            onChange={(event) => onPlannedChange(item.id, event.target.value)}
                            placeholder={`${item.suggested_quantity}`}
                            className="h-10 w-32 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                          />
                        </td>
                        <td className={`px-6 py-6 text-sm font-semibold ${variance == null ? "text-text-muted" : variance > 0 ? "text-status-warning" : variance < 0 ? "text-status-critical" : "text-status-success"}`}>
                          {variance == null ? "-" : `${variance > 0 ? "+" : ""}${variance.toFixed(2)} ${item.unit}`}
                        </td>
                        <td className="px-6 py-6">
                          {impact ? (
                            <div className="space-y-1.5 text-xs">
                              <p className="text-status-warning font-medium">⚠ May increase waste risk by {impact.waste_risk_increase.toFixed(1)}%</p>
                              <p className="text-text-secondary">Estimated marginal exposure: ${impact.marginal_cost_risk.toFixed(2)}</p>
                              <p className={`font-medium ${impact.stockout_risk_change <= 0 ? "text-status-success" : "text-status-critical"}`}>
                                Stockout risk change: {impact.stockout_risk_change > 0 ? "+" : ""}{impact.stockout_risk_change.toFixed(1)}%
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-text-muted">Type your plan to preview impact.</p>
                          )}
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => acceptSuggestion(item.id, item.suggested_quantity)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-status-success/40 bg-surface-3 px-3 text-xs font-medium text-status-success transition-all duration-200 hover:border-status-success hover:bg-status-success/10 active:scale-[0.98]"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => keepMyPlan(item.id, planned)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-medium text-text-primary transition-all duration-200 hover:border-surface-4 hover:bg-surface-2 active:scale-[0.98]"
                            >
                              Keep Mine
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              onClick={closeServiceDay}
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
                    return (
                      <tr key={item.id} className="align-middle transition-all duration-200 hover:bg-surface-3/50">
                        <td className="px-6 py-5 text-sm font-semibold text-text-primary">{item.product_title}</td>
                        <td className="px-6 py-5 text-sm text-text-secondary">
                          {planned.toFixed(2)} {item.unit}
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-text-primary">
                              {produced.toFixed(2)} {item.unit}
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
                            {remaining.toFixed(2)} {item.unit}
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
                              onClick={() => logWaste(item.id)}
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
    </WorkspaceShell>
  );
}
