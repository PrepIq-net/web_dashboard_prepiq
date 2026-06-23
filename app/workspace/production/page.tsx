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
import { Shop } from "iconoir-react";
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

function getTrendToneClasses(label: string) {
  if (label === "High")
    return "border-status-critical/30 bg-status-critical/10 text-status-critical";
  if (label === "Slow")
    return "border-status-warning/30 bg-status-warning/10 text-status-warning";
  return "border-status-success/30 bg-status-success/10 text-status-success";
}

function getPriority(item: LiveItem) {
  if (
    item.stockoutRisk === "HIGH" ||
    (item.runoutMinutes !== null && item.runoutMinutes <= 30)
  ) {
    return "High";
  }
  if (
    item.prepNowQty > 0 ||
    (item.runoutMinutes !== null && item.runoutMinutes <= 60)
  ) {
    return "Medium";
  }
  return "Low";
}

function getPriorityToneClasses(label: string) {
  if (label === "High")
    return "border-status-critical/30 bg-status-critical/10 text-status-critical";
  if (label === "Medium")
    return "border-status-warning/30 bg-status-warning/10 text-status-warning";
  return "border-status-success/30 bg-status-success/10 text-status-success";
}

function getStockoutAccentClass(risk: LiveItem["stockoutRisk"]) {
  if (risk === "HIGH") return "border-l-[3px] border-l-status-critical/60";
  if (risk === "MEDIUM") return "border-l-[3px] border-l-status-warning/50";
  return "border-l-[3px] border-l-transparent";
}

