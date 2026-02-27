"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
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
  }, [isLoading, canAccess, router]);

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
      <section className="border-b border-[#2A2A2E] pb-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            disabled={noBranchContext}
            className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
          >
            {!branchOptions.length ? (
              <option value="">No branches available</option>
            ) : null}
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
          />
          <p className="flex items-center text-[12px] text-[#8E8E93]">
            {statusLabel}
          </p>
        </div>
      </section>

      {isMorning && branchDay ? (
        <section className="mt-6 border-b border-[#2A2A2E] pb-6">
          <button
            type="button"
            onClick={startLiveService}
            disabled={updateBranchDayStatusMutation.isPending}
            className="h-10 rounded-[8px] border border-[#2E2E33] bg-[#232327] px-4 text-[12px] font-semibold text-[#F5F5F7] transition-colors hover:bg-[#2A2A2E] disabled:opacity-60"
          >
            {updateBranchDayStatusMutation.isPending ? "Starting service..." : "Start Service (Live Mode)"}
          </button>
        </section>
      ) : null}

      {noBranchContext ? (
        <section className="mt-8 border-b border-[#2A2A2E] pb-8">
          <p className="text-[12px] text-[#C7C7CC]">
            No branch context is available for this account yet. Assign this user to at least one active branch,
            then refresh this page.
          </p>
        </section>
      ) : null}

      {isMorning && branchDay ? (
        <>
          <section className="mt-8 border-b border-[#2A2A2E] pb-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Demand Signal</p>
            <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-3">
              <article>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Expected Demand</p>
                <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
                  {toPercent((branchDay.demand_signal.expected_demand_index - 1) * 100)}
                </p>
              </article>
              <article>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Confidence</p>
                <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
                  {confidenceLabel(branchDay.demand_signal.forecast_confidence)}
                </p>
              </article>
              <article>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Event Modifier</p>
                <p className="mt-1 font-display text-[30px] text-[#C48B2A]">
                  {toPercent(branchDay.demand_signal.event_modifier_percentage * 100)}
                </p>
              </article>
            </div>
          </section>

          <section className="mt-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Prep Recommendation Table</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[1260px]">
                <thead className="border-b border-[#2A2A2E]">
                  <tr>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Item</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Suggested</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Your Plan</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Variance</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Impact</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ item, planned, variance, impact }) => (
                    <tr key={item.id} className="border-b border-[#232327] align-top">
                      <td className="px-2 py-3 text-[13px] text-[#F5F5F7]">{item.product_title}</td>
                      <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{item.suggested_quantity} {item.unit}</td>
                      <td className="px-2 py-3">
                        <input
                          value={plannedQtyByItem[item.id] ?? ""}
                          onChange={(event) => onPlannedChange(item.id, event.target.value)}
                          placeholder={`${item.suggested_quantity}`}
                          className="h-8 w-28 rounded-[7px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
                        />
                      </td>
                      <td className={`px-2 py-3 text-[12px] ${variance == null ? "text-[#8E8E93]" : variance > 0 ? "text-[#C48B2A]" : variance < 0 ? "text-[#C44949]" : "text-[#3F8F68]"}`}>
                        {variance == null ? "-" : `${variance > 0 ? "+" : ""}${variance.toFixed(2)} ${item.unit}`}
                      </td>
                      <td className="px-2 py-3">
                        {impact ? (
                          <div className="space-y-0.5 text-[11px]">
                            <p className="text-[#C48B2A]">⚠ May increase waste risk by {impact.waste_risk_increase.toFixed(1)}%</p>
                            <p className="text-[#C7C7CC]">Estimated marginal exposure: ${impact.marginal_cost_risk.toFixed(2)}</p>
                            <p className={`${impact.stockout_risk_change <= 0 ? "text-[#3F8F68]" : "text-[#C44949]"}`}>
                              Stockout risk change: {impact.stockout_risk_change > 0 ? "+" : ""}{impact.stockout_risk_change.toFixed(1)}%
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#8E8E93]">Type your plan to preview impact.</p>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => acceptSuggestion(item.id, item.suggested_quantity)}
                            className="h-7 rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#3F8F68]"
                          >
                            Accept Suggestion
                          </button>
                          <button
                            type="button"
                            onClick={() => keepMyPlan(item.id, planned)}
                            className="h-7 rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#F5F5F7]"
                          >
                            Keep My Plan
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {isLive && branchDay ? (
        <section className="mt-8 border-b border-[#2A2A2E] pb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Live Logging</p>
            <button
              type="button"
              onClick={closeServiceDay}
              disabled={updateBranchDayStatusMutation.isPending}
              className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#232327] px-3 text-[12px] font-semibold text-[#F5F5F7] transition-colors hover:bg-[#2A2A2E] disabled:opacity-60"
            >
              {updateBranchDayStatusMutation.isPending ? "Closing..." : "Close Day"}
            </button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead className="border-b border-[#2A2A2E]">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Item</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Planned</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Produced</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Remaining</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Log</th>
                </tr>
              </thead>
              <tbody>
                {branchDay.prep_plan_items.map((item) => {
                  const planned = item.planned_quantity ?? item.suggested_quantity;
                  const produced = item.final_quantity;
                  const remaining = Math.max(planned - produced, 0);
                  return (
                    <tr key={item.id} className="border-b border-[#232327] align-middle">
                      <td className="px-2 py-3 text-[13px] text-[#F5F5F7]">{item.product_title}</td>
                      <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">
                        {planned.toFixed(2)} {item.unit}
                      </td>
                      <td className="px-2 py-3 text-[12px] text-[#F5F5F7]">
                        {produced.toFixed(2)} {item.unit}
                      </td>
                      <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">
                        {remaining.toFixed(2)} {item.unit}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => logProduction(item.id, 1)}
                            className="h-10 min-w-[74px] rounded-[8px] border border-[#2E2E33] px-3 text-[12px] font-semibold text-[#F5F5F7]"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => logProduction(item.id, 5)}
                            className="h-10 min-w-[74px] rounded-[8px] border border-[#2E2E33] px-3 text-[12px] font-semibold text-[#F5F5F7]"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            onClick={() => logWaste(item.id)}
                            className="h-10 min-w-[100px] rounded-[8px] border border-[#3A2A2A] px-3 text-[12px] font-semibold text-[#E38A8A]"
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
        </section>
      ) : null}

      {isClosed && branchDay ? (
        <section className="mt-8 border-b border-[#2A2A2E] pb-8">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Day Review</p>
          {branchDay.review_summary ? (
            <div className="mt-4 space-y-7">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <article>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Revenue</p>
                  <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">${branchDay.review_summary.total_revenue}</p>
                </article>
                <article>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Waste Cost</p>
                  <p className="mt-1 font-display text-[28px] text-[#E38A8A]">${branchDay.review_summary.total_waste_cost}</p>
                </article>
                <article>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Stockouts</p>
                  <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">{branchDay.review_summary.stockout_count}</p>
                </article>
                <article>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Lost Revenue</p>
                  <p className="mt-1 font-display text-[28px] text-[#C48B2A]">${branchDay.review_summary.lost_revenue_estimate}</p>
                </article>
                <article>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Forecast Accuracy</p>
                  <p className="mt-1 font-display text-[28px] text-[#3F8F68]">
                    {branchDay.review_summary.forecast_accuracy_percentage.toFixed(1)}%
                  </p>
                </article>
              </div>

              {branchDay.review_insights?.length ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Smart Insights</p>
                  <div className="mt-3 space-y-2.5">
                    {branchDay.review_insights.slice(0, 3).map((insight, index) => (
                      <p key={`${index}-${insight}`} className="text-[13px] leading-[1.5] text-[#C7C7CC]">
                        {index + 1}. {insight}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-[#8E8E93]">Review summary is being prepared.</p>
          )}
        </section>
      ) : null}

      {branchDay && branchDay.status !== "MORNING" && branchDay.status !== "LIVE" && branchDay.status !== "CLOSED" ? (
        <section className="mt-8 border-b border-[#2A2A2E] pb-8">
          <p className="text-[12px] text-[#8E8E93]">
            This screen is currently optimized for Morning Mode. Current status is <span className="text-[#F5F5F7]">{branchDay.status}</span>.
          </p>
        </section>
      ) : null}

      {!loading && branchDay && branchDay.status === "MORNING" && branchDay.prep_plan_items.length === 0 ? (
        <section className="mt-8 border-b border-[#2A2A2E] pb-8">
          <p className="text-[12px] text-[#8E8E93]">
            Morning mode is initialized, but there are no active prep items for this branch yet.
          </p>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}
