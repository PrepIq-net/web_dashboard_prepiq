"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useBranchDayToday,
  useCreateProductionLog,
  useSalesDataValidation,
} from "@/services";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

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

function getTrendLabel(value: number, t: (key: string) => string) {
  if (value >= 12) return t("dashboard.home.busy");
  if (value <= -12) return t("dashboard.home.quiet");
  return t("workspace.today.outlook.normal");
}

function getTrendTone(label: string, t: (key: string) => string) {
  if (label === t("dashboard.home.busy"))
    return "border-[#3A1F1F] bg-[#1A1010] text-[#E07070]";
  if (label === t("dashboard.home.quiet"))
    return "border-[#3A2D1F] bg-[#1E1610] text-[#E0B86B]";
  return "border-[#1F3A2C] bg-[#0E1A14] text-[#5DD39E]";
}

function getPriority(item: LiveItem, t: (key: string) => string) {
  if (
    item.stockoutRisk === "HIGH" ||
    (item.runoutMinutes !== null && item.runoutMinutes <= 30)
  ) {
    return t("dashboard.home.highPriority");
  }
  if (
    item.prepNowQty > 0 ||
    (item.runoutMinutes !== null && item.runoutMinutes <= 60)
  ) {
    return t("dashboard.home.medPriority");
  }
  return t("dashboard.home.lowRisk");
}

function getPriorityTone(label: string, t: (key: string) => string) {
  if (label === t("dashboard.home.highPriority"))
    return "border-[#3A1F1F] bg-[#1A1010] text-[#E07070]";
  if (label === t("dashboard.home.medPriority"))
    return "border-[#3A2D1F] bg-[#1E1610] text-[#E0B86B]";
  return "border-[#1F3A2C] bg-[#0E1A14] text-[#5DD39E]";
}