export default function ProductionPage() {
  const { data: user } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const permissions = resolvePermissions(user);
  const isStaffOperator =
    permissions.has(PERMISSIONS.CREATE_PRODUCTION_BATCH) &&
    !permissions.has(PERMISSIONS.VIEW_ANALYTICS);
  const isBranchManager = false;
  const canViewProduction =
    permissions.has(PERMISSIONS.VIEW_PRODUCTION_REPORTS) ||
    permissions.has(PERMISSIONS.CREATE_PRODUCTION_BATCH);

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const branchOptions = useMemo(() => {
    const accessibleBranchIds = new Set(
      accessibleBranches.map((branch) => branch.id),
    );
    const byId = new Map<
      string,
      { id: string; name: string; is_primary: boolean }
    >();
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
    if (
      !selectedBranchId ||
      !branchOptions.some((branch) => branch.id === selectedBranchId)
    ) {
      setSelectedBranchId(defaultBranchId);
    }
  }, [defaultBranchId, selectedBranchId, branchOptions]);

  const activeBranchId = selectedBranchId || defaultBranchId;
  const activeBranch =
    branchOptions.find((branch) => branch.id === activeBranchId) ?? null;
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
          item.live_monitor?.alert?.message ??
          item.live_monitor?.signal ??
          null,
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
    let prepNowCount = 0;
    let stockoutCount = 0;

    for (const item of enrichedItems) {
      totalSold += item.sold;
      totalRemaining += item.remaining;
      totalPrepared += item.prepared;
      totalPlanned += item.planned;
      if (item.prepNowQty > 0 || item.startBatchNow) prepNowCount += 1;
      if (item.stockoutRisk === "HIGH") stockoutCount += 1;
    }

    return {
      totalSold,
      totalRemaining,
      totalPrepared,
      totalPlanned,
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

  const prepQueueItems = useMemo(() => {
    const priorityRank = (label: string) =>
      label === "High" ? 0 : label === "Medium" ? 1 : 2;
    return [...enrichedItems].sort((a, b) => {
      const pa = getPriority(a);
      const pb = getPriority(b);
      if (pa !== pb) return priorityRank(pa) - priorityRank(pb);
      return b.prepNowQty - a.prepNowQty;
    });
  }, [enrichedItems]);

  const wasteSignals = useMemo(() => {
    return enrichedItems
      .filter((item) => item.wasteRisk === "HIGH" || item.trendPct <= -12)
      .sort((a, b) => a.trendPct - b.trendPct)
      .slice(0, 6);
  }, [enrichedItems]);

  // Items tab — sorted by stockout risk then remaining for ledger view
  const itemLedgerRows = useMemo(() => {
    return [...enrichedItems].sort((a, b) => {
      const riskDelta = riskRank(a.stockoutRisk) - riskRank(b.stockoutRisk);
      if (riskDelta !== 0) return riskDelta;
      return a.remaining - b.remaining;
    });
  }, [enrichedItems]);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [batchQuantity, setBatchQuantity] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [wasteReason, setWasteReason] = useState<WasteReason>("UNSPECIFIED");
  const [localLogs, setLocalLogs] = useState<LocalLog[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  type ProductionTab = "ITEMS" | "QUEUE" | "SIGNALS";
  const [activeTab, setActiveTab] = useState<ProductionTab>("ITEMS");

  const sectionTabs: { id: ProductionTab; label: string }[] = [
    { id: "ITEMS", label: "Items" },
    { id: "QUEUE", label: "Queue" },
    { id: "SIGNALS", label: "Signals" },
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
    if (!selectedItem || quantity <= 0 || createProductionLogMutation.isPending)
      return;
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
    } catch {
      setLocalLogs((prev) =>
        prev.map((entry) =>
          entry.id === logId ? { ...entry, status: "failed" } : entry,
        ),
      );
      setLogError("Unable to log production. Please retry.");
    }
  };

  const status = branchDay?.status ?? "--";
  const timeOpen =
    status === "LIVE" ? formatDurationFrom(branchDay?.created_at) : "--";
  const timeOpenMs =
    status === "LIVE" && branchDay?.created_at
      ? Date.now() - new Date(branchDay.created_at).getTime()
      : 0;
  const timeOpenHours = timeOpenMs > 0 ? timeOpenMs / 3600000 : 0;
  const salesPerHour =
    timeOpenHours > 0 ? totals.totalSold / timeOpenHours : 0;

  if (!canViewProduction) {
    return (
      <WorkspaceShell
        eyebrow="Production"
        title="Production"
        description="Live kitchen operations are restricted to service roles."
        insight=""
      >
        <p className="text-sm text-text-muted">
          Production command center is limited to chef, line cook, supervisor,
          branch manager, and ops monitoring roles.
        </p>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow="Production"
      title="Production Ledger"
      description="Execution view for live service. Every batch, every item, every shift."
      insight=""
    >
      {/* Slim context bar — matches Today's style */}
      <div className="mb-8 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-6">
        <div className="flex-1 min-w-[180px] max-w-xs">
          <Select
            label="Branch"
            leadingIcon={<Shop className="h-4 w-4" />}
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={activeBranchId}
            onChange={(value) => setSelectedBranchId(value)}
            placeholder={
              branchOptions.length ? "Select branch" : "No branches available"
            }
          />
        </div>

        <div className="flex items-center gap-2 pb-1">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "LIVE"
                ? "bg-status-success animate-pulse"
                : "bg-text-muted"
            }`}
          />
          <p className="text-sm text-text-muted">
            {status === "LIVE"
              ? "Service live"
              : status === "MORNING"
                ? "Planning mode"
                : status === "CLOSED"
                  ? "Day closed"
                  : "Not started"}
          </p>
        </div>

        <p className="pb-1 text-xs text-text-muted">
          Sync {formatShortTime(lastSync)}
        </p>
      </div>

      {/* Persistent KPI strip */}
      {enrichedItems.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {timeOpen !== "--" ? (
            <span className="text-text-muted">
              <span className="font-semibold text-text-primary">{timeOpen}</span>{" "}
              open
            </span>
          ) : null}
          <span className="text-text-muted">
            <span className="font-semibold text-text-primary">
              {Math.round(totals.totalSold).toLocaleString()}
            </span>{" "}
            sold
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-text-primary">
              {Math.round(totals.totalRemaining).toLocaleString()}
            </span>{" "}
            remaining
          </span>
          <span className="text-text-muted">
            <span
              className={`font-semibold ${totals.prepNowCount > 0 ? "text-status-warning" : "text-text-primary"}`}
            >
              {totals.prepNowCount}
            </span>{" "}
            need prep
          </span>
          <span className="text-text-muted">
            <span
              className={`font-semibold ${totals.stockoutCount > 0 ? "text-status-critical" : "text-text-primary"}`}
            >
              {totals.stockoutCount}
            </span>{" "}
            at risk
          </span>
          {salesPerHour > 0 ? (
            <span className="text-text-muted">
              <span className="font-semibold text-text-primary">
                {salesPerHour.toFixed(1)}
              </span>
              /hr
            </span>
          ) : null}
        </div>
      ) : null}

      {salesValidationQuery.data?.missing_sales_detected ? (
        <div className="mb-6 rounded-r-lg border-l-4 border-l-status-warning bg-status-warning/8 px-4 py-3 text-xs text-status-warning">
          Sales feed missing entries for some items. Verify POS sync or use
          manual entry.
        </div>
      ) : null}

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-surface-4/60">
        {sectionTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex h-10 items-center px-4 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-brand-gold text-brand-gold"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ITEMS tab — full production ledger */}
      {activeTab === "ITEMS" ? (
        <div className="space-y-8">
          {/* Urgent prep-now callouts */}
          {prepNowItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Needs prep now
              </p>
              {prepNowItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-r-lg border-l-4 px-4 py-3 ${
                    item.stockoutRisk === "HIGH"
                      ? "border-l-status-critical bg-status-critical/8"
                      : "border-l-status-warning bg-status-warning/8"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {formatQuantity(item.remaining, item.unit)} left ·
                      Runout {formatMinutes(item.runoutMinutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.prepNowQty > 0 ? (
                      <span
                        className={`text-sm font-semibold ${
                          item.stockoutRisk === "HIGH"
                            ? "text-status-critical"
                            : "text-status-warning"
                        }`}
                      >
                        +{formatQuantity(item.prepNowQty, item.unit)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemId(item.id);
                        const qty =
                          item.prepNowQty > 0 ? Math.round(item.prepNowQty) : 0;
                        setBatchQuantity(qty ? String(qty) : "");
                      }}
                      className="inline-flex h-8 items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/20 active:scale-[0.98]"
                    >
                      Log batch →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Full items ledger table */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  All Items
                </p>
                <h3 className="font-display text-xl font-semibold text-text-primary">
                  Production ledger
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {enrichedItems.length} items tracked this shift.
                </p>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 lg:block">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-surface-4/80 bg-surface-3/40">
                  <tr>
                    <th className="w-[220px] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Planned
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Prepared
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Sold
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Remaining
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Runout
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Trend
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4/50">
                  {itemLedgerRows.map((item) => {
                    const trendLabel = getTrendLabel(item.trendPct);
                    const isSelected = item.id === selectedItemId;
                    return (
                      <tr
                        key={item.id}
                        className={`align-middle transition-colors hover:bg-surface-3/20 ${getStockoutAccentClass(item.stockoutRisk)} ${
                          isSelected ? "bg-brand-gold/[0.04]" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-text-primary">
                            {item.title}
                          </p>
                          {item.alertLabel ? (
                            <p className="mt-0.5 text-[11px] text-status-warning">
                              {item.alertLabel}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {formatQuantity(item.planned, item.unit)}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {formatQuantity(item.prepared, item.unit)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-text-primary">
                          {formatQuantity(item.sold, item.unit)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-semibold ${
                              item.stockoutRisk === "HIGH"
                                ? "text-status-critical"
                                : item.stockoutRisk === "MEDIUM"
                                  ? "text-status-warning"
                                  : "text-text-primary"
                            }`}
                          >
                            {formatQuantity(item.remaining, item.unit)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm ${
                              item.runoutMinutes !== null &&
                              item.runoutMinutes <= 30
                                ? "font-semibold text-status-critical"
                                : item.runoutMinutes !== null &&
                                    item.runoutMinutes <= 60
                                  ? "font-medium text-status-warning"
                                  : "text-text-muted"
                            }`}
                          >
                            {formatMinutes(item.runoutMinutes)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${getTrendToneClasses(trendLabel)}`}
                          >
                            {trendLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              const qty =
                                item.prepNowQty > 0
                                  ? Math.round(item.prepNowQty)
                                  : 0;
                              setBatchQuantity(qty ? String(qty) : "");
                            }}
                            className="inline-flex h-7 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/50 hover:text-brand-gold active:scale-[0.98]"
                          >
                            Log
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!itemLedgerRows.length ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-text-muted">
                    No items tracked yet. Data populates once the service day is
                    initialized.
                  </p>
                </div>
              ) : null}
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 lg:hidden">
              {itemLedgerRows.map((item) => {
                const trendLabel = getTrendLabel(item.trendPct);
                return (
                  <article
                    key={item.id}
                    className={`overflow-hidden rounded-xl border bg-surface-2 ${
                      item.stockoutRisk === "HIGH"
                        ? "border-l-[3px] border-l-status-critical/60 border-status-critical/25"
                        : item.stockoutRisk === "MEDIUM"
                          ? "border-l-[3px] border-l-status-warning/50 border-status-warning/20"
                          : "border-surface-4"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 px-4 pt-4">
                      <p className="text-sm font-semibold text-text-primary">
                        {item.title}
                      </p>
                      <span
                        className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${getTrendToneClasses(trendLabel)}`}
                      >
                        {trendLabel}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 divide-x divide-surface-4/60 border-y border-surface-4/60">
                      <div className="px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          Prepared
                        </p>
                        <p className="mt-1 text-base font-semibold text-text-primary">
                          {Math.round(item.prepared)}
                        </p>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          Sold
                        </p>
                        <p className="mt-1 text-base font-semibold text-text-primary">
                          {Math.round(item.sold)}
                        </p>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          Remaining
                        </p>
                        <p
                          className={`mt-1 text-base font-semibold ${
                            item.stockoutRisk === "HIGH"
                              ? "text-status-critical"
                              : item.stockoutRisk === "MEDIUM"
                                ? "text-status-warning"
                                : "text-text-primary"
                          }`}
                        >
                          {Math.round(item.remaining)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <p className="text-xs text-text-muted">
                        Runout{" "}
                        <span
                          className={
                            item.runoutMinutes !== null &&
                            item.runoutMinutes <= 30
                              ? "font-semibold text-status-critical"
                              : "text-text-secondary"
                          }
                        >
                          {formatMinutes(item.runoutMinutes)}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          const qty =
                            item.prepNowQty > 0
                              ? Math.round(item.prepNowQty)
                              : 0;
                          setBatchQuantity(qty ? String(qty) : "");
                        }}
                        className="inline-flex h-7 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/50 hover:text-brand-gold"
                      >
                        Log
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Log form — always visible, pre-fills when item row is clicked */}
          <div className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Production Log
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              Record a batch or waste event
            </h3>
            {selectedItem ? (
              <p className="mt-1 text-sm text-text-secondary">
                Logging for:{" "}
                <span className="font-semibold text-text-primary">
                  {selectedItem.title}
                </span>{" "}
                ·{" "}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemId("");
                    setBatchQuantity("");
                  }}
                  className="text-text-muted hover:text-text-secondary transition-colors"
                >
                  Clear ×
                </button>
              </p>
            ) : (
              <p className="mt-1 text-sm text-text-muted">
                Select an item from the table above, or choose below.
              </p>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                placeholder={
                  selectedItem
                    ? selectedItem.prepNowQty > 0
                      ? `Suggested: ${Math.round(selectedItem.prepNowQty)}`
                      : "Quantity"
                    : "Quantity"
                }
                type="number"
                min={0}
                step={
                  selectedItem && isDiscreteUnit(selectedItem.unit) ? 1 : 0.01
                }
                className="h-10 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
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
                placeholder="Waste reason"
              />
              <input
                value={batchNotes}
                onChange={(event) => setBatchNotes(event.target.value)}
                placeholder="Notes (optional)"
                className="h-10 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => submitLocalLog("BATCH")}
                disabled={
                  !selectedItem || createProductionLogMutation.isPending
                }
                className="inline-flex h-10 items-center rounded-full bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-all duration-200 hover:bg-[#B8962E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createProductionLogMutation.isPending
                  ? "Logging..."
                  : "Log batch"}
              </button>
              <button
                type="button"
                onClick={() => submitLocalLog("WASTE")}
                disabled={
                  !selectedItem || createProductionLogMutation.isPending
                }
                className="inline-flex h-10 items-center rounded-full border border-surface-4 px-5 text-sm font-medium text-text-secondary transition-colors hover:border-status-warning/50 hover:text-status-warning active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Report waste
              </button>
            </div>
            {logError ? (
              <p className="mt-3 text-xs text-status-critical">{logError}</p>
            ) : null}

            {/* Recent logs */}
            {localLogs.length > 0 ? (
              <div className="mt-5 space-y-2 border-t border-surface-4/60 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  This session
                </p>
                {localLogs.slice(0, 5).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-text-secondary">
                        {entry.type}
                      </span>
                      <span className="mx-1.5 text-surface-4">·</span>
                      <span className="text-text-primary">{entry.itemTitle}</span>
                      <span className="mx-1.5 text-surface-4">·</span>
                      <span className="text-text-secondary">
                        {formatQuantity(entry.quantity, entry.unit)}
                      </span>
                      {entry.notes ? (
                        <span className="ml-2 text-text-muted">{entry.notes}</span>
                      ) : null}
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2 text-right">
                      <span className="text-text-muted">{entry.timestamp}</span>
                      <span
                        className={
                          entry.status === "failed"
                            ? "text-status-critical"
                            : entry.status === "pending"
                              ? "text-status-warning"
                              : "text-status-success"
                        }
                      >
                        {entry.status === "pending"
                          ? "Sending"
                          : entry.status === "failed"
                            ? "Failed"
                            : "✓"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* QUEUE tab — priority-sorted full list */}
      {activeTab === "QUEUE" ? (
        <div>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Prep Queue
            </p>
            <h3 className="font-display text-xl font-semibold text-text-primary">
              What to prepare next
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {prepQueueItems.length} items · sorted by urgency
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-surface-4 bg-surface-2">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-surface-4/80 bg-surface-3/40">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                    Remaining
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                    Prep needed
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                    Runout
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                    Priority
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-4/50">
                {prepQueueItems.map((item) => {
                  const priority = getPriority(item);
                  return (
                    <tr
                      key={item.id}
                      className={`align-middle transition-colors hover:bg-surface-3/20 ${getStockoutAccentClass(item.stockoutRisk)}`}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                        {item.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {formatQuantity(item.remaining, item.unit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {item.prepNowQty > 0
                          ? `+${formatQuantity(item.prepNowQty, item.unit)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm ${
                            item.runoutMinutes !== null &&
                            item.runoutMinutes <= 30
                              ? "font-semibold text-status-critical"
                              : item.runoutMinutes !== null &&
                                  item.runoutMinutes <= 60
                                ? "font-medium text-status-warning"
                                : "text-text-muted"
                          }`}
                        >
                          {formatMinutes(item.runoutMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${getPriorityToneClasses(priority)}`}
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
              <div className="py-12 text-center">
                <p className="text-sm text-text-muted">No prep queue items.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* SIGNALS tab — velocity + waste in one view */}
      {activeTab === "SIGNALS" ? (
        <div className="space-y-8">
          {/* Velocity */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Sales Velocity
            </p>
            <h3 className="font-display text-xl font-semibold text-text-primary">
              Actual demand vs forecast
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Top {velocityRows.length} items by volume
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-surface-4 bg-surface-2">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-surface-4/80 bg-surface-3/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Forecast
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Sold
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Remaining
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4/50">
                  {velocityRows.map((item) => {
                    const trendLabel = getTrendLabel(item.trendPct);
                    return (
                      <tr
                        key={item.id}
                        className="align-middle transition-colors hover:bg-surface-3/20"
                      >
                        <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                          {item.title}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {formatQuantity(item.forecast, item.unit)}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-primary">
                          {formatQuantity(item.sold, item.unit)}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {formatQuantity(item.remaining, item.unit)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${getTrendToneClasses(trendLabel)}`}
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
                <div className="py-12 text-center">
                  <p className="text-sm text-text-muted">
                    No velocity data yet.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Waste prevention */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Waste Prevention
            </p>
            <h3 className="font-display text-xl font-semibold text-text-primary">
              Demand slowing — adjust prep
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {wasteSignals.length} items trending below forecast
            </p>
            <div className="mt-4 space-y-2">
              {wasteSignals.map((item) => {
                const expectedDemandRemaining = Math.max(
                  0,
                  item.forecast - item.sold,
                );
                const overage = Math.max(
                  0,
                  Math.round(item.remaining - expectedDemandRemaining),
                );
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-r-lg border-l-4 border-l-status-warning/70 bg-status-warning/8 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        Demand slowing. Prep may exceed demand by{" "}
                        <span className="font-semibold text-status-warning">
                          {overage} {item.unit}
                        </span>
                        .
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-status-warning">
                      Slow production
                    </p>
                  </div>
                );
              })}
              {!wasteSignals.length ? (
                <p className="text-sm text-text-muted">
                  No waste prevention alerts.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
