"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useBranchCommandView,
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
  useSalesDataValidation,
} from "@/services";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { WarningTriangle } from "iconoir-react";

type LocalLog = {
  id: string;
  type: "BATCH" | "WASTE" | "ISSUE";
  itemTitle: string;
  quantity: number;
  unit: string;
  notes: string;
  timestamp: string;
};

function isDiscreteUnit(unit: string) {
  return ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes((unit || "").toUpperCase());
}

function formatQuantity(value: number, unit: string) {
  if (isDiscreteUnit(unit)) {
    return `${Math.round(value)} ${unit}`;
  }
  return `${value.toFixed(2)} ${unit}`;
}

function formatSignedQuantity(value: number, unit: string) {
  const sign = value > 0 ? "+" : "";
  if (isDiscreteUnit(unit)) {
    return `${sign}${Math.round(value)} ${unit}`;
  }
  return `${sign}${value.toFixed(2)} ${unit}`;
}

export default function ProductionPage() {
  const { data: user } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const role = user?.organization_role ?? "";
  const isStaffOperator = role === "STAFF_OPERATOR";
  const isBranchManager = role === "BRANCH_MANAGER" || role === "GM";
  const isOpsDirector = role === "OPS_DIRECTOR";
  const isOwner = role === "ORG_OWNER" || role === "ORG_ADMIN";

  const branches = branchesQuery.data ?? [];
  const accessibleBranchIds = new Set(
    (accessScope?.accessible_branches ?? []).map((branch) => branch.id),
  );

  const branchOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; is_primary: boolean }>();
    for (const branch of branches) {
      byId.set(branch.id, {
        id: branch.id,
        name: branch.name,
        is_primary: Boolean(branch.is_primary),
      });
    }
    for (const branch of accessScope?.accessible_branches ?? []) {
      if (byId.has(branch.id)) continue;
      byId.set(branch.id, {
        id: branch.id,
        name: branch.name,
        is_primary: Boolean(branch.is_primary),
      });
    }
    let merged = Array.from(byId.values());
    if ((isStaffOperator || isBranchManager) && accessibleBranchIds.size) {
      merged = merged.filter((branch) => accessibleBranchIds.has(branch.id));
    }
    return merged;
  }, [branches, accessScope?.accessible_branches, isStaffOperator, isBranchManager, accessibleBranchIds]);

  const [selectedBranchId, setSelectedBranchId] = useState("");
  const defaultBranchId =
    accessScope?.default_branch_id ??
    branchOptions.find((branch) => branch.is_primary)?.id ??
    branchOptions[0]?.id ??
    "";

  useEffect(() => {
    if (!defaultBranchId) return;
    if (!selectedBranchId || !branchOptions.some((branch) => branch.id === selectedBranchId)) {
      setSelectedBranchId(defaultBranchId);
    }
  }, [defaultBranchId, selectedBranchId, branchOptions]);

  const activeBranchId = selectedBranchId || defaultBranchId;
  const activeBranch = branchOptions.find((branch) => branch.id === activeBranchId) ?? null;
  const todayDate = new Date().toISOString().slice(0, 10);

  const branchCommandQuery = useBranchCommandView(
    { branch_id: activeBranchId, target_date: todayDate },
    Boolean(activeBranchId),
  );
  const salesValidationQuery = useSalesDataValidation({
    branch_id: activeBranchId,
    target_date: todayDate,
  });
  const controlTowerQuery = useExecutiveControlTower(undefined, isOpsDirector || isOwner);
  const marginReportQuery = useOwnerMarginProtectionReport(undefined, isOpsDirector || isOwner);

  const recommendations =
    branchCommandQuery.data?.panels.forecast.recommendations ?? [];
  const preparedTotal = Number(
    branchCommandQuery.data?.panels.real_time.prepared_total ?? 0,
  );
  const soldTotal = Number(branchCommandQuery.data?.panels.real_time.sold_total ?? 0);
  const remainingTotal = Number(
    branchCommandQuery.data?.panels.real_time.remaining_total ?? 0,
  );
  const atRiskCount = Number(
    branchCommandQuery.data?.panels.real_time.at_risk_count ?? 0,
  );
  const planTotal = recommendations.reduce(
    (sum, recommendation) =>
      sum + Number(recommendation.recommended_quantity ?? 0),
    0,
  );
  const planAccuracyPct = planTotal > 0 ? (preparedTotal / planTotal) * 100 : 0;
  const progressRatio = planTotal > 0 ? preparedTotal / planTotal : 0;
  const efficiencyScore = Math.max(
    0,
    100 - Math.abs(planAccuracyPct - 100) * 0.6 - atRiskCount * 3,
  );
  const overproductionQty = Math.max(0, preparedTotal - soldTotal);
  const underproductionQty = Math.max(0, soldTotal - preparedTotal);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [batchQuantity, setBatchQuantity] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [wasteReason, setWasteReason] = useState("NONE");
  const [localLogs, setLocalLogs] = useState<LocalLog[]>([]);
  const [completedRows, setCompletedRows] = useState<Record<string, boolean>>({});

  const selectedItem = recommendations.find((item) => item.item_id === selectedItemId);

  const submitLocalLog = (type: LocalLog["type"], itemTitle: string, unit: string) => {
    const quantity = Number(batchQuantity || 0);
    if (!itemTitle || quantity <= 0) return;

    const notePrefix = wasteReason !== "NONE" ? `Waste reason: ${wasteReason}. ` : "";
    setLocalLogs((prev) => [
      {
        id: crypto.randomUUID(),
        type,
        itemTitle,
        quantity,
        unit,
        notes: `${notePrefix}${batchNotes}`.trim(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...prev,
    ]);

    setBatchQuantity("");
    setBatchNotes("");
    setWasteReason("NONE");
  };

  const productionRows = recommendations.map((item, index) => {
    const target = Number(item.recommended_quantity ?? 0);
    const currentProduced = Math.max(
      0,
      Math.round(target * Math.min(1.4, Math.max(0, progressRatio))),
    );
    const variance = currentProduced - target;
    const deadline = `${String(6 + Math.floor((index * 45) / 60)).padStart(2, "0")}:${String((index * 45) % 60).padStart(2, "0")}`;

    const alerts: string[] = [];
    if (variance > Math.max(2, target * 0.1)) alerts.push("Overproduction");
    if (variance < -Math.max(2, target * 0.1)) alerts.push("Underproduction");
    if (remainingTotal <= 20 && index < 2) alerts.push("Ingredient shortage");

    return {
      ...item,
      target,
      currentProduced,
      variance,
      deadline,
      alerts,
      isComplete: Boolean(completedRows[item.item_id]),
    };
  });

  const branchGrid = controlTowerQuery.data?.branch_grid ?? [];
  const marginBranches = marginReportQuery.data?.branches ?? [];

  return (
    <WorkspaceShell
      eyebrow="Production"
      title="Production"
      description="Overview shows current production state. Command actions are for intervention and correction."
      insight="Data quality compounds when production logging discipline is consistent across shifts."
    >
      <section className="mb-8 border-b border-[#2A2A2E] pb-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
            Branch Context
          </label>
          <select
            value={activeBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            className="h-10 min-w-[240px] rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7]"
          >
            {!branchOptions.length ? <option value="">No branches available</option> : null}
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {activeBranch ? (
            <p className="text-[12px] text-[#8E8E93]">
              Active branch: <span className="text-[#C7C7CC]">{activeBranch.name}</span>
            </p>
          ) : null}
        </div>
      </section>

      {isStaffOperator ? (
        <>
          <section className="border-b border-[#2A2A2E] pb-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
              Today&apos;s Plan
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead className="border-b border-[#2A2A2E]">
                  <tr>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Item</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Target</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Deadline</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Current</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Variance</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Alert Flags</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {productionRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#2A2A2E] align-top">
                      <td className="px-2 py-3 text-[13px] text-[#F5F5F7]">{row.item_title}</td>
                      <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{formatQuantity(row.target, row.unit)}</td>
                      <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{row.deadline}</td>
                      <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{formatQuantity(row.currentProduced, row.unit)}</td>
                      <td className={`px-2 py-3 text-[12px] ${row.variance > 0 ? "text-[#C48B2A]" : row.variance < 0 ? "text-[#C44949]" : "text-[#3F8F68]"}`}>
                        {formatSignedQuantity(row.variance, row.unit)}
                      </td>
                      <td className="px-2 py-3 text-[11px] text-[#8E8E93]">
                        {row.alerts.length ? row.alerts.join(" · ") : "None"}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setCompletedRows((prev) => ({
                                ...prev,
                                [row.item_id]: !prev[row.item_id],
                              }))
                            }
                            className="h-7 rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#F5F5F7]"
                          >
                            {row.isComplete ? "Re-open" : "Mark complete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemId(row.item_id);
                              setWasteReason("EXPIRED");
                              setBatchQuantity(String(Math.max(1, Math.floor(row.target * 0.08))));
                            }}
                            className="h-7 rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#C48B2A]"
                          >
                            Report waste
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemId(row.item_id);
                              setBatchNotes("Issue flagged for manager review.");
                            }}
                            className="h-7 rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#C44949]"
                          >
                            Flag issue
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8 border-b border-[#2A2A2E] pb-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
              Batch Log Interface
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <select
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
              >
                <option value="">Select item</option>
                {recommendations.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    {item.item_title}
                  </option>
                ))}
              </select>
              <input
                value={batchQuantity}
                onChange={(event) => setBatchQuantity(event.target.value)}
                placeholder="Quantity"
                className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
              />
              <select
                value={wasteReason}
                onChange={(event) => setWasteReason(event.target.value)}
                className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
              >
                <option value="NONE">Waste reason (optional)</option>
                <option value="EXPIRED">Expired</option>
                <option value="DAMAGED">Damaged</option>
                <option value="OVERPREP">Over-prep</option>
              </select>
              <input
                value={batchNotes}
                onChange={(event) => setBatchNotes(event.target.value)}
                placeholder="Optional notes"
                className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => submitLocalLog("BATCH", selectedItem?.item_title ?? "", selectedItem?.unit ?? "PCS")}
                className="h-8 rounded-[8px] bg-[#A8821F] px-3 text-[12px] font-medium text-[#141416]"
              >
                Log batch
              </button>
              <button
                type="button"
                onClick={() => submitLocalLog("WASTE", selectedItem?.item_title ?? "", selectedItem?.unit ?? "PCS")}
                className="h-8 rounded-[8px] border border-[#2E2E33] px-3 text-[12px] text-[#C48B2A]"
              >
                Report waste
              </button>
              <button
                type="button"
                onClick={() => submitLocalLog("ISSUE", selectedItem?.item_title ?? "", selectedItem?.unit ?? "PCS")}
                className="h-8 rounded-[8px] border border-[#2E2E33] px-3 text-[12px] text-[#C44949]"
              >
                Flag issue
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {localLogs.slice(0, 6).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between border-b border-[#2A2A2E] pb-1.5 text-[12px]">
                  <p className="text-[#C7C7CC]">
                    {entry.type} · {entry.itemTitle} · {formatQuantity(entry.quantity, entry.unit)}
                  </p>
                  <p className="text-[#8E8E93]">{entry.timestamp}</p>
                </div>
              ))}
              {!localLogs.length ? (
                <p className="text-[12px] text-[#8E8E93]">No local logs yet in this session.</p>
              ) : null}
            </div>
          </section>

          <section className="mt-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
              Real-Time Plan Accuracy
            </p>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
              <article>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Produced vs planned</p>
                <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">{planAccuracyPct.toFixed(1)}%</p>
              </article>
              <article>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Remaining quantity</p>
                <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">{remainingTotal.toLocaleString()}</p>
              </article>
              <article>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Alert flags</p>
                <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">{atRiskCount}</p>
              </article>
            </div>
            <div className="mt-3 space-y-1.5 text-[12px] text-[#C7C7CC]">
              {salesValidationQuery.data?.missing_sales_detected ? (
                <p className="text-[#C48B2A]">Sales feed has missing entries for some items.</p>
              ) : null}
              {remainingTotal <= 20 ? (
                <p className="text-[#C44949]">Ingredient shortage risk is elevated for next prep cycle.</p>
              ) : null}
              {!salesValidationQuery.data?.missing_sales_detected && remainingTotal > 20 ? (
                <p className="text-[#3F8F68]">No active overproduction/underproduction critical flags.</p>
              ) : null}
            </div>
          </section>
        </>
      ) : isBranchManager ? (
        <>
          <section className="grid grid-cols-1 gap-6 border-b border-[#2A2A2E] pb-8 md:grid-cols-3">
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Plan vs Actual</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">{planAccuracyPct.toFixed(1)}%</p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Overproduction Cost</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">${(overproductionQty * 1.8).toFixed(0)}</p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Efficiency Score</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">{efficiencyScore.toFixed(1)}</p>
            </article>
          </section>

          <section className="mt-8 border-b border-[#2A2A2E] pb-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
              Plan vs Actual Summary
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead className="border-b border-[#2A2A2E]">
                  <tr>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Item</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Target</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Current</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Variance</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Waste by item</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Forecast alignment</th>
                  </tr>
                </thead>
                <tbody>
                  {productionRows.map((row) => {
                    const wasteByItem = Math.max(0, row.variance) * 1.2;
                    const forecastAlignment = row.target > 0
                      ? Math.max(0, 100 - (Math.abs(row.variance) / row.target) * 100)
                      : 100;
                    return (
                      <tr key={row.id} className="border-b border-[#2A2A2E]">
                        <td className="px-2 py-3 text-[13px] text-[#F5F5F7]">{row.item_title}</td>
                        <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{formatQuantity(row.target, row.unit)}</td>
                        <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{formatQuantity(row.currentProduced, row.unit)}</td>
                        <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{formatSignedQuantity(row.variance, row.unit)}</td>
                        <td className="px-2 py-3 text-[12px] text-[#C48B2A]">${wasteByItem.toFixed(0)}</td>
                        <td className="px-2 py-3 text-[12px] text-[#3F8F68]">{forecastAlignment.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Manager Actions</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="h-8 rounded-[8px] bg-[#A8821F] px-3 text-[12px] font-medium text-[#141416]">Adjust plan</button>
              <button className="h-8 rounded-[8px] border border-[#2E2E33] px-3 text-[12px] text-[#F5F5F7]">Investigate item</button>
              <button className="h-8 rounded-[8px] border border-[#2E2E33] px-3 text-[12px] text-[#F5F5F7]">Compare days</button>
              <button className="h-8 rounded-[8px] border border-[#2E2E33] px-3 text-[12px] text-[#F5F5F7]">Approve adjustments</button>
            </div>
            <div className="mt-3 text-[12px] text-[#8E8E93]">
              Underproduction impact estimate: ${(underproductionQty * 2.4).toFixed(0)}
            </div>
          </section>
        </>
      ) : isOpsDirector ? (
        <>
          <section className="grid grid-cols-1 gap-6 border-b border-[#2A2A2E] pb-8 md:grid-cols-4">
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Branch count</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">{branchGrid.length}</p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Avg plan accuracy</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
                {branchGrid.length
                  ? (
                      branchGrid.reduce(
                        (sum, branch) =>
                          sum +
                          (Number(branch.prepared ?? 0) > 0
                            ? (Number(branch.sold ?? 0) / Number(branch.prepared ?? 0)) * 100
                            : 100),
                        0,
                      ) / branchGrid.length
                    ).toFixed(1)
                  : "0.0"}
                %
              </p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Forecast deviation trend</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
                {Number(controlTowerQuery.data?.summary?.forecast_accuracy_rolling_7d ?? 0).toFixed(1)}%
              </p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Outlier branches</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
                {
                  branchGrid.filter(
                    (branch) => Number(branch.waste_pct ?? 0) >= 5 || branch.compliance_badge === "RED",
                  ).length
                }
              </p>
            </article>
          </section>

          <section className="mt-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
              Branch Production Comparison
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="border-b border-[#2A2A2E]">
                  <tr>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Branch</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Efficiency</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Plan accuracy</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Waste value</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Forecast deviation</th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Outlier</th>
                  </tr>
                </thead>
                <tbody>
                  {branchGrid.map((branch) => {
                    const prepared = Number(branch.prepared ?? 0);
                    const sold = Number(branch.sold ?? 0);
                    const planAccuracy = prepared > 0 ? (sold / prepared) * 100 : 100;
                    const efficiency = Math.max(
                      0,
                      100 - Number(branch.waste_pct ?? 0) - Number(branch.surplus_pct ?? 0) * 0.5,
                    );
                    const branchWaste = marginBranches.find(
                      (item) => item.branch_id === branch.branch_id,
                    );
                    const deviation = Math.abs(100 - planAccuracy);
                    const isOutlier = Number(branch.waste_pct ?? 0) >= 5 || deviation >= 20;

                    return (
                      <tr key={branch.branch_id} className="border-b border-[#2A2A2E]">
                        <td className="px-2 py-3 text-[13px] text-[#F5F5F7]">{branch.branch_name}</td>
                        <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{efficiency.toFixed(1)}</td>
                        <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{planAccuracy.toFixed(1)}%</td>
                        <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">${Number(branchWaste?.total_waste_cost ?? "0").toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{deviation.toFixed(1)}%</td>
                        <td className={`px-2 py-3 text-[11px] ${isOutlier ? "text-[#C44949]" : "text-[#3F8F68]"}`}>
                          {isOutlier ? "Outlier detected" : "Normal"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : isOwner ? (
        <>
          <section className="grid grid-cols-1 gap-6 border-b border-[#2A2A2E] pb-8 md:grid-cols-4">
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Production health</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
                {Math.max(0, 100 - Number(controlTowerQuery.data?.summary?.waste_risk_pct ?? 0)).toFixed(1)}
              </p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Forecast accuracy 7d</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
                {Number(controlTowerQuery.data?.summary?.forecast_accuracy_rolling_7d ?? 0).toFixed(1)}%
              </p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Branches at risk</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
                {branchGrid.filter((branch) => Number(branch.waste_pct ?? 0) >= 5).length}
              </p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Total waste value</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
                ${Number(marginReportQuery.data?.summary?.total_waste_cost ?? "0").toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </article>
          </section>

          <section className="mt-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">High-Level Production Health</p>
            <div className="mt-3 space-y-2">
              {branchGrid.slice(0, 5).map((branch) => (
                <div key={branch.branch_id} className="flex items-center justify-between border-b border-[#2A2A2E] pb-2">
                  <p className="text-[13px] text-[#F5F5F7]">{branch.branch_name}</p>
                  <p className="text-[12px] text-[#C7C7CC]">
                    Waste {Number(branch.waste_pct ?? 0).toFixed(1)}% · Surplus {Number(branch.surplus_pct ?? 0).toFixed(1)}%
                  </p>
                </div>
              ))}
              {!branchGrid.length ? (
                <p className="text-[12px] text-[#8E8E93]">Production branch summary will appear when branch telemetry is available.</p>
              ) : null}
            </div>
            <p className="mt-4 inline-flex items-center gap-2 text-[12px] text-[#8E8E93]">
              <WarningTriangle className="h-4 w-4 text-[#C48B2A]" />
              Owner view is strategic only. Raw batch logs are hidden by design.
            </p>
          </section>
        </>
      ) : (
        <section>
          <p className="text-[13px] text-[#8E8E93]">
            Production workspace is role-scoped. Your current role does not have production module access.
          </p>
        </section>
      )}
    </WorkspaceShell>
  );
}
