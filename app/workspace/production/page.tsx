"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useBranchDayToday,
  useCreateProductionLog,
  useSalesDataValidation,
} from "@/services";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";

type LocalLog = {
  id: string;
  type: "BATCH" | "WASTE";
  itemTitle: string;
  quantity: number;
  unit: string;
  notes: string;
  timestamp: string;
  status: "pending" | "sent" | "failed";
};

type WasteReason =
  | "OVER_PREP"
  | "DEMAND_FLUCTUATION"
  | "CHEF_OVERRIDE"
  | "INVENTORY_EXPIRY"
  | "OTHER"
  | "UNSPECIFIED";

type LiveItem = {
  id: string;
  title: string;
  unit: string;
  forecast: number;
  planned: number;
  prepared: number;
  sold: number;
  remaining: number;
  prepNowQty: number;
  runoutMinutes: number | null;
  stockoutRisk: "LOW" | "MEDIUM" | "HIGH";
  wasteRisk: "LOW" | "MEDIUM" | "HIGH";
  trendPct: number;
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

function getTrendLabel(value: number) {
  if (value >= 12) return "High";
  if (value <= -12) return "Slow";
  return "Normal";
}

function getTrendTone(label: string) {
  if (label === "High") return "border-[#3A1F1F] bg-[#1A1010] text-[#E07070]";
  if (label === "Slow") return "border-[#3A2D1F] bg-[#1E1610] text-[#E0B86B]";
  return "border-[#1F3A2C] bg-[#0E1A14] text-[#5DD39E]";
}

function getPriority(item: LiveItem) {
  if (item.stockoutRisk === "HIGH" || (item.runoutMinutes !== null && item.runoutMinutes <= 30)) {
    return "High";
  }
  if (item.prepNowQty > 0 || (item.runoutMinutes !== null && item.runoutMinutes <= 60)) {
    return "Medium";
  }
  return "Low";
}

function getPriorityTone(label: string) {
  if (label === "High") return "border-[#3A1F1F] bg-[#1A1010] text-[#E07070]";
  if (label === "Medium") return "border-[#3A2D1F] bg-[#1E1610] text-[#E0B86B]";
  return "border-[#1F3A2C] bg-[#0E1A14] text-[#5DD39E]";
}

export default function ProductionPage() {
  const { data: user } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const permissions = resolvePermissions(user);
  const isOwner = permissions.has(PERMISSIONS.VIEW_FINANCIAL_DATA);
  const isOrgAdmin = permissions.has(PERMISSIONS.VIEW_ANALYTICS) && !permissions.has(PERMISSIONS.VIEW_FINANCIAL_DATA);
  const isStaffOperator = permissions.has(PERMISSIONS.CREATE_PRODUCTION_BATCH) && !permissions.has(PERMISSIONS.VIEW_ANALYTICS);
  const isBranchManager = false;
  const isOpsDirector = false;
  const canViewProduction =
    permissions.has(PERMISSIONS.VIEW_PRODUCTION_REPORTS) ||
    permissions.has(PERMISSIONS.CREATE_PRODUCTION_BATCH);

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
  const createProductionLogMutation = useCreateProductionLog();
  const salesValidationQuery = useSalesDataValidation({
    branch_id: activeBranchId,
    target_date: todayDate,
  });

  const branchDay = branchDayQuery.data;
  const liveItems = branchDay?.prep_plan_items ?? EMPTY_LIST;

  const enrichedItems = useMemo<LiveItem[]>(() => {
    return liveItems.map((item) => {
      const riskEngine = item.live_monitor?.risk_engine;
      const sold = Number(item.live_monitor?.sold_today ?? 0);
      const forecast = Number(
        item.forecast_qty ??
          item.forecast_context?.predicted_quantity_needed ??
          item.final_quantity ??
          item.suggested_quantity ??
          0,
      );
      const planned = Number(
        item.live_monitor?.planned_qty ??
          item.final_quantity ??
          item.suggested_quantity ??
          0,
      );
      const remaining = Number(
        item.live_monitor?.remaining_qty ?? Math.max(0, planned - sold),
      );
      const prepNowQty = Number(
        item.live_monitor?.should_prepare_more_qty ??
          item.live_monitor?.suggested_additional_qty ??
          0,
      );
      return {
        id: item.id,
        title: item.product_title,
        unit: item.unit,
        forecast,
        planned,
        prepared: Number(item.live_monitor?.total_prepared_qty ?? 0),
        sold,
        remaining,
        prepNowQty,
        runoutMinutes: riskEngine?.runout_minutes ?? null,
        stockoutRisk: riskEngine?.stockout_risk ?? "LOW",
        wasteRisk: riskEngine?.waste_risk ?? "LOW",
        trendPct: Number(item.live_monitor?.trend_vs_forecast_pct ?? 0),
        alertLabel:
          item.live_monitor?.alert?.message ?? item.live_monitor?.signal ?? null,
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
      if (!Number.isNaN(item.trendPct)) {
        trendSum += item.trendPct;
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

  const velocityRows = useMemo(() => {
    return [...enrichedItems]
      .sort((a, b) => {
        if (b.sold !== a.sold) return b.sold - a.sold;
        return b.forecast - a.forecast;
      })
      .slice(0, 10);
  }, [enrichedItems]);

  const stockAlerts = useMemo(() => {
    return enrichedItems
      .map((item) => {
        const runout = item.runoutMinutes;
        const stockoutRisk =
          item.stockoutRisk === "HIGH" || (runout !== null && runout <= 45);
        const highDemand = item.trendPct >= 15;
        if (!stockoutRisk && !highDemand) return null;

        const severity =
          item.stockoutRisk === "HIGH" || (runout !== null && runout <= 30)
            ? "HIGH"
            : "MEDIUM";
        const title = stockoutRisk ? "Stock risk alert" : "High demand detected";
        const message = stockoutRisk
          ? `Only ${formatQuantity(item.remaining, item.unit)} remaining`
          : `Selling ${Math.round(item.trendPct)}% faster than forecast`;
        const detail = stockoutRisk
          ? runout !== null
            ? `Estimated depletion in ${formatMinutes(runout)}`
            : "Estimated depletion soon"
          : `Forecast ${formatQuantity(item.forecast, item.unit)} · Sold ${formatQuantity(item.sold, item.unit)}`;
        let action = "Check line now";
        if (item.prepNowQty > 0) {
          action = `Prep +${formatQuantity(item.prepNowQty, item.unit)}`;
        } else if (item.startBatchNow) {
          action = "Start new batch now";
        }

        return {
          id: item.id,
          item: item.title,
          severity,
          title,
          message,
          detail,
          action,
          runoutMinutes: runout,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => {
        const severityRank = a.severity === "HIGH" ? 0 : 1;
        const severityRankB = b.severity === "HIGH" ? 0 : 1;
        if (severityRank !== severityRankB) return severityRank - severityRankB;
        const runoutA = a.runoutMinutes ?? Number.POSITIVE_INFINITY;
        const runoutB = b.runoutMinutes ?? Number.POSITIVE_INFINITY;
        return runoutA - runoutB;
      })
      .slice(0, 6);
  }, [enrichedItems]);

  const prepQueueItems = useMemo(() => {
    const priorityRank = (label: string) =>
      label === "High" ? 0 : label === "Medium" ? 1 : 2;
    return [...enrichedItems]
      .sort((a, b) => {
        const priorityA = getPriority(a);
        const priorityB = getPriority(b);
        if (priorityA !== priorityB) return priorityRank(priorityA) - priorityRank(priorityB);
        return b.prepNowQty - a.prepNowQty;
      })
      .slice(0, 8);
  }, [enrichedItems]);

  const wasteSignals = useMemo(() => {
    return enrichedItems
      .filter((item) => item.wasteRisk === "HIGH" || item.trendPct <= -12)
      .sort((a, b) => a.trendPct - b.trendPct)
      .slice(0, 6);
  }, [enrichedItems]);

  const productionCards = useMemo(() => {
    return [...enrichedItems]
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 6);
  }, [enrichedItems]);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [batchQuantity, setBatchQuantity] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [wasteReason, setWasteReason] = useState<WasteReason>("UNSPECIFIED");
  const [localLogs, setLocalLogs] = useState<LocalLog[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  type ProductionTab =
    | "SERVICE"
    | "ACTIONS"
    | "VELOCITY"
    | "ALERTS"
    | "QUEUE"
    | "WASTE"
    | "CARDS";

  const [activeTab, setActiveTab] = useState<ProductionTab>("SERVICE");

  const sectionTabs: { id: ProductionTab; label: string }[] = [
    { id: "SERVICE", label: "Service" },
    { id: "ACTIONS", label: "Prep Actions" },
    { id: "VELOCITY", label: "Velocity" },
    { id: "ALERTS", label: "Stock Alerts" },
    { id: "QUEUE", label: "Prep Queue" },
    { id: "WASTE", label: "Waste Signals" },
    { id: "CARDS", label: "Cards" },
  ];

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

  const submitLocalLog = async (type: LocalLog["type"]) => {
    const quantity = Number(batchQuantity || 0);
    if (!selectedItem || quantity <= 0 || createProductionLogMutation.isPending) return;
    const normalizedQty = isDiscreteUnit(selectedItem.unit)
      ? Math.round(quantity)
      : quantity;
    if (normalizedQty <= 0) return;

    const noteParts: string[] = [];
    if (type === "WASTE" && wasteReason !== "UNSPECIFIED") {
      const reasonLabel =
        wasteReason === "OVER_PREP"
          ? "Over-prep"
          : wasteReason === "DEMAND_FLUCTUATION"
            ? "Demand fluctuation"
            : wasteReason === "CHEF_OVERRIDE"
              ? "Chef override"
              : wasteReason === "INVENTORY_EXPIRY"
                ? "Inventory expiry"
                : "Other";
      noteParts.push(`Waste reason: ${reasonLabel}.`);
    }
    if (batchNotes.trim()) {
      noteParts.push(batchNotes.trim());
    }
    const reason = noteParts.join(" ").slice(0, 120);

    const logId = crypto.randomUUID();
    setLogError(null);
    setLocalLogs((prev) => [
      {
        id: logId,
        type,
        itemTitle: selectedItem.title,
        quantity: normalizedQty,
        unit: selectedItem.unit,
        notes: reason,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: "pending",
      },
      ...prev,
    ]);

    setBatchQuantity("");
    setBatchNotes("");
    setWasteReason("UNSPECIFIED");

    try {
      await createProductionLogMutation.mutateAsync({
        prep_plan_item_id: selectedItem.id,
        quantity_produced: type === "BATCH" ? normalizedQty : 0,
        waste_quantity: type === "WASTE" ? normalizedQty : 0,
        event_type: "additional",
        waste_reason: type === "WASTE" ? wasteReason : undefined,
        reason,
      });
      branchDayQuery.refetch();
      setLocalLogs((prev) =>
        prev.map((entry) =>
          entry.id === logId ? { ...entry, status: "sent" } : entry,
        ),
      );
    } catch (error) {
      setLocalLogs((prev) =>
        prev.map((entry) =>
          entry.id === logId ? { ...entry, status: "failed" } : entry,
        ),
      );
      setLogError("Unable to log production. Please retry.");
    }
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
            <Select
              label="Branch Context"
              options={branchOptions.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              value={activeBranchId}
              onChange={(value) => setSelectedBranchId(value)}
              placeholder={branchOptions.length ? "Select branch" : "No branches available"}
              className="min-w-[240px]"
            />
            {activeBranch ? (
              <p className="text-[13px] text-[#8E8E93]">
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

      <section className="mb-6 rounded-[14px] border border-[#2A2A2E] bg-[#121216] px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {sectionTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-brand-gold/20 text-brand-gold border border-brand-gold/40 shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "SERVICE" ? (
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
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">Time open</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">{timeOpen}</p>
          </div>
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">Orders processed</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {Math.round(totals.totalSold).toLocaleString()}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">Items remaining</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {Math.round(totals.totalRemaining).toLocaleString()}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">Prep now</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {totals.prepNowCount}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">At risk</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {totals.stockoutCount}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">Sales per hour</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
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
      ) : null}

      {activeTab === "ACTIONS" ? (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <article className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">Prep now</p>
                <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">
                  Immediate actions for the line.
                </p>
              </div>
              <p className="text-[12px] text-[#8E8E93]">{prepNowItems.length} active alerts</p>
            </div>
            <div className="mt-4 space-y-3">
              {prepNowItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#2A2A2E] bg-[#101012] px-4 py-3"
                >
                  <div>
                    <p className="text-[16px] font-semibold text-[#F5F5F7]">{item.title}</p>
                    <p className="mt-1 text-[13px] text-[#8E8E93]">
                      Remaining {formatQuantity(item.remaining, item.unit)} · Runout {formatMinutes(item.runoutMinutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-[18px] font-semibold text-[#E0B86B]">
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
            <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">Quick log</p>
            <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">Log batches and waste in real time.</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                options={[
                  { value: "", label: "Select item" },
                  ...enrichedItems.map((item) => ({
                    value: item.id,
                    label: item.title,
                  })),
                ]}
                value={selectedItemId}
                onChange={(value) => setSelectedItemId(value)}
                placeholder="Select item"
              />
              <input
                value={batchQuantity}
                onChange={(event) => setBatchQuantity(event.target.value)}
                placeholder="Quantity"
                className="h-10 rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7]"
              />
              <Select
                options={[
                  { value: "UNSPECIFIED", label: "Waste reason (optional)" },
                  { value: "OVER_PREP", label: "Over-prep" },
                  { value: "DEMAND_FLUCTUATION", label: "Demand fluctuation" },
                  { value: "CHEF_OVERRIDE", label: "Chef override" },
                  { value: "INVENTORY_EXPIRY", label: "Inventory expiry" },
                  { value: "OTHER", label: "Other" },
                ]}
                value={wasteReason}
                onChange={(value) => setWasteReason(value as WasteReason)}
                placeholder="Select waste reason"
              />
              <input
                value={batchNotes}
                onChange={(event) => setBatchNotes(event.target.value)}
                placeholder="Notes"
                className="h-10 rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7] md:col-span-2"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => submitLocalLog("BATCH")}
                disabled={!selectedItem || createProductionLogMutation.isPending}
                className="h-10 rounded-[10px] bg-[#E0B86B] px-4 text-[12px] font-semibold text-[#141416] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createProductionLogMutation.isPending ? "Logging..." : "Log batch"}
              </button>
              <button
                type="button"
                onClick={() => submitLocalLog("WASTE")}
                disabled={!selectedItem || createProductionLogMutation.isPending}
                className="h-10 rounded-[10px] border border-[#2E2E33] px-4 text-[12px] text-[#E0B86B] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Report waste
              </button>
            </div>
            {logError ? (
              <p className="mt-3 text-[12px] text-[#E07070]">{logError}</p>
            ) : null}

            <div className="mt-4 space-y-2">
              {localLogs.slice(0, 4).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between border-b border-[#2A2A2E] pb-2 text-[12px]"
                >
                  <div>
                    <p className="text-[#C7C7CC]">
                      {entry.type} · {entry.itemTitle} · {formatQuantity(entry.quantity, entry.unit)}
                    </p>
                    {entry.notes ? (
                      <p className="mt-1 text-[11px] text-[#8E8E93]">{entry.notes}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-[#8E8E93]">{entry.timestamp}</p>
                    <p
                      className={`text-[11px] ${
                        entry.status === "failed"
                          ? "text-[#E07070]"
                          : entry.status === "pending"
                            ? "text-[#E0B86B]"
                            : "text-[#5DD39E]"
                      }`}
                    >
                      {entry.status === "pending"
                        ? "Sending"
                        : entry.status === "failed"
                          ? "Failed"
                          : "Sent"}
                    </p>
                  </div>
                </div>
              ))}
              {!localLogs.length ? (
                <p className="text-[12px] text-[#8E8E93]">No logs yet.</p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "VELOCITY" ? (
        <section className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">Live sales velocity</p>
              <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">
                Actual demand vs forecast.
              </p>
            </div>
            <p className="text-[12px] text-[#8E8E93]">{velocityRows.length} items</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-[#2A2A2E]">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Item</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Forecast</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Sold</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Remaining</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Trend</th>
                </tr>
              </thead>
              <tbody>
                {velocityRows.map((item) => {
                  const trendLabel = getTrendLabel(item.trendPct);
                  return (
                    <tr key={item.id} className="border-b border-[#2A2A2E] odd:bg-[#141418]">
                      <td className="px-2 py-3 text-[14px] text-[#F5F5F7]">{item.title}</td>
                      <td className="px-2 py-3 text-[13px] text-[#C7C7CC]">
                        {formatQuantity(item.forecast, item.unit)}
                      </td>
                      <td className="px-2 py-3 text-[13px] text-[#C7C7CC]">
                        {formatQuantity(item.sold, item.unit)}
                      </td>
                      <td className="px-2 py-3 text-[13px] text-[#C7C7CC]">
                        {formatQuantity(item.remaining, item.unit)}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${getTrendTone(trendLabel)}`}
                        >
                          {trendLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!velocityRows.length ? (
              <p className="mt-4 text-[13px] text-[#8E8E93]">No live velocity data yet.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "ALERTS" ? (
        <section className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">Stock risk alerts</p>
          <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">Immediate depletion risk.</p>
          <div className="mt-4 space-y-3">
            {stockAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[14px] text-[#F5F5F7]">{alert.item}</p>
                  <span
                    className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${
                      alert.severity === "HIGH"
                        ? "border-[#3A1F1F] bg-[#1A1010] text-[#E07070]"
                        : "border-[#3A2D1F] bg-[#1E1610] text-[#E0B86B]"
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  {alert.title}
                </p>
                <p className="mt-2 text-[12px] text-[#E0B86B]">{alert.message}</p>
                <p className="mt-1 text-[12px] text-[#8E8E93]">{alert.detail}</p>
                <p className="mt-2 text-[12px] font-semibold text-[#F5F5F7]">
                  Suggested action: {alert.action}
                </p>
              </div>
            ))}
            {!stockAlerts.length ? (
              <p className="text-[13px] text-[#8E8E93]">No stock risk alerts right now.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "QUEUE" ? (
        <section className="mt-6 rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">Prep queue</p>
            <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">What needs to be prepared next.</p>
          </div>
          <p className="text-[12px] text-[#8E8E93]">{prepQueueItems.length} items</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-[#2A2A2E]">
              <tr>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Item</th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Remaining</th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Prep needed</th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Priority</th>
              </tr>
            </thead>
            <tbody>
              {prepQueueItems.map((item) => {
                const priority = getPriority(item);
                return (
                  <tr key={item.id} className="border-b border-[#2A2A2E] odd:bg-[#141418]">
                    <td className="px-2 py-3 text-[14px] text-[#F5F5F7]">{item.title}</td>
                    <td className="px-2 py-3 text-[13px] text-[#C7C7CC]">
                      {formatQuantity(item.remaining, item.unit)}
                    </td>
                    <td className="px-2 py-3 text-[13px] text-[#C7C7CC]">
                      {item.prepNowQty > 0
                        ? `+${formatQuantity(item.prepNowQty, item.unit)}`
                        : "0"}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${getPriorityTone(priority)}`}
                      >
                        {priority}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!prepQueueItems.length ? (
            <p className="mt-4 text-[13px] text-[#8E8E93]">No prep queue items.</p>
          ) : null}
        </div>
        </section>
      ) : null}

      {activeTab === "WASTE" ? (
        <section className="mt-6 rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">Waste prevention signals</p>
            <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">Demand is slowing. Adjust prep.</p>
          </div>
          <p className="text-[12px] text-[#8E8E93]">{wasteSignals.length} alerts</p>
        </div>
        <div className="mt-4 space-y-3">
          {wasteSignals.map((item) => {
            const expectedDemandRemaining = Math.max(0, item.forecast - item.sold);
            const overage = Math.max(0, Math.round(item.remaining - expectedDemandRemaining));
            return (
              <div
                key={item.id}
                className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] px-4 py-3"
              >
                <p className="text-[14px] text-[#F5F5F7]">{item.title}</p>
                <p className="mt-1 text-[12px] text-[#E0B86B]">
                  Demand slowing. Current prep may exceed demand by {overage} {item.unit}.
                </p>
                <p className="mt-2 text-[12px] font-semibold text-[#F5F5F7]">
                  Suggested action: Slow production.
                </p>
              </div>
            );
          })}
          {!wasteSignals.length ? (
            <p className="text-[13px] text-[#8E8E93]">No waste prevention alerts.</p>
          ) : null}
        </div>
        </section>
      ) : null}

      {activeTab === "CARDS" ? (
        <section className="mt-6 rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">Item production cards</p>
            <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">Large cards for kitchen screens.</p>
          </div>
          <p className="text-[12px] text-[#8E8E93]">{productionCards.length} items</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {productionCards.map((item) => {
            const trendLabel = getTrendLabel(item.trendPct);
            return (
              <div
                key={item.id}
                className="rounded-[14px] border border-[#2A2A2E] bg-[#101012] p-4"
              >
                <p className="text-[15px] text-[#F5F5F7]">{item.title}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Forecast</p>
                <p className="mt-1 text-[20px] font-semibold text-[#F5F5F7]">
                      {formatQuantity(item.forecast, item.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Sold</p>
                <p className="mt-1 text-[20px] font-semibold text-[#F5F5F7]">
                      {formatQuantity(item.sold, item.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Remaining</p>
                <p className="mt-1 text-[20px] font-semibold text-[#F5F5F7]">
                      {formatQuantity(item.remaining, item.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Status</p>
                <p className="mt-1 text-[20px] font-semibold text-[#F5F5F7]">
                      {trendLabel}
                    </p>
                  </div>
                </div>
                {item.prepNowQty > 0 ? (
                  <p className="mt-3 text-[12px] text-[#E0B86B]">
                    Prep recommended: +{formatQuantity(item.prepNowQty, item.unit)}
                  </p>
                ) : null}
              </div>
            );
          })}
          {!productionCards.length ? (
            <p className="text-[13px] text-[#8E8E93]">No production cards yet.</p>
          ) : null}
        </div>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}
