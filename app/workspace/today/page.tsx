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
  useEvaluatePrepPlan,
  useInitializeBranchDay,
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
  const accessibleBranchIds = new Set((accessScope?.accessible_branches ?? []).map((branch) => branch.id));
  const branchOptions = branches.filter((branch) => (accessibleBranchIds.size ? accessibleBranchIds.has(branch.id) : true));

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

  const loading = isLoading || branchesQuery.isLoading || todayQuery.isLoading || initializeMutation.isPending;

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
            className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
          >
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
            {loading ? "Loading day context..." : `Status: ${branchDay?.status ?? "UNKNOWN"}`}
          </p>
        </div>
      </section>

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

      {branchDay && branchDay.status !== "MORNING" ? (
        <section className="mt-8 border-b border-[#2A2A2E] pb-8">
          <p className="text-[12px] text-[#8E8E93]">
            This screen is currently optimized for Morning Mode. Current status is <span className="text-[#F5F5F7]">{branchDay.status}</span>.
          </p>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}