export default function ProductionPage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const role = user?.organization_role ?? "";
  const isOwner = role === "ORG_OWNER";
  const isOrgAdmin = role === "ORG_ADMIN";
  const isStaffOperator = role === "STAFF_OPERATOR";
  const isBranchManager = role === "BRANCH_MANAGER" || role === "GM";
  const isOpsDirector = role === "OPS_DIRECTOR";
  const canViewProduction =
    isOwner || isOrgAdmin || isStaffOperator || isBranchManager || isOpsDirector;

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
        const title = stockoutRisk
          ? t("workspace.production.alerts.stockRisk")
          : t("workspace.production.alerts.highDemand");
        const message = stockoutRisk
          ? t("workspace.production.alerts.remainingDesc", {
              quantity: formatQuantity(item.remaining, item.unit),
            })
          : t("workspace.production.alerts.sellingFaster", {
              percent: Math.round(item.trendPct),
            });
        const detail = stockoutRisk
          ? runout !== null
            ? t("workspace.production.alerts.depletionIn", {
                time: formatMinutes(runout),
              })
            : t("workspace.production.alerts.depletionSoon")
          : t("workspace.production.alerts.forecastSold", {
              forecast: formatQuantity(item.forecast, item.unit),
              sold: formatQuantity(item.sold, item.unit),
            });
        let action = t("workspace.production.alerts.checkLine");
        if (item.prepNowQty > 0) {
          action = t("workspace.production.alerts.prepMore", {
            quantity: formatQuantity(item.prepNowQty, item.unit),
          });
        } else if (item.startBatchNow) {
          action = t("workspace.production.alerts.startBatch");
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
    const priorityRank = (label: string) => {
      if (label === t("dashboard.home.highPriority")) return 0;
      if (label === t("dashboard.home.medPriority")) return 1;
      return 2;
    };
    return [...enrichedItems]
      .sort((a, b) => {
        const priorityA = getPriority(a, t);
        const priorityB = getPriority(b, t);
        if (priorityA !== priorityB)
          return priorityRank(priorityA) - priorityRank(priorityB);
        return b.prepNowQty - a.prepNowQty;
      })
      .slice(0, 8);
  }, [enrichedItems, t]);

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
    { id: "SERVICE", label: t("workspace.production.tabs.service") },
    { id: "ACTIONS", label: t("workspace.production.tabs.actions") },
    { id: "VELOCITY", label: t("workspace.production.tabs.velocity") },
    { id: "ALERTS", label: t("workspace.production.tabs.alerts") },
    { id: "QUEUE", label: t("workspace.production.tabs.queue") },
    { id: "WASTE", label: t("workspace.production.tabs.waste") },
    { id: "CARDS", label: t("workspace.production.tabs.cards") },
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
          ? t("workspace.production.actions.overprep")
          : wasteReason === "DEMAND_FLUCTUATION"
            ? t("workspace.production.actions.demandFluctuation")
            : wasteReason === "CHEF_OVERRIDE"
              ? t("workspace.production.actions.chefOverride")
              : wasteReason === "INVENTORY_EXPIRY"
                ? t("workspace.production.actions.inventoryExpiry")
                : t("workspace.production.actions.other");
      noteParts.push(`${t("workspace.production.actions.wasteReason")}: ${reasonLabel}.`);
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
      setLogError(t("setup.common.error"));
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
        eyebrow={t("workspace.production.eyebrow")}
        title={t("workspace.production.title")}
        description={t("workspace.production.restrictedDesc")}
        insight=""
      >
        <section className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
          <p className="text-[13px] text-[#8E8E93]">
            {t("workspace.production.restrictedDetail")}
          </p>
        </section>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow={t("workspace.production.eyebrow")}
      title={t("workspace.production.title")}
      description={t("workspace.production.description")}
      insight=""
    >
      <section className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              {t("workspace.production.branchContext")}
            </label>
            <select
              value={activeBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="h-11 min-w-[240px] rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[14px] text-[#F5F5F7]"
            >
              {!branchOptions.length ? (
                <option value="">{t("workspace.common.noBranches")}</option>
              ) : null}
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            {activeBranch ? (
              <p className="text-[13px] text-[#8E8E93]">
                {t("financial.branchView", { name: activeBranch.name })}
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
              {status === "LIVE" ? t("workspace.production.liveFeed") : t("workspace.production.liveFeedPaused")}
            </span>
            <span>{t("workspace.production.lastSync", { time: formatShortTime(lastSync) })}</span>
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
              {t("workspace.today.status.live")}
            </p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {activeBranch?.name ?? t("workspace.common.selectBranch")}
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
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">{t("workspace.production.service.timeOpen")}</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">{timeOpen}</p>
          </div>
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">{t("workspace.production.service.ordersProcessed")}</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {Math.round(totals.totalSold).toLocaleString()}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">{t("workspace.production.service.itemsRemaining")}</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {Math.round(totals.totalRemaining).toLocaleString()}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">{t("workspace.production.service.prepNow")}</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {totals.prepNowCount}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">{t("workspace.production.service.atRisk")}</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {totals.stockoutCount}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#2A2A2E] bg-[#101012] p-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8E8E93]">{t("workspace.production.service.salesPerHour")}</p>
            <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
              {salesPerHour > 0 ? salesPerHour.toFixed(1) : "--"}
            </p>
          </div>
        </div>

        {salesValidationQuery.data?.missing_sales_detected ? (
          <div className="mt-5 rounded-[12px] border border-[#3A2D1F] bg-[#1C1610] px-4 py-3 text-[12px] text-[#E0B86B]">
            {t("workspace.production.service.missingSales")}
          </div>
        ) : null}
      </section>
      ) : null}

      {activeTab === "ACTIONS" ? (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <article className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.service.prepNow")}</p>
                <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">
                  {t("workspace.production.actions.immediateActions")}
                </p>
              </div>
              <p className="text-[12px] text-[#8E8E93]">{t("workspace.production.actions.activeAlerts", { count: prepNowItems.length })}</p>
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
                      {t("workspace.production.velocity.remaining")} {formatQuantity(item.remaining, item.unit)} · {t("workspace.today.live.mayRunOut", { minutes: formatMinutes(item.runoutMinutes) })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-[18px] font-semibold text-[#E0B86B]">
                      {item.prepNowQty > 0
                        ? `+${formatQuantity(item.prepNowQty, item.unit)}`
                        : t("workspace.production.actions.check")}
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
                      {t("workspace.production.actions.queueBatch")}
                    </button>
                  </div>
                </div>
              ))}
              {!prepNowItems.length ? (
                <p className="text-[13px] text-[#8E8E93]">{t("workspace.production.actions.noActions")}</p>
              ) : null}
            </div>
          </article>

          <article className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
            <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.actions.quickLog")}</p>
            <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">{t("workspace.production.actions.quickLogDesc")}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                className="h-10 rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7]"
              >
                <option value="">{t("workspace.production.actions.selectItem")}</option>
                {enrichedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <input
                value={batchQuantity}
                onChange={(event) => setBatchQuantity(event.target.value)}
                placeholder={t("workspace.production.actions.quantity")}
                className="h-10 rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7]"
              />
              <select
                value={wasteReason}
                onChange={(event) => setWasteReason(event.target.value as WasteReason)}
                className="h-10 rounded-[10px] border border-[#2E2E33] bg-[#1C1C1F] px-3 text-[13px] text-[#F5F5F7]"
              >
                <option value="UNSPECIFIED">{t("workspace.production.actions.wasteReason")}</option>
                <option value="OVER_PREP">{t("workspace.production.actions.overprep")}</option>
                <option value="DEMAND_FLUCTUATION">{t("workspace.production.actions.demandFluctuation")}</option>
                <option value="CHEF_OVERRIDE">{t("workspace.production.actions.chefOverride")}</option>
                <option value="INVENTORY_EXPIRY">{t("workspace.production.actions.inventoryExpiry")}</option>
                <option value="OTHER">{t("workspace.production.actions.other")}</option>
              </select>
              <input
                value={batchNotes}
                onChange={(event) => setBatchNotes(event.target.value)}
                placeholder={t("workspace.production.actions.notes")}
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
                {createProductionLogMutation.isPending ? t("workspace.production.actions.logging") : t("workspace.production.actions.logBatch")}
              </button>
              <button
                type="button"
                onClick={() => submitLocalLog("WASTE")}
                disabled={!selectedItem || createProductionLogMutation.isPending}
                className="h-10 rounded-[10px] border border-[#2E2E33] px-4 text-[12px] text-[#E0B86B] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("workspace.production.actions.reportWaste")}
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
                      {entry.type === "BATCH" ? t("workspace.production.actions.logBatch") : t("workspace.production.actions.reportWaste")} · {entry.itemTitle} · {formatQuantity(entry.quantity, entry.unit)}
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
                        ? t("workspace.production.actions.sending")
                        : entry.status === "failed"
                          ? t("workspace.production.actions.failed")
                          : t("workspace.production.actions.sent")}
                    </p>
                  </div>
                </div>
              ))}
              {!localLogs.length ? (
                <p className="text-[12px] text-[#8E8E93]">{t("workspace.production.actions.noLogs")}</p>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "VELOCITY" ? (
        <section className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.velocity.title")}</p>
              <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">
                {t("workspace.production.velocity.description")}
              </p>
            </div>
            <p className="text-[12px] text-[#8E8E93]">{t("workspace.production.velocity.items", { count: velocityRows.length })}</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-[#2A2A2E]">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.queue.item")}</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.velocity.forecast")}</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.queue.sold")}</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.velocity.remaining")}</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    {t("workspace.production.velocity.trend")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {velocityRows.map((item) => {
                  const trendLabel = getTrendLabel(item.trendPct, t);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[#2A2A2E] odd:bg-[#141418]"
                    >
                      <td className="px-2 py-3 text-[14px] text-[#F5F5F7]">
                        {item.title}
                      </td>
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
                          className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${getTrendTone(trendLabel, t)}`}
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
              <p className="mt-4 text-[13px] text-[#8E8E93]">{t("workspace.production.velocity.noData")}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "ALERTS" ? (
        <section className="rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.alerts.title")}</p>
          <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">{t("workspace.production.alerts.description")}</p>
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
                  {t("workspace.today.context.suggested")} {alert.action}
                </p>
              </div>
            ))}
            {!stockAlerts.length ? (
              <p className="text-[13px] text-[#8E8E93]">{t("workspace.production.alerts.noAlerts")}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "QUEUE" ? (
        <section className="mt-6 rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.queue.title")}</p>
            <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">{t("workspace.production.queue.description")}</p>
          </div>
          <p className="text-[12px] text-[#8E8E93]">{t("workspace.production.queue.items", { count: prepQueueItems.length })}</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-[#2A2A2E]">
              <tr>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.queue.item")}</th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.queue.remaining")}</th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.queue.prepNeeded")}</th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.queue.priority")}</th>
              </tr>
            </thead>
            <tbody>
              {prepQueueItems.map((item) => {
                const priority = getPriority(item, t);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#2A2A2E] odd:bg-[#141418]"
                  >
                    <td className="px-2 py-3 text-[14px] text-[#F5F5F7]">
                      {item.title}
                    </td>
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
                        className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${getPriorityTone(priority, t)}`}
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
            <p className="mt-4 text-[13px] text-[#8E8E93]">{t("workspace.production.queue.noItems")}</p>
          ) : null}
        </div>
        </section>
      ) : null}

      {activeTab === "WASTE" ? (
        <section className="mt-6 rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.waste.title")}</p>
            <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">{t("workspace.production.waste.description")}</p>
          </div>
          <p className="text-[12px] text-[#8E8E93]">{t("workspace.production.waste.alerts", { count: wasteSignals.length })}</p>
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
                  {t("workspace.production.waste.demandSlowing", { quantity: `${overage} ${item.unit}` })}
                </p>
                <p className="mt-2 text-[12px] font-semibold text-[#F5F5F7]">
                  {t("workspace.production.waste.suggestedAction")}
                </p>
              </div>
            );
          })}
          {!wasteSignals.length ? (
            <p className="text-[13px] text-[#8E8E93]">{t("workspace.production.waste.noAlerts")}</p>
          ) : null}
        </div>
        </section>
      ) : null}

      {activeTab === "CARDS" ? (
        <section className="mt-6 rounded-[16px] border border-[#2A2A2E] bg-[#151518] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93]">{t("workspace.production.cards.title")}</p>
            <p className="mt-1 text-[18px] font-semibold text-[#F5F5F7]">{t("workspace.production.cards.description")}</p>
          </div>
          <p className="text-[12px] text-[#8E8E93]">{t("workspace.production.cards.items", { count: productionCards.length })}</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {productionCards.map((item) => {
            const trendLabel = getTrendLabel(item.trendPct, t);
            return (
              <div
                key={item.id}
                className="rounded-[14px] border border-[#2A2A2E] bg-[#101012] p-4"
              >
                <p className="text-[15px] text-[#F5F5F7]">{item.title}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      {t("workspace.production.cards.forecast")}
                    </p>
                    <p className="mt-1 text-[20px] font-semibold text-[#F5F5F7]">
                      {formatQuantity(item.forecast, item.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      {t("workspace.today.closed.sold")}
                    </p>
                    <p className="mt-1 text-[20px] font-semibold text-[#F5F5F7]">
                      {formatQuantity(item.sold, item.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      {t("workspace.production.cards.remaining")}
                    </p>
                    <p className="mt-1 text-[20px] font-semibold text-[#F5F5F7]">
                      {formatQuantity(item.remaining, item.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      {t("workspace.production.cards.status")}
                    </p>
                    <p className="mt-1 text-[20px] font-semibold text-[#F5F5F7]">
                      {trendLabel}
                    </p>
                  </div>
                </div>
                {item.prepNowQty > 0 ? (
                  <p className="mt-3 text-[12px] text-[#E0B86B]">
                    {t("workspace.production.cards.prepRecommended", { quantity: formatQuantity(item.prepNowQty, item.unit) })}
                  </p>
                ) : null}
              </div>
            );
          })}
          {!productionCards.length ? (
            <p className="text-[13px] text-[#8E8E93]">{t("workspace.production.cards.noCards")}</p>
          ) : null}
        </div>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}
