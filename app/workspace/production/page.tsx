"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useBranchDayToday,
  useSalesDataValidation,
} from "@/services";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

type LocalLog = {
  id: string;
  type: "BATCH" | "WASTE" | "ISSUE";
  itemTitle: string;
  quantity: number;
  unit: string;
  notes: string;
  timestamp: string;
};

type LiveItem = {
  id: string;
  title: string;
  unit: string;
  planned: number;
  prepared: number;
  sold: number;
  remaining: number;
  prepNowQty: number;
  runoutMinutes: number | null;
  stockoutRisk: "LOW" | "MEDIUM" | "HIGH";
  wasteRisk: "LOW" | "MEDIUM" | "HIGH";
  trend: number;
  alertLabel: string | null;
  startBatchNow: boolean;
  avgDemandLastHour: number | null;
};

const EMPTY_LIST: never[] = [];

function isDiscreteUnit(unit: string) {
  return ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes(
    (unit || "").toUpperCase(),
  );
}

function formatQuantity(value: number, unit: string) {
  if (Number.isNaN(value)) return `0 ${unit}`;
  if (isDiscreteUnit(unit)) {
    return `${Math.round(value)} ${unit}`;
  }
  return `${value.toFixed(2)} ${unit}`;
}

function formatDurationFrom(timestamp?: string) {
  if (!timestamp) return "--";
  const start = new Date(timestamp);
  if (Number.isNaN(start.getTime())) return "--";
  const diffMs = Date.now() - start.getTime();
  if (diffMs <= 0) return "0m";
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function formatShortTime(value: Date | null) {
  if (!value) return "--";
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  return `${Math.max(0, Math.round(value))}m`;
}

function riskRank(value: LiveItem["stockoutRisk"]) {
  if (value === "HIGH") return 0;
  if (value === "MEDIUM") return 1;
  return 2;
}

export default function ProductionPage() {
  const { data: user } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const role = user?.organization_role ?? "";
  const isStaffOperator = role === "STAFF_OPERATOR";
  const isBranchManager = role === "BRANCH_MANAGER" || role === "GM";
  const isOpsDirector = role === "OPS_DIRECTOR";
  const canViewProduction = isStaffOperator || isBranchManager || isOpsDirector;

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const branchOptions = useMemo(() => {
    const accessibleBranchIds = new Set(accessibleBranches.map((branch) => branch.id));
    const byId = new Map<string, { id: string; name: string; is_primary: boolean }>();
    for (const branch of branches) {
      byId.set(branch.id, {
        id: branch.id,
        name: branch.name,
        is_primary: Boolean(branch.is_primary),
      });
    }
    for (const branch of accessibleBranches) {
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
  }, [branches, accessibleBranches, isStaffOperator, isBranchManager]);

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

  const branchDayQuery = useBranchDayToday(
    { branch_id: activeBranchId, date: todayDate },
    Boolean(activeBranchId),
  );
  const salesValidationQuery = useSalesDataValidation({
    branch_id: activeBranchId,
    target_date: todayDate,
  });

  const branchDay = branchDayQuery.data;
  const liveItems = branchDay?.prep_plan_items ?? EMPTY_LIST;

  const enrichedItems = useMemo<LiveItem[]>(() => {
    return liveItems.map((item) => {
      const monitor = item.live_monitor ?? {};
      const riskEngine = monitor.risk_engine;
      const sold = Number(monitor.sold_today ?? 0);
      const planned = Number(
        monitor.planned_qty ?? item.final_quantity ?? item.suggested_quantity ?? 0,
      );
      const remaining = Number(
        monitor.remaining_qty ?? Math.max(0, planned - sold),
      );
      const prepNowQty = Number(
        monitor.should_prepare_more_qty ?? monitor.suggested_additional_qty ?? 0,
      );
      return {
        id: item.id,
        title: item.product_title,
        unit: item.unit,
        planned,
        prepared: Number(monitor.total_prepared_qty ?? 0),
        sold,
        remaining,
        prepNowQty,
        runoutMinutes: riskEngine?.runout_minutes ?? null,
        stockoutRisk: riskEngine?.stockout_risk ?? "LOW",
        wasteRisk: riskEngine?.waste_risk ?? "LOW",
        trend: Number(monitor.trend_vs_forecast_pct ?? 0),
        alertLabel: monitor.alert?.message ?? monitor.signal ?? null,
        startBatchNow: Boolean(riskEngine?.start_new_batch_now),
        avgDemandLastHour: riskEngine?.avg_demand_last_hour ?? null,
      };
    });
  }, [liveItems]);

  const totals = useMemo(() => {
    let totalSold = 0;
    let totalRemaining = 0;
    let totalPrepared = 0;
    let totalPlanned = 0;
    let trendSum = 0;
    let trendCount = 0;
    let demandLastHour = 0;
    let demandCount = 0;
    let prepNowCount = 0;
    let stockoutCount = 0;

    for (const item of enrichedItems) {
      totalSold += item.sold;
      totalRemaining += item.remaining;
      totalPrepared += item.prepared;
      totalPlanned += item.planned;
      if (!Number.isNaN(item.trend)) {
        trendSum += item.trend;
        trendCount += 1;
      }
      if (item.avgDemandLastHour !== null && !Number.isNaN(item.avgDemandLastHour)) {
        demandLastHour += item.avgDemandLastHour;
        demandCount += 1;
      }
      if (item.prepNowQty > 0 || item.startBatchNow) {
        prepNowCount += 1;
      }
      if (item.stockoutRisk === "HIGH") {
        stockoutCount += 1;
      }
    }

    return {
      totalSold,
      totalRemaining,
      totalPrepared,
      totalPlanned,
      avgTrend: trendCount ? trendSum / trendCount : 0,
      trendCount,
      totalDemandLastHour: demandLastHour,
      demandCount,
      prepNowCount,
      stockoutCount,
    };
  }, [enrichedItems]);

  const prepNowItems = useMemo(() => {
    return [...enrichedItems]
      .filter(
        (item) =>
          item.prepNowQty > 0 ||
          item.startBatchNow ||
          item.stockoutRisk === "HIGH" ||
          (item.runoutMinutes !== null && item.runoutMinutes <= 45),
      )
      .sort((a, b) => {
        const riskDelta = riskRank(a.stockoutRisk) - riskRank(b.stockoutRisk);
        if (riskDelta !== 0) return riskDelta;
        const runoutA = a.runoutMinutes ?? Number.POSITIVE_INFINITY;
        const runoutB = b.runoutMinutes ?? Number.POSITIVE_INFINITY;
        if (runoutA !== runoutB) return runoutA - runoutB;
        return b.prepNowQty - a.prepNowQty;
      })
      .slice(0, 6);
  }, [enrichedItems]);

  const queueItems = useMemo(() => {
    return [...enrichedItems]
      .sort((a, b) => {
        if (b.planned !== a.planned) return b.planned - a.planned;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 8);
  }, [enrichedItems]);

  const watchItems = useMemo(() => {
    return [...enrichedItems]
      .filter(
        (item) =>
          item.stockoutRisk === "HIGH" ||
          (item.runoutMinutes !== null && item.runoutMinutes <= 30),
      )
      .sort((a, b) => {
        const runoutA = a.runoutMinutes ?? Number.POSITIVE_INFINITY;
        const runoutB = b.runoutMinutes ?? Number.POSITIVE_INFINITY;
        if (runoutA !== runoutB) return runoutA - runoutB;
        return riskRank(a.stockoutRisk) - riskRank(b.stockoutRisk);
      })
      .slice(0, 5);
  }, [enrichedItems]);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [batchQuantity, setBatchQuantity] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [wasteReason, setWasteReason] = useState("NONE");
  const [localLogs, setLocalLogs] = useState<LocalLog[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const selectedItem = enrichedItems.find((item) => item.id === selectedItemId);

  useEffect(() => {
    if (branchDayQuery.data) {
      setLastSync(new Date());
    }
  }, [branchDayQuery.data]);

  useEffect(() => {
    if (!activeBranchId) return;
    const interval = setInterval(() => {
      branchDayQuery.refetch();
      salesValidationQuery.refetch();
    }, 15000);
    return () => clearInterval(interval);
  }, [activeBranchId, branchDayQuery, salesValidationQuery]);

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

  const status = branchDay?.status ?? "--";
  const statusTone =
    status === "LIVE"
      ? "border-[#1F3A2C] bg-[#0E1A14] text-[#5DD39E]"
      : status === "MORNING"
        ? "border-[#3A2D1F] bg-[#1E1610] text-[#E0B86B]"
        : "border-[#3A1F1F] bg-[#1A1010] text-[#E07070]";

  const timeOpen = status === "LIVE" ? formatDurationFrom(branchDay?.created_at) : "--";
  const timeOpenMs =
    status === "LIVE" && branchDay?.created_at
      ? Date.now() - new Date(branchDay.created_at).getTime()
      : 0;
  const timeOpenHours = timeOpenMs > 0 ? timeOpenMs / 3600000 : 0;
  const salesPerHour = timeOpenHours > 0 ? totals.totalSold / timeOpenHours : 0;

  if (!canViewProduction) {
    return (
      <WorkspaceShell
        eyebrow="Production"
        title="Production"
        description="Live kitchen operations are restricted to service roles."
        insight=""
      >
        <section className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
          <p className="text-[13px] text-[#8E8E93]">
            Production command center is limited to chef, line cook, supervisor, branch
            manager, and ops monitoring roles.
          </p>
        </section>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow="Production"
      title="Production"
      description="Live kitchen operations. Keep it fast, clear, and action-first."
      insight=""
    >
      <section className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
              Branch Context
            </label>
            <select
              value={activeBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="h-10 min-w-[220px] rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7]"
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
          <div className="flex items-center gap-4 text-[12px] text-[#8E8E93]">
            <span className="inline-flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  status === "LIVE" ? "bg-[#5DD39E]" : "bg-[#5C5C66]"
                }`}
              />
              {status === "LIVE" ? "Live feed" : "Live feed paused"}
            </span>
            <span>Last sync {formatShortTime(lastSync)}</span>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-[18px] border border-[#2A2A2E] bg-[#151518] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
              Live Service
            </p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {activeBranch?.name ?? "Select a branch"}
            </p>
          </div>
          <span
            className={`rounded-full border px-4 py-1 text-[12px] font-semibold tracking-[0.2em] ${statusTone}`}
          >
            {status}
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Time open</p>
            <p className="mt-1 font-display text-[26px] text-[#F5F5F7]">{timeOpen}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Orders processed</p>
            <p className="mt-1 font-display text-[26px] text-[#F5F5F7]">
              {Math.round(totals.totalSold).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Items remaining</p>
            <p className="mt-1 font-display text-[26px] text-[#F5F5F7]">
              {Math.round(totals.totalRemaining).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Prep now</p>
            <p className="mt-1 font-display text-[26px] text-[#F5F5F7]">
              {totals.prepNowCount}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">At risk</p>
            <p className="mt-1 font-display text-[26px] text-[#F5F5F7]">
              {totals.stockoutCount}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Sales per hour</p>
            <p className="mt-1 font-display text-[26px] text-[#F5F5F7]">
              {salesPerHour > 0 ? salesPerHour.toFixed(1) : "--"}
            </p>
          </div>
        </div>

        {salesValidationQuery.data?.missing_sales_detected ? (
          <div className="mt-5 rounded-[12px] border border-[#3A2D1F] bg-[#1C1610] px-4 py-3 text-[12px] text-[#E0B86B]">
            Sales feed is missing entries for some items. Verify POS sync or use manual
            entry.
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <article className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Prep now</p>
                <p className="mt-1 text-[14px] text-[#C7C7CC]">
                  Immediate actions for the line.
                </p>
              </div>
              <p className="text-[12px] text-[#8E8E93]">
                {prepNowItems.length} active alerts
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {prepNowItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#2A2A2E] bg-[#101012] px-4 py-3"
                >
                  <div>
                    <p className="text-[14px] text-[#F5F5F7]">{item.title}</p>
                    <p className="mt-1 text-[12px] text-[#8E8E93]">
                      Remaining {formatQuantity(item.remaining, item.unit)} · Runout {formatMinutes(item.runoutMinutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-[16px] font-semibold text-[#E0B86B]">
                      {item.prepNowQty > 0
                        ? `+${formatQuantity(item.prepNowQty, item.unit)}`
                        : "Check"}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemId(item.id);
                        const suggestedQty =
                          item.prepNowQty > 0 ? Math.round(item.prepNowQty) : 0;
                        setBatchQuantity(suggestedQty ? String(suggestedQty) : "");
                      }}
                      className="h-9 rounded-[10px] bg-[#E0B86B] px-3 text-[12px] font-semibold text-[#141416]"
                    >
                      Queue batch
                    </button>
                  </div>
                </div>
              ))}
              {!prepNowItems.length ? (
                <p className="text-[13px] text-[#8E8E93]">No immediate prep actions.</p>
              ) : null}
            </div>
          </article>

          <article className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Production queue</p>
                <p className="mt-1 text-[14px] text-[#C7C7CC]">What we are producing.</p>
              </div>
              <p className="text-[12px] text-[#8E8E93]">{queueItems.length} items</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {queueItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] px-4 py-3"
                >
                  <p className="text-[14px] text-[#F5F5F7]">{item.title}</p>
                  <div className="mt-2 grid grid-cols-3 gap-3 text-[12px] text-[#8E8E93]">
                    <div>
                      <p className="uppercase tracking-[0.12em]">Planned</p>
                      <p className="mt-1 text-[13px] text-[#C7C7CC]">
                        {formatQuantity(item.planned, item.unit)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em]">Sold</p>
                      <p className="mt-1 text-[13px] text-[#C7C7CC]">
                        {formatQuantity(item.sold, item.unit)}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.12em]">Remaining</p>
                      <p className="mt-1 text-[13px] text-[#C7C7CC]">
                        {formatQuantity(item.remaining, item.unit)}
                      </p>
                    </div>
                  </div>
                  {item.alertLabel ? (
                    <p className="mt-2 text-[12px] text-[#E0B86B]">{item.alertLabel}</p>
                  ) : null}
                </div>
              ))}
              {!queueItems.length ? (
                <p className="text-[13px] text-[#8E8E93]">No production items yet.</p>
              ) : null}
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Sales velocity</p>
            <p className="mt-1 text-[14px] text-[#C7C7CC]">How fast items are selling.</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Items sold</p>
                <p className="mt-1 font-display text-[24px] text-[#F5F5F7]">
                  {Math.round(totals.totalSold).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Avg trend</p>
                <p className="mt-1 font-display text-[24px] text-[#F5F5F7]">
                  {totals.trendCount ? `${totals.avgTrend.toFixed(1)}%` : "--"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Demand last hour</p>
                <p className="mt-1 font-display text-[24px] text-[#F5F5F7]">
                  {totals.demandCount ? totals.totalDemandLastHour.toFixed(1) : "--"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Planned today</p>
                <p className="mt-1 font-display text-[24px] text-[#F5F5F7]">
                  {Math.round(totals.totalPlanned).toLocaleString()}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Stockout watch</p>
            <p className="mt-1 text-[14px] text-[#C7C7CC]">Items most likely to run out.</p>
            <div className="mt-4 space-y-3">
              {watchItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] text-[#F5F5F7]">{item.title}</p>
                    <p className="mt-1 text-[12px] text-[#8E8E93]">
                      Runout {formatMinutes(item.runoutMinutes)} · Remaining {formatQuantity(item.remaining, item.unit)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${
                      item.stockoutRisk === "HIGH"
                        ? "border-[#3A1F1F] bg-[#1A1010] text-[#E07070]"
                        : "border-[#3A2D1F] bg-[#1E1610] text-[#E0B86B]"
                    }`}
                  >
                    {item.stockoutRisk}
                  </span>
                </div>
              ))}
              {!watchItems.length ? (
                <p className="text-[13px] text-[#8E8E93]">No stockout risks right now.</p>
              ) : null}
            </div>
          </article>

          <article className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Quick log</p>
            <p className="mt-1 text-[14px] text-[#C7C7CC]">Log batches, waste, or issues.</p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <select
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                className="h-10 rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7]"
              >
                <option value="">Select item</option>
                {enrichedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <input
                value={batchQuantity}
                onChange={(event) => setBatchQuantity(event.target.value)}
                placeholder="Quantity"
                className="h-10 rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7]"
              />
              <select
                value={wasteReason}
                onChange={(event) => setWasteReason(event.target.value)}
                className="h-10 rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7]"
              >
                <option value="NONE">Waste reason (optional)</option>
                <option value="EXPIRED">Expired</option>
                <option value="DAMAGED">Damaged</option>
                <option value="OVERPREP">Over-prep</option>
              </select>
              <input
                value={batchNotes}
                onChange={(event) => setBatchNotes(event.target.value)}
                placeholder="Notes"
                className="h-10 rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7]"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  submitLocalLog("BATCH", selectedItem?.title ?? "", selectedItem?.unit ?? "PCS")
                }
                className="h-10 rounded-[10px] bg-[#E0B86B] px-4 text-[12px] font-semibold text-[#141416]"
              >
                Log batch
              </button>
              <button
                type="button"
                onClick={() =>
                  submitLocalLog("WASTE", selectedItem?.title ?? "", selectedItem?.unit ?? "PCS")
                }
                className="h-10 rounded-[10px] border border-[#2E2E33] px-4 text-[12px] text-[#E0B86B]"
              >
                Report waste
              </button>
              <button
                type="button"
                onClick={() =>
                  submitLocalLog("ISSUE", selectedItem?.title ?? "", selectedItem?.unit ?? "PCS")
                }
                className="h-10 rounded-[10px] border border-[#2E2E33] px-4 text-[12px] text-[#E07070]"
              >
                Flag issue
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {localLogs.slice(0, 4).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between border-b border-[#2A2A2E] pb-2 text-[12px]"
                >
                  <p className="text-[#C7C7CC]">
                    {entry.type} · {entry.itemTitle} · {formatQuantity(entry.quantity, entry.unit)}
                  </p>
                  <p className="text-[#8E8E93]">{entry.timestamp}</p>
                </div>
              ))}
              {!localLogs.length ? (
                <p className="text-[12px] text-[#8E8E93]">No local logs yet.</p>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </WorkspaceShell>
  );
}
