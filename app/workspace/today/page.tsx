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
  useIgnoreBranchDayLiveAlert,
  useInitializeBranchDay,
  useLockBranchDayPlan,
  useSalesManualQuickEntry,
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
  deviation: number;
  deviation_threshold: number;
  impact_simulation_triggered: boolean;
  impact_simulation: {
    suggested_qty: number;
    waste_probability_change: number;
    stockout_probability_change: number;
    margin_savings: number;
  };
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

function formatSignedCurrency(value: number) {
  const base = formatCurrency(Math.abs(value));
  return value >= 0 ? `+${base}` : `-${base}`;
}

function comparisonTone(direction: "up" | "down" | "flat", positiveWhen: "up" | "down") {
  if (direction === "flat") return "text-text-muted";
  const isPositive = direction === positiveWhen;
  return isPositive ? "text-status-success" : "text-status-critical";
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
  const [actionErrorByItem, setActionErrorByItem] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<null | "START_LIVE" | "CLOSE_DAY">(null);
  const [wasteItem, setWasteItem] = useState<null | { id: string; title: string; unit: string }>(null);
  const [importantItemsOnly, setImportantItemsOnly] = useState(true);
  const [ignoredLiveAlertIds, setIgnoredLiveAlertIds] = useState<string[]>([]);
  const [quietMode, setQuietMode] = useState(false);

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
  const lockPlanMutation = useLockBranchDayPlan();
  const updateBranchDayStatusMutation = useUpdateBranchDayStatus();
  const createProductionLogMutation = useCreateProductionLog();
  const salesQuickEntryMutation = useSalesManualQuickEntry();
  const ignoreLiveAlertMutation = useIgnoreBranchDayLiveAlert();
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
  const networkLearnings = useMemo(() => {
    const network = branchDay?.kitchen_intelligence_network;
    if (!network) return [];
    const learnings: Array<{ label: string; detail: string; confidence?: number }> = [];
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
      .filter((pattern) => pattern.is_validated && pattern.trigger_factor === "rain" && pattern.effect_pct > 0)
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (rainPattern) {
      const supported =
        network.knowledge_transfer.find(
          (row) => row.item_id === rainPattern.item_id && row.trigger_factor === "rain",
        )?.supporting_kitchens_count ?? 0;
      learnings.push({
        label: `Rain increases ${rainPattern.item_name.toLowerCase()} demand`,
        detail: `Validated in ${supported || 1} similar branch${supported === 1 ? "" : "es"}.`,
        confidence: rainPattern.confidence,
      });
    }
    const wastePattern = (network.network_aggregation.cross_location_patterns ?? [])[0];
    if (wastePattern) {
      learnings.push({
        label: `${wastePattern.item_name} waste variance detected`,
        detail: `Visible across at least 2 locations (spread ${wastePattern.spread_pct.toFixed(1)}%).`,
        confidence: wastePattern.confidence,
      });
    }
    return learnings.slice(0, 3);
  }, [branchDay?.kitchen_intelligence_network]);
  const networkSuggestedAction = useMemo(() => {
    const transfer = branchDay?.kitchen_intelligence_network?.knowledge_transfer?.[0];
    if (transfer?.suggested_action) return transfer.suggested_action;
    const wastePattern = branchDay?.kitchen_intelligence_network?.network_aggregation?.cross_location_patterns?.[0];
    if (!wastePattern) return "No high-confidence network action right now.";
    return `Reduce ${wastePattern.item_name} prep exposure for the next run and monitor sell-through before close.`;
  }, [branchDay?.kitchen_intelligence_network]);

  useEffect(() => {
    if (!branchDay) return;
    const initialPlans: Record<string, number | ""> = {};
    for (const item of branchDay.prep_plan_items) {
      const seedValue = item.planned_quantity ?? item.suggested_quantity;
      initialPlans[item.id] = isDiscreteUnit(item.unit) ? Math.round(seedValue) : seedValue;
    }
    setPlannedQtyByItem(initialPlans);
  }, [branchDay?.id]);

  const isMorning = branchDay?.status === "MORNING";
  const isLive = branchDay?.status === "LIVE";
  const isClosed = branchDay?.status === "CLOSED";
  const isPlanLocked = Boolean(branchDay?.plan_lock?.is_locked);

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
  const importantForecastRowIds = useMemo(() => {
    const topDemand = forecastRowsByDemand.slice(0, 5).map((row) => row.item.id);
    const highRisk = rows.filter((row) => row.riskScore >= 0.35).map((row) => row.item.id);
    const lowConfidence = rows
      .filter((row) => row.item.forecast_context.confidence_score < 0.6)
      .map((row) => row.item.id);
    return new Set([...topDemand, ...highRisk, ...lowConfidence]);
  }, [forecastRowsByDemand, rows]);
  const section2Rows = useMemo(() => {
    if (!importantItemsOnly) return forecastRowsByDemand;
    const filtered = forecastRowsByDemand.filter((row) => importantForecastRowIds.has(row.item.id));
    return filtered.length ? filtered : forecastRowsByDemand.slice(0, 5);
  }, [forecastRowsByDemand, importantItemsOnly, importantForecastRowIds]);
  const forecastRankById = useMemo(() => {
    const rankMap: Record<string, number> = {};
    forecastRowsByDemand.forEach((row, index) => {
      rankMap[row.item.id] = index + 1;
    });
    return rankMap;
  }, [forecastRowsByDemand]);

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

  const normalizePlannedQuantity = (value: number, unit: string) => {
    if (Number.isNaN(value)) return value;
    return isDiscreteUnit(unit) ? Math.round(value) : value;
  };

  const onPlannedChange = (prepPlanItemId: string, value: string, unit: string) => {
    const parsed = value === "" ? "" : normalizePlannedQuantity(Number(value), unit);
    setPlannedQtyByItem((prev) => ({ ...prev, [prepPlanItemId]: parsed }));
    setActionErrorByItem((prev) => {
      if (!prev[prepPlanItemId]) return prev;
      const next = { ...prev };
      delete next[prepPlanItemId];
      return next;
    });

    if (evaluateDebounce.current[prepPlanItemId]) {
      window.clearTimeout(evaluateDebounce.current[prepPlanItemId]);
    }

    if (parsed === "" || Number.isNaN(parsed)) return;

    evaluateDebounce.current[prepPlanItemId] = window.setTimeout(() => {
      evaluateImpact(prepPlanItemId, Number(parsed));
    }, 300);
  };

  const acceptSuggestion = (prepPlanItemId: string, suggestedQuantity: number, unit: string) => {
    const normalizedQuantity = normalizePlannedQuantity(suggestedQuantity, unit);
    updatePrepPlanMutation.mutate(
      {
        prepPlanItemId,
        payload: {
          planned_quantity: normalizedQuantity,
          accepted_suggestion: true,
        },
      },
      {
        onSuccess: () => {
          setPlannedQtyByItem((prev) => ({ ...prev, [prepPlanItemId]: normalizedQuantity }));
          setActionErrorByItem((prev) => {
            if (!prev[prepPlanItemId]) return prev;
            const next = { ...prev };
            delete next[prepPlanItemId];
            return next;
          });
        },
        onError: () =>
          setActionErrorByItem((prev) => ({
            ...prev,
            [prepPlanItemId]: "Could not accept suggestion. Try again.",
          })),
      },
    );
  };

  const keepMyPlan = (prepPlanItemId: string, plannedQuantity: number | null, unit: string) => {
    if (plannedQuantity == null || Number.isNaN(plannedQuantity)) return;
    const normalizedQuantity = normalizePlannedQuantity(plannedQuantity, unit);
    updatePrepPlanMutation.mutate({
      prepPlanItemId,
      payload: {
        planned_quantity: normalizedQuantity,
        accepted_suggestion: false,
      },
    }, {
      onSuccess: () => {
        setPlannedQtyByItem((prev) => ({ ...prev, [prepPlanItemId]: normalizedQuantity }));
        setActionErrorByItem((prev) => {
          if (!prev[prepPlanItemId]) return prev;
          const next = { ...prev };
          delete next[prepPlanItemId];
          return next;
        });
      },
      onError: () =>
        setActionErrorByItem((prev) => ({
          ...prev,
          [prepPlanItemId]: "Could not keep chef plan. Try again.",
        })),
    });
  };

  const backendDecisionFeedback = (item: { decision?: string | null; accepted_suggestion?: boolean }) => {
    if (item.decision === "ACCEPTED_AI" || item.accepted_suggestion) {
      return {
        tone: "success" as const,
        message: "Accepted suggestion. Plan aligned with forecast.",
      };
    }
    if (item.decision === "CHEF_OVERRIDE") {
      return {
        tone: "warning" as const,
        message: "Kept chef plan. Override recorded.",
      };
    }
    return null;
  };

  const startLiveService = () => {
    if (!branchDay?.id) return;
    if (!isPlanLocked) return;
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

  const lockPlan = () => {
    if (!branchDay?.id || isPlanLocked) return;
    lockPlanMutation.mutate({ branchDayId: branchDay.id, payload: {} });
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

  const logProduction = (prepPlanItemId: string, quantityProduced: number, reason?: string) => {
    createProductionLogMutation.mutate({
      prep_plan_item_id: prepPlanItemId,
      quantity_produced: quantityProduced,
      waste_quantity: 0,
      event_type: "additional",
      reason: reason ?? "Chef decision",
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

  const quickTapSale = (item: { product_id: string; unit: string }, quantitySold: number) => {
    if (!branchId) return;
    const normalizedQty = isDiscreteUnit(item.unit) ? Math.round(quantitySold) : quantitySold;
    salesQuickEntryMutation.mutate({
      branch_id: branchId,
      target_date: targetDate,
      items: [
        {
          item_id: item.product_id,
          quantity_sold: normalizedQty,
          unit: item.unit,
          notes: "Live quick tap sale",
        },
      ],
    });
  };

  const handlePrepareMoreAlert = (alert: {
    id: string;
    prep_plan_item_id: string;
    suggested_prepare_qty: number;
    details: Record<string, string | number | boolean | null>;
  }) => {
    const liveItem = branchDay?.prep_plan_items.find((row) => row.id === alert.prep_plan_item_id);
    if (!liveItem) return;
    const rawQty = Number(alert.suggested_prepare_qty || 0);
    const normalizedQty = isDiscreteUnit(liveItem.unit) ? Math.max(1, Math.round(rawQty)) : Math.max(0.1, rawQty);
    logProduction(liveItem.id, normalizedQty, "Demand spike");
    ignoreLiveAlert(alert.id, { prep_plan_item_id: alert.prep_plan_item_id, type: "STOCKOUT_RISK" });
  };

  useEffect(() => {
    if (!isLive || !branchDay?.id) return;
    const interval = window.setInterval(() => {
      todayQuery.refetch();
    }, 20000);
    return () => window.clearInterval(interval);
  }, [isLive, branchDay?.id, todayQuery]);

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

  const liveRows = useMemo(
    () =>
      (branchDay?.prep_plan_items ?? []).map((item) => {
        const monitor = item.live_monitor;
        const planned = monitor?.planned_qty ?? item.planned_quantity ?? item.suggested_quantity;
        const additional = monitor?.additional_qty ?? Math.max(item.final_quantity - planned, 0);
        const sold = monitor?.sold_today ?? 0;
        const remaining = monitor?.remaining_qty ?? Math.max(item.final_quantity - sold, 0);
        return { item, monitor, planned, additional, sold, remaining };
      }),
    [branchDay?.prep_plan_items],
  );
  const liveSmartAlerts = useMemo(
    () => (branchDay?.live_alerts ?? []).filter((alert) => !ignoredLiveAlertIds.includes(alert.id)).slice(0, 3),
    [branchDay?.live_alerts, ignoredLiveAlertIds],
  );
  const criticalLiveAlertItemIds = useMemo(
    () =>
      new Set(
        liveSmartAlerts
          .filter((alert) => alert.severity === "HIGH" || alert.severity === "CRITICAL")
          .map((alert) => alert.prep_plan_item_id),
      ),
    [liveSmartAlerts],
  );
  const visibleLiveRows = useMemo(
    () => (quietMode ? liveRows.filter((row) => criticalLiveAlertItemIds.has(row.item.id)) : liveRows),
    [quietMode, liveRows, criticalLiveAlertItemIds],
  );
  const stockoutWatchCount = useMemo(
    () => liveRows.filter((row) => (row.monitor?.stockout_risk_score ?? 0) >= 0.7).length,
    [liveRows],
  );
  const overproductionWatchCount = useMemo(
    () => liveRows.filter((row) => (row.monitor?.overproduction_risk_score ?? 0) >= 0.7).length,
    [liveRows],
  );

  const ignoreLiveAlert = (alertId: string, alert?: { prep_plan_item_id: string; type: "STOCKOUT_RISK" | "WASTE_RISK" | "SALES_SPIKE" }) => {
    setIgnoredLiveAlertIds((prev) => (prev.includes(alertId) ? prev : [...prev, alertId]));
    if (!branchDay?.id || !alert) return;
    ignoreLiveAlertMutation.mutate({
      branchDayId: branchDay.id,
      payload: {
        prep_plan_item_id: alert.prep_plan_item_id,
        alert_type: alert.type,
        cooldown_minutes: 45,
      },
    });
  };

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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={lockPlan}
                  disabled={isPlanLocked || lockPlanMutation.isPending}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-status-success/45 px-5 text-sm font-semibold text-status-success transition-all duration-200 hover:border-status-success hover:bg-status-success/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPlanLocked ? "Plan Locked" : lockPlanMutation.isPending ? "Locking plan..." : "Lock Plan"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction("START_LIVE")}
                  disabled={updateBranchDayStatusMutation.isPending || !isPlanLocked}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-brand-gold/45 px-5 text-sm font-semibold text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateBranchDayStatusMutation.isPending ? "Starting service..." : "Start Live Service"}
                </button>
              </div>
            </div>
            {!isPlanLocked ? (
              <p className="mt-3 text-xs text-status-warning">
                Lock the plan to finalize chef decisions before starting live service.
              </p>
            ) : branchDay?.plan_lock?.locked_at ? (
              <p className="mt-3 text-xs text-status-success">
                Plan locked at {new Date(branchDay.plan_lock.locked_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                {branchDay.plan_lock.locked_by?.name ? ` by ${branchDay.plan_lock.locked_by.name}` : ""}.
              </p>
            ) : null}

            <div className="mt-8 border-t border-surface-4/60 pt-5">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
                <article className="rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                    Kitchen Intelligence Network
                  </p>
                  <h4 className="mt-2 font-display text-xl font-semibold text-text-primary">
                    Local + Cross-Location Learning
                  </h4>
                  {branchDay.kitchen_intelligence_network ? (
                    <>
                      <p className="mt-3 text-sm text-text-secondary">
                        Local model rows:{" "}
                        <span className="font-semibold text-text-primary">
                          {branchDay.kitchen_intelligence_network.local_learning.rows}
                        </span>
                        {" · "}
                        Network rows:{" "}
                        <span className="font-semibold text-text-primary">
                          {branchDay.kitchen_intelligence_network.network_aggregation.rows}
                        </span>
                        {" · "}
                        Locations:{" "}
                        <span className="font-semibold text-text-primary">
                          {branchDay.kitchen_intelligence_network.network_aggregation.active_locations}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Waste ratio:{" "}
                        <span className="font-semibold text-status-warning">
                          {branchDay.kitchen_intelligence_network.local_learning.waste_ratio_pct.toFixed(1)}%
                        </span>
                        {" local vs "}
                        <span className="font-semibold text-text-primary">
                          {branchDay.kitchen_intelligence_network.network_aggregation.waste_ratio_pct.toFixed(1)}%
                        </span>
                        {" network"}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Validated patterns:{" "}
                        <span className="font-semibold text-status-success">
                          {branchDay.kitchen_intelligence_network.network_aggregation.validated_pattern_count ?? 0}
                        </span>
                        {" · "}quality threshold{" "}
                        <span className="font-semibold text-text-primary">
                          {percent(branchDay.kitchen_intelligence_network.network_aggregation.pattern_quality_threshold ?? 0.62)}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Similarity threshold{" "}
                        <span className="font-semibold text-text-primary">
                          {percent(branchDay.kitchen_intelligence_network.network_aggregation.similarity_threshold ?? 0.65)}
                        </span>
                        {" · "}transfer confidence{" "}
                        <span className="font-semibold text-text-primary">
                          {percent(branchDay.kitchen_intelligence_network.network_aggregation.transfer_confidence_threshold ?? 0.72)}
                        </span>
                      </p>
                      {branchDay.kitchen_intelligence_network.network_aggregation.kitchen_similarity?.length ? (
                        <p className="mt-1 text-xs text-text-secondary">
                          Most similar:{" "}
                          <span className="font-semibold text-text-primary">
                            {branchDay.kitchen_intelligence_network.network_aggregation.kitchen_similarity[0].location_name}
                          </span>{" "}
                          ({percent(branchDay.kitchen_intelligence_network.network_aggregation.kitchen_similarity[0].similarity_score)})
                        </p>
                      ) : null}
                      {branchDay.kitchen_intelligence_network.network_knowledge_graph ? (
                        <p className="mt-1 text-xs text-text-secondary">
                          Knowledge graph:{" "}
                          <span className="font-semibold text-text-primary">
                            {branchDay.kitchen_intelligence_network.network_knowledge_graph.nodes.total} nodes
                          </span>
                          {" · "}
                          <span className="font-semibold text-text-primary">
                            {branchDay.kitchen_intelligence_network.network_knowledge_graph.edges.total} edges
                          </span>
                        </p>
                      ) : null}
                      {branchDay.kitchen_intelligence_network.feedback_loop ? (
                        <p className="mt-1 text-xs text-text-secondary">
                          Feedback loop: {branchDay.kitchen_intelligence_network.feedback_loop.patterns_validated}
                          {" validated / "}
                          {branchDay.kitchen_intelligence_network.feedback_loop.patterns_total}
                          {" patterns"}
                        </p>
                      ) : null}
                      <div className="mt-4 rounded-lg border border-surface-4 bg-surface-2/60 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                          Top Cross-Location Pattern
                        </p>
                        {branchDay.kitchen_intelligence_network.network_aggregation.cross_location_patterns[0] ? (
                          <>
                            <p className="mt-1 text-sm font-semibold text-text-primary">
                              {branchDay.kitchen_intelligence_network.network_aggregation.cross_location_patterns[0].item_name}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              Spread {branchDay.kitchen_intelligence_network.network_aggregation.cross_location_patterns[0].spread_pct.toFixed(1)}%
                              {" · "}confidence {percent(branchDay.kitchen_intelligence_network.network_aggregation.cross_location_patterns[0].confidence)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 text-xs text-text-secondary">
                            Not enough cross-location variance yet. Keep capturing daily rows.
                          </p>
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                          Knowledge Transfer
                        </p>
                        {branchDay.kitchen_intelligence_network.knowledge_transfer.length ? (
                          <>
                            <p className="mt-1 text-xs text-text-secondary">
                              {branchDay.kitchen_intelligence_network.knowledge_transfer[0].suggested_action} Potential waste reduction:{" "}
                              <span className="font-semibold text-status-success">
                                {branchDay.kitchen_intelligence_network.knowledge_transfer[0].expected_waste_reduction_pct.toFixed(1)}%
                              </span>
                            </p>
                            {typeof branchDay.kitchen_intelligence_network.knowledge_transfer[0].pattern_quality_score === "number" ? (
                              <p className="mt-1 text-[11px] text-text-muted">
                                Pattern quality: {percent(branchDay.kitchen_intelligence_network.knowledge_transfer[0].pattern_quality_score ?? 0)}
                              </p>
                            ) : null}
                            {typeof branchDay.kitchen_intelligence_network.knowledge_transfer[0].supporting_kitchens_count === "number" ? (
                              <p className="mt-1 text-[11px] text-text-muted">
                                Supported by {branchDay.kitchen_intelligence_network.knowledge_transfer[0].supporting_kitchens_count} similar kitchen(s)
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <p className="mt-1 text-xs text-text-secondary">
                            No validated transfer action yet for this branch.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-text-secondary">
                      Network intelligence is unavailable for this branch day.
                    </p>
                  )}
                </article>
              </div>
              <article className="mt-4 rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Network Learnings
                </p>
                <h4 className="mt-2 font-display text-xl font-semibold text-text-primary">
                  Actionable Network Intelligence
                </h4>
                {networkLearnings.length ? (
                  <div className="mt-3 space-y-2">
                    {networkLearnings.map((learning) => (
                      <div key={`${learning.label}-${learning.detail}`} className="rounded-lg border border-surface-4 bg-surface-3/35 px-3 py-3">
                        <p className="text-sm font-semibold text-text-primary">{learning.label}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {learning.detail}
                          {typeof learning.confidence === "number"
                            ? ` Confidence ${percent(learning.confidence)}.`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-text-secondary">
                    Network insights will appear as soon as validated cross-location patterns are available.
                  </p>
                )}
                <div className="mt-4 rounded-lg border border-status-warning/35 bg-status-warning/10 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-status-warning">Suggested Action</p>
                  <p className="mt-1 text-sm text-text-primary">{networkSuggestedAction}</p>
                </div>
              </article>
            </div>
          </section>

          <section className="mb-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Forecast Prep List
                </p>
                <h3 className="font-display text-2xl font-semibold text-text-primary">
                  Core Planning Interface
                </h3>
                <p className="text-sm text-text-secondary">
                  One row per prep item with forecast confidence and demand priority.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportantItemsOnly((prev) => !prev)}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-surface-4 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary transition-all duration-200 hover:border-brand-gold hover:text-brand-gold"
                >
                  {importantItemsOnly ? "Important items only: ON" : "Important items only: OFF"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Rows In Focus</p>
                <p className="mt-1 text-xl font-semibold text-text-primary">
                  {section2Rows.length}
                  <span className="ml-2 text-sm font-medium text-text-muted">of {forecastRowsByDemand.length}</span>
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Showing top demand, high risk, and low-confidence items first.
                </p>
              </article>
              <article className="rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-brand-gold">Chef Forecast Accuracy</p>
                {branchDay.morning_overview?.chef_accuracy_score?.available ? (
                  <>
                    <p className="mt-1 text-xl font-semibold text-text-primary">
                      Last {branchDay.morning_overview.chef_accuracy_score.window_days} days:{" "}
                      {branchDay.morning_overview.chef_accuracy_score.chef_forecast_accuracy_pct.toFixed(1)}%
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Better than AI:{" "}
                      <span className={branchDay.morning_overview.chef_accuracy_score.better_than_ai_pct >= 0 ? "text-status-success font-semibold" : "text-status-critical font-semibold"}>
                        {branchDay.morning_overview.chef_accuracy_score.better_than_ai_pct >= 0 ? "+" : ""}
                        {branchDay.morning_overview.chef_accuracy_score.better_than_ai_pct.toFixed(1)}%
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-text-secondary">
                    Build 30-day history to unlock chef-vs-AI accuracy benchmarking.
                  </p>
                )}
              </article>
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
                  {section2Rows.map(({ item, riskScore }) => (
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
                        {popularityLabel(forecastRankById[item.id] ?? 999)}
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
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Chef Plan Input</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                  Enter Your Prep Decision
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Input your prep plan, review variance against forecast, then evaluate AI guidance before service begins.
                </p>
                <div className="mt-3 rounded-lg border border-brand-gold/35 bg-brand-gold/10 px-3 py-2">
                  <p className="text-xs text-text-secondary">
                    Workflow: Demand Signal {"->"} Forecast Prep List {"->"} Input Plan {"->"} AI Review {"->"} Confirm or Override {"->"} Start Service
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-brand-gold">Target completion time: under 3 minutes</p>
                </div>
              </div>

              <div className="space-y-3">
                {(highPriorityRows.length ? highPriorityRows : rows.slice(0, 3)).map(({ item, planned, variance, impact, riskScore }) => {
                  const context = item.forecast_context;
                  const wasteDirection = impact
                    ? impact.waste_risk_increase < 0
                      ? "decrease"
                      : impact.waste_risk_increase > 0
                        ? "increase"
                        : "neutral"
                    : "neutral";
                  const marginSavedEstimate = impact
                    ? impact.impact_simulation_triggered
                      ? Math.max(0, impact.impact_simulation.margin_savings)
                      : 0
                    : 0;
                  return (
                    <article key={item.id} className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr,1fr]">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-text-primary">{item.product_title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskTone(riskScore)}`}>
                              {riskLabel(riskScore)} risk
                            </span>
                          </div>
                          <p className="text-xs text-text-muted">
                            Forecast: {formatQuantity(item.suggested_quantity, item.unit)} · Expected orders {Math.round(context.predicted_orders)}
                          </p>
                          <div className="rounded-lg border border-surface-4 bg-surface-3/45 px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Your Plan</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                step={isDiscreteUnit(item.unit) ? 1 : 0.01}
                                value={plannedQtyByItem[item.id] ?? ""}
                                onChange={(event) => onPlannedChange(item.id, event.target.value, item.unit)}
                                disabled={isPlanLocked}
                                className="h-9 w-36 rounded-full border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                              />
                              <span className="text-xs text-text-muted">{item.unit}</span>
                            </div>
                            <p className="mt-2 text-xs text-text-secondary">
                              Variance = Chef plan - forecast
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              <span className="text-text-muted">Variance: </span>
                              <span
                                className={
                                  variance == null
                                    ? "text-text-muted"
                                    : variance > 0
                                      ? "text-status-warning"
                                      : variance < 0
                                        ? "text-status-critical"
                                        : "text-status-success"
                                }
                              >
                                {variance == null ? "-" : signedQuantity(variance, item.unit)}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-status-warning">
                            AI Suggestion Review
                          </p>
                          <p className="mt-2 text-xs text-text-secondary">Based on:</p>
                          <ul className="list-disc pl-4 text-xs text-text-secondary">
                            <li>90-day demand history</li>
                            <li>Similar weekday demand</li>
                            <li>Stockout history</li>
                            <li>Waste patterns</li>
                          </ul>
                          <p className="mt-3 text-xs text-text-secondary">
                            Suggested:{" "}
                            <span className="font-semibold text-text-primary">
                              {formatQuantity(item.suggested_quantity, item.unit)}
                            </span>
                          </p>
                          {impact ? (
                            <div className="mt-2 space-y-1 text-xs text-text-secondary">
                              {!impact.impact_simulation_triggered ? (
                                <p className="text-text-muted">
                                  Deviation is within control threshold ({impact.deviation_threshold.toFixed(1)} {item.unit}); no AI correction needed.
                                </p>
                              ) : null}
                              <p>
                                Waste risk{" "}
                                <span className={wasteDirection === "decrease" ? "text-status-success" : wasteDirection === "increase" ? "text-status-critical" : "text-text-muted"}>
                                  {wasteDirection === "decrease"
                                    ? `decreases ${Math.abs(impact.waste_risk_increase).toFixed(1)}%`
                                    : wasteDirection === "increase"
                                      ? `increases ${Math.abs(impact.waste_risk_increase).toFixed(1)}%`
                                      : "unchanged"}
                                </span>
                              </p>
                              <p>
                                Estimated margin saved:{" "}
                                <span className="font-semibold text-status-success">{formatCurrency(marginSavedEstimate)}</span>
                              </p>
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-text-muted">Adjust your plan quantity to preview potential impact.</p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => acceptSuggestion(item.id, item.suggested_quantity, item.unit)}
                              disabled={isPlanLocked}
                              className="inline-flex h-8 items-center rounded-full border border-status-success/40 px-3 text-xs font-medium text-status-success transition-colors hover:bg-status-success/10"
                            >
                              Accept Suggestion
                            </button>
                            <button
                              type="button"
                              onClick={() => keepMyPlan(item.id, planned, item.unit)}
                              disabled={isPlanLocked}
                              className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-3"
                            >
                              Keep My Plan
                            </button>
                          </div>
                          {actionErrorByItem[item.id] ? (
                            <p className="mt-2 text-xs text-status-critical">
                              {actionErrorByItem[item.id]}
                            </p>
                          ) : backendDecisionFeedback(item) ? (
                            <p
                              className={`mt-2 text-xs ${
                                backendDecisionFeedback(item)?.tone === "success"
                                  ? "text-status-success"
                                  : backendDecisionFeedback(item)?.tone === "warning"
                                    ? "text-status-warning"
                                    : "text-status-critical"
                              }`}
                            >
                              {backendDecisionFeedback(item)?.message}
                            </p>
                          ) : null}
                        </div>
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
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr,1fr]">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-text-primary">{item.product_title}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskTone(riskScore)}`}>
                                {riskLabel(riskScore)} risk
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-text-muted">
                              Forecast: {formatQuantity(item.suggested_quantity, item.unit)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                step={isDiscreteUnit(item.unit) ? 1 : 0.01}
                                value={plannedQtyByItem[item.id] ?? ""}
                                onChange={(event) => onPlannedChange(item.id, event.target.value, item.unit)}
                                disabled={isPlanLocked}
                                className="h-8 w-28 rounded-full border border-surface-4 bg-surface-3 px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
                              />
                              <span className="text-[11px] text-text-muted">{item.unit}</span>
                              <button
                                type="button"
                                onClick={() => acceptSuggestion(item.id, item.suggested_quantity, item.unit)}
                                disabled={isPlanLocked}
                                className="inline-flex h-7 items-center rounded-full border border-status-success/40 px-3 text-[11px] font-medium text-status-success transition-colors hover:bg-status-success/10"
                              >
                                Accept Suggestion
                              </button>
                              <button
                                type="button"
                                onClick={() => keepMyPlan(item.id, planned, item.unit)}
                                disabled={isPlanLocked}
                                className="inline-flex h-7 items-center rounded-full border border-surface-4 px-3 text-[11px] font-medium text-text-primary transition-colors hover:bg-surface-3"
                              >
                                Keep My Plan
                              </button>
                            </div>
                            {actionErrorByItem[item.id] ? (
                              <p className="mt-2 text-xs text-status-critical">
                                {actionErrorByItem[item.id]}
                              </p>
                            ) : backendDecisionFeedback(item) ? (
                              <p
                                className={`mt-2 text-xs ${
                                  backendDecisionFeedback(item)?.tone === "success"
                                    ? "text-status-success"
                                    : backendDecisionFeedback(item)?.tone === "warning"
                                      ? "text-status-warning"
                                      : "text-status-critical"
                                }`}
                              >
                                {backendDecisionFeedback(item)?.message}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs text-text-muted">
                              Variance {variance == null ? "-" : signedQuantity(variance, item.unit)}
                              {impact ? ` · Sell-through ${percent(impact.sell_through_probability)}` : ""}
                            </p>
                          </div>
                          <div className="rounded-md border border-surface-4 bg-surface-2/60 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-status-warning">
                              AI Suggestion Review
                            </p>
                            <p className="mt-2 text-xs text-text-secondary">
                              Suggested: <span className="font-semibold text-text-primary">{formatQuantity(item.suggested_quantity, item.unit)}</span>
                            </p>
                            {impact ? (
                              <div className="mt-1 space-y-1 text-xs text-text-secondary">
                                <p>
                                  Deviation: {impact.deviation.toFixed(1)} {item.unit} (threshold {impact.deviation_threshold.toFixed(1)})
                                </p>
                                <p>Potential margin saved: <span className="font-semibold text-status-success">{formatCurrency(Math.max(0, impact.impact_simulation.margin_savings))}</span></p>
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-text-muted">Adjust quantity to preview impact.</p>
                            )}
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-semibold text-brand-gold">Reasoning and impact details</summary>
                              <div className="mt-1 space-y-1 text-xs text-text-secondary">
                                {item.forecast_context.reasoning.map((line) => (
                                  <p key={`${item.id}-${line}`}>{line}</p>
                                ))}
                                {impact ? <p>Potential unsold loss: {formatCurrency(impact.potential_unsold_loss)}</p> : null}
                              </div>
                            </details>
                          </div>
                        </div>
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
                Kitchen Radar
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Passive monitoring during service. Only critical alerts interrupt.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuietMode((prev) => !prev)}
                className="inline-flex h-10 items-center rounded-full border border-surface-4 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary hover:border-brand-gold hover:text-brand-gold"
              >
                Quiet Mode: {quietMode ? "On" : "Off"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction("CLOSE_DAY")}
                disabled={updateBranchDayStatusMutation.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-status-critical/40 bg-surface-3 px-4 text-sm font-medium text-status-critical transition-all duration-200 hover:border-status-critical hover:bg-status-critical/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateBranchDayStatusMutation.isPending ? "Closing..." : "Close Day"}
              </button>
            </div>
          </div>

          {liveSmartAlerts.length ? (
            <div className="mb-4 space-y-2">
              {liveSmartAlerts.map((alert) => (
                <article
                  key={alert.id}
                  className={`rounded-xl border px-4 py-3 ${
                    alert.type === "SALES_SPIKE"
                      ? "border-brand-gold/45 bg-brand-gold/10"
                      : "border-status-critical/40 bg-status-critical/10"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-primary">
                    {alert.type === "SALES_SPIKE" ? "Demand Surge" : alert.title}
                  </p>
                  <p className="mt-1 text-sm text-text-primary">
                    <span className="font-semibold">{alert.product_title}:</span> {alert.message}
                  </p>
                  {alert.type === "STOCKOUT_RISK" ? (
                    <div className="mt-1 space-y-1 text-xs text-text-secondary">
                      <p>
                        Remaining: {String(alert.details.remaining)} {String(alert.details.unit)} · Projected demand: {String(alert.details.projected_demand)} {String(alert.details.unit)}
                      </p>
                      {typeof alert.details.runout_minutes === "number" ? (
                        <p>
                          May run out in {Math.round(Number(alert.details.runout_minutes))} minutes · Prep time {Number(alert.details.prep_time_minutes || 0).toFixed(0)} minutes
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {alert.type === "WASTE_RISK" ? (
                    <p className="mt-1 text-xs text-text-secondary">
                      Prepared: {String(alert.details.prepared)} {String(alert.details.unit)} · Projected sold: {String(alert.details.projected_sold)} {String(alert.details.unit)} · Potential waste: {String(alert.details.potential_waste)} {String(alert.details.unit)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-text-secondary">Suggested action: {alert.suggested_action}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {alert.type === "STOCKOUT_RISK" ? (
                      <button
                        type="button"
                        onClick={() => handlePrepareMoreAlert(alert)}
                        className="inline-flex h-8 items-center rounded-full border border-status-success/40 px-3 text-xs font-medium text-status-success hover:bg-status-success/10"
                      >
                        Prepare More
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        ignoreLiveAlert(alert.id, {
                          prep_plan_item_id: alert.prep_plan_item_id,
                          type: alert.type,
                        })
                      }
                      className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-primary hover:bg-surface-3"
                    >
                      Ignore
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-status-success/35 bg-status-success/10 px-4 py-3">
              <p className="text-sm text-status-success">No critical live interruptions right now.</p>
            </div>
          )}

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-status-success/40 bg-status-success/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-status-success">Safe</p>
              <p className="mt-1 text-lg font-semibold text-status-success">
                {Math.max(liveRows.length - stockoutWatchCount - overproductionWatchCount, 0)}
              </p>
            </article>
            <article className="rounded-xl border border-status-warning/40 bg-status-warning/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-status-warning">Watch</p>
              <p className="mt-1 text-lg font-semibold text-status-warning">{overproductionWatchCount}</p>
            </article>
            <article className="rounded-xl border border-status-critical/40 bg-status-critical/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-status-critical">Risk</p>
              <p className="mt-1 text-lg font-semibold text-status-critical">{stockoutWatchCount}</p>
            </article>
          </div>

          <div className="space-y-3">
            {visibleLiveRows.map(({ item, monitor, planned, additional, sold, remaining }) => (
              <article key={item.id} className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-text-primary">{item.product_title}</p>
                    <p className="mt-2 text-sm text-text-secondary">Prepared: {formatQuantity(planned + additional, item.unit)}</p>
                    <p className="text-sm text-text-secondary">Sold: {formatQuantity(sold, item.unit)}</p>
                    <p className="text-sm text-text-primary">Remaining: {formatQuantity(remaining, item.unit)}</p>
                    {typeof monitor?.risk_engine?.runout_minutes === "number" ? (
                      <p className="mt-1 text-xs text-text-muted">
                        Runout in ~{Math.round(monitor.risk_engine.runout_minutes)} min · Prep time {Math.round(monitor.risk_engine.prep_time_minutes ?? 0)} min
                        {monitor.risk_engine.start_new_batch_now ? " · Start new batch now" : ""}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    {(() => {
                      const stockout = monitor?.risk_engine?.stockout_risk ?? "LOW";
                      const waste = monitor?.risk_engine?.waste_risk ?? "LOW";
                      const isRisk = stockout === "HIGH";
                      const isWatch = !isRisk && (stockout === "MEDIUM" || waste === "HIGH" || waste === "MEDIUM");
                      const toneClass = isRisk
                        ? "border-status-critical/40 bg-status-critical/10 text-status-critical"
                        : isWatch
                          ? "border-status-warning/40 bg-status-warning/10 text-status-warning"
                          : "border-status-success/40 bg-status-success/10 text-status-success";
                      const label = isRisk ? "Risk" : isWatch ? "Watch" : "Safe";
                      return <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${toneClass}`}>{label}</span>;
                    })()}
                  </div>
                </div>
              </article>
            ))}
            {quietMode && !visibleLiveRows.length ? (
              <div className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4 text-sm text-text-muted">
                Quiet mode is active. No HIGH/CRITICAL items need attention right now.
              </div>
            ) : null}
          </div>

          <details className="mt-4 rounded-xl border border-surface-4 bg-surface-2 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-text-primary">
              Fallback Actions (only when needed)
            </summary>
            <div className="mt-3 space-y-3">
              {liveRows.map(({ item }) => (
                <div key={`fallback-${item.id}`} className="flex flex-wrap items-center gap-2">
                  <p className="min-w-[160px] text-xs font-medium text-text-primary">{item.product_title}</p>
                  <button
                    type="button"
                    onClick={() => logProduction(item.id, 1)}
                    className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-primary hover:bg-surface-3"
                  >
                    + Add Production
                  </button>
                  <button
                    type="button"
                    onClick={() => quickTapSale(item, 1)}
                    className="inline-flex h-8 items-center rounded-full border border-brand-gold/40 px-3 text-xs font-medium text-brand-gold hover:bg-brand-gold/10"
                  >
                    +1 Sold
                  </button>
                  <button
                    type="button"
                    onClick={() => quickTapSale(item, 5)}
                    className="inline-flex h-8 items-center rounded-full border border-brand-gold/40 px-3 text-xs font-medium text-brand-gold hover:bg-brand-gold/10"
                  >
                    +5 Sold
                  </button>
                </div>
              ))}
            </div>
          </details>
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
          
          {branchDay.review_phase ? (
            <div className="space-y-8">
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">1. Daily Outcome</p>
                <p className="mt-2 text-sm text-text-secondary">{branchDay.review_phase.daily_outcome.title}</p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Forecast Accuracy</p>
                    <p className="mt-2 font-display text-2xl text-status-success">
                      {branchDay.review_phase.daily_outcome.metrics.forecast_accuracy.value.toFixed(1)}%
                    </p>
                    {branchDay.review_phase.daily_outcome.metrics.forecast_accuracy.comparison ? (
                      <p
                        className={`mt-2 text-xs ${comparisonTone(
                          branchDay.review_phase.daily_outcome.metrics.forecast_accuracy.comparison.direction,
                          "up",
                        )}`}
                      >
                        {branchDay.review_phase.daily_outcome.metrics.forecast_accuracy.comparison.direction === "up"
                          ? "↑"
                          : branchDay.review_phase.daily_outcome.metrics.forecast_accuracy.comparison.direction === "down"
                            ? "↓"
                            : "→"}{" "}
                        {Math.abs(branchDay.review_phase.daily_outcome.metrics.forecast_accuracy.comparison.delta_pct).toFixed(1)}% vs last same weekday
                      </p>
                    ) : null}
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Waste Cost</p>
                    <p className="mt-2 font-display text-2xl text-status-critical">
                      {formatCurrency(branchDay.review_phase.daily_outcome.metrics.waste_cost.value)}
                    </p>
                    {branchDay.review_phase.daily_outcome.metrics.waste_cost.comparison ? (
                      <p
                        className={`mt-2 text-xs ${comparisonTone(
                          branchDay.review_phase.daily_outcome.metrics.waste_cost.comparison.direction,
                          "down",
                        )}`}
                      >
                        {branchDay.review_phase.daily_outcome.metrics.waste_cost.comparison.direction === "up"
                          ? "↑"
                          : branchDay.review_phase.daily_outcome.metrics.waste_cost.comparison.direction === "down"
                            ? "↓"
                            : "→"}{" "}
                        {Math.abs(branchDay.review_phase.daily_outcome.metrics.waste_cost.comparison.delta_pct).toFixed(1)}% vs last same weekday
                      </p>
                    ) : null}
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Stockouts</p>
                    <p className="mt-2 font-display text-2xl text-text-primary">
                      {branchDay.review_phase.daily_outcome.metrics.stockouts.value} items
                    </p>
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Revenue Protected</p>
                    <p className="mt-2 font-display text-2xl text-status-success">
                      {formatCurrency(branchDay.review_phase.daily_outcome.metrics.revenue_protected.value)}
                    </p>
                  </article>
                </div>

                <div className="mt-6 rounded-xl border border-surface-4 bg-surface-2 p-5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Graph #1 - Demand vs Production</p>
                  <div className="mt-4 space-y-4">
                    {branchDay.review_phase.daily_outcome.demand_vs_production.slice(0, 6).map((row) => {
                      const maxValue = Math.max(row.planned_production, row.actual_production, row.actual_sales, 1);
                      return (
                        <div key={row.item_id} className="space-y-2">
                          <p className="text-sm font-medium text-text-primary">{row.item_title}</p>
                          <div className="space-y-1.5">
                            <div>
                              <div className="mb-1 flex justify-between text-xs text-text-muted">
                                <span>Planned Production</span>
                                <span>{formatQuantity(row.planned_production, row.unit)}</span>
                              </div>
                              <div className="h-2 rounded bg-surface-4">
                                <div className="h-2 rounded bg-brand-gold/70" style={{ width: `${(row.planned_production / maxValue) * 100}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="mb-1 flex justify-between text-xs text-text-muted">
                                <span>Actual Production</span>
                                <span>{formatQuantity(row.actual_production, row.unit)}</span>
                              </div>
                              <div className="h-2 rounded bg-surface-4">
                                <div className="h-2 rounded bg-status-warning/70" style={{ width: `${(row.actual_production / maxValue) * 100}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="mb-1 flex justify-between text-xs text-text-muted">
                                <span>Actual Sales</span>
                                <span>{formatQuantity(row.actual_sales, row.unit)}</span>
                              </div>
                              <div className="h-2 rounded bg-surface-4">
                                <div className="h-2 rounded bg-status-success/70" style={{ width: `${(row.actual_sales / maxValue) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Graph #2 - Waste Distribution</p>
                    <div className="mt-4 space-y-3">
                      {branchDay.review_phase.daily_outcome.waste_distribution.length ? (
                        branchDay.review_phase.daily_outcome.waste_distribution.slice(0, 6).map((row) => (
                          <div key={row.item_id}>
                            <div className="mb-1 flex justify-between text-xs text-text-muted">
                              <span>{row.item_title}</span>
                              <span>{row.share_pct.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 rounded bg-surface-4">
                              <div className="h-2 rounded bg-status-critical/75" style={{ width: `${Math.max(2, row.share_pct)}%` }} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-text-muted">No waste distribution available for this day.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Graph #3 - Last 7 Days Forecast Accuracy</p>
                    {branchDay.review_phase.daily_outcome.forecast_accuracy_trend.length ? (
                      <div className="mt-4">
                        {(() => {
                          const trend = branchDay.review_phase.daily_outcome.forecast_accuracy_trend;
                          const width = 520;
                          const height = 180;
                          const maxAcc = Math.max(...trend.map((row) => row.accuracy), 100);
                          const minAcc = Math.min(...trend.map((row) => row.accuracy), 0);
                          const span = Math.max(1, maxAcc - minAcc);
                          const xStep = trend.length > 1 ? width / (trend.length - 1) : width;
                          const points = trend.map((row, index) => {
                            const x = index * xStep;
                            const y = height - ((row.accuracy - minAcc) / span) * (height - 20) - 10;
                            return `${x},${y}`;
                          });
                          return (
                            <>
                              <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
                                <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-status-success" />
                              </svg>
                              <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-text-muted">
                                {trend.map((row) => (
                                  <div key={row.date}>
                                    <p>{row.date.slice(5)}</p>
                                    <p className="font-semibold text-text-secondary">{row.accuracy.toFixed(1)}%</p>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-text-muted">Not enough historical snapshots yet.</p>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">2. Key Insights</p>
                <div className="mt-4 space-y-3 rounded-xl border border-surface-4 bg-surface-2 p-5">
                  {branchDay.review_phase.key_insights.insights.map((insight, index) => (
                    <p key={`${index}-${insight}`} className="text-sm text-text-secondary">
                      {index + 1}. {insight}
                    </p>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">3. Item Performance</p>
                <div className="mt-3 overflow-x-auto border-y border-surface-4/70">
                  <table className="w-full min-w-[920px]">
                    <thead>
                      <tr className="border-b border-surface-4/70">
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Item</th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Forecast</th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Prepared</th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Sold</th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Waste</th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Stockout</th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-4/55">
                      {branchDay.review_phase.item_performance.rows.map((row) => (
                        <tr key={row.item_id}>
                          <td className="px-3 py-3 text-sm font-medium text-text-primary">{row.item_title}</td>
                          <td className="px-3 py-3 text-sm text-text-secondary">{formatQuantity(row.forecast, row.unit)}</td>
                          <td className="px-3 py-3 text-sm text-text-secondary">{formatQuantity(row.prepared, row.unit)}</td>
                          <td className="px-3 py-3 text-sm text-text-secondary">{formatQuantity(row.sold, row.unit)}</td>
                          <td className="px-3 py-3 text-sm text-status-critical">{formatQuantity(row.waste, row.unit)}</td>
                          <td className="px-3 py-3 text-sm text-text-secondary">{row.stockout ? "Yes" : "No"}</td>
                          <td className={`px-3 py-3 text-sm ${row.impact >= 0 ? "text-status-success" : "text-status-critical"}`}>
                            {formatSignedCurrency(row.impact)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">4. Learning Signals</p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Signal Rows</p>
                    <p className="mt-2 font-display text-2xl text-text-primary">
                      {branchDay.review_phase.learning_signals.ml_learning_signals?.rows ?? 0}
                    </p>
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Chef Overrides</p>
                    <p className="mt-2 font-display text-2xl text-text-primary">
                      {branchDay.review_phase.learning_signals.ml_learning_signals?.chef_override_rows ?? 0}
                    </p>
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Waste Rows</p>
                    <p className="mt-2 font-display text-2xl text-status-critical">
                      {branchDay.review_phase.learning_signals.ml_learning_signals?.waste_rows ?? 0}
                    </p>
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Stockout Rows</p>
                    <p className="mt-2 font-display text-2xl text-status-warning">
                      {branchDay.review_phase.learning_signals.ml_learning_signals?.stockout_rows ?? 0}
                    </p>
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Chef Beats AI</p>
                    <p className="mt-2 font-display text-2xl text-status-success">
                      {branchDay.review_phase.learning_signals.ml_learning_signals?.chef_outperformed_forecast_rows ?? 0}
                    </p>
                  </article>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Chef Adjustment Rate</p>
                    <p className="mt-2 font-display text-2xl text-text-primary">
                      {branchDay.review_phase.learning_signals.chef_behavior_learning.chef_adjustment_rate.toFixed(1)}%
                    </p>
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Chef Accuracy Score</p>
                    <p className="mt-2 font-display text-2xl text-text-primary">
                      {branchDay.review_phase.learning_signals.chef_behavior_learning.chef_accuracy_score.toFixed(1)}%
                    </p>
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Adjustments Improved Outcome</p>
                    <p className="mt-2 font-display text-2xl text-status-success">
                      {branchDay.review_phase.learning_signals.chef_behavior_learning.chef_adjustments_improved_outcome_rate.toFixed(1)}%
                    </p>
                  </article>
                </div>

                {branchDay.review_phase.learning_signals.revenue_loss_signals.length ? (
                  <div className="mt-4 rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Revenue Loss Signals (Stockouts)</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[860px]">
                        <thead>
                          <tr className="border-b border-surface-4/70">
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Item</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Stockout Time</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Sales Velocity/Hr</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Remaining Hours</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Estimated Lost Sales</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Estimated Lost Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-4/55">
                          {branchDay.review_phase.learning_signals.revenue_loss_signals.map((row) => (
                            <tr key={`${row.item_id}-${row.stockout_time}`}>
                              <td className="px-3 py-2 text-sm text-text-primary">{row.item_title}</td>
                              <td className="px-3 py-2 text-sm text-text-secondary">{new Date(row.stockout_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                              <td className="px-3 py-2 text-sm text-text-secondary">{row.sales_velocity_per_hour.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-text-secondary">{row.remaining_service_time_hours.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-text-secondary">{row.estimated_lost_sales.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-status-critical">{formatCurrency(row.estimated_lost_revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                <details className="mt-4 rounded-xl border border-surface-4 bg-surface-2 p-5">
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    ML Training Rows (Hidden By Default)
                  </summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[1080px]">
                      <thead>
                        <tr className="border-b border-surface-4/70">
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Item</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Forecast</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Chef Plan</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Additional</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Actual Sales</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Waste</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Stockout</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Forecast Error</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Chef Adjustment</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Outcome</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-4/55">
                        {branchDay.review_phase.learning_signals.training_rows.map((row) => (
                          <tr key={row.item_id}>
                            <td className="px-3 py-2 text-sm text-text-primary">{row.item_title}</td>
                            <td className="px-3 py-2 text-sm text-text-secondary">{formatQuantity(row.forecast_qty, row.unit)}</td>
                            <td className="px-3 py-2 text-sm text-text-secondary">{formatQuantity(row.chef_planned_qty, row.unit)}</td>
                            <td className="px-3 py-2 text-sm text-text-secondary">{formatQuantity(row.additional_qty, row.unit)}</td>
                            <td className="px-3 py-2 text-sm text-text-secondary">{formatQuantity(row.actual_sales, row.unit)}</td>
                            <td className="px-3 py-2 text-sm text-status-critical">{formatQuantity(row.waste, row.unit)}</td>
                            <td className="px-3 py-2 text-sm text-text-secondary">{row.stockouts ? "Yes" : "No"}</td>
                            <td className="px-3 py-2 text-sm text-text-secondary">{formatQuantity(row.forecast_error, row.unit)}</td>
                            <td className="px-3 py-2 text-sm text-text-secondary">{signedQuantity(row.chef_adjustment, row.unit)}</td>
                            <td className={`px-3 py-2 text-sm ${row.service_outcome === "IMPROVED_BY_CHEF" ? "text-status-success" : "text-status-warning"}`}>
                              {row.service_outcome === "IMPROVED_BY_CHEF" ? "Chef better" : "Forecast better"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>

                <div className="mt-4 rounded-xl border border-surface-4 bg-surface-2 p-5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Tomorrow Focus</p>
                  <ul className="mt-3 space-y-2">
                    {branchDay.review_phase.learning_signals.tomorrow_actions.map((action) => (
                      <li key={action} className="text-sm text-text-secondary">
                        - {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Tomorrow's Early Signal</p>
                <article className="mt-4 rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-5">
                  <p className="text-sm font-semibold text-text-primary">
                    {branchDay.review_phase.tomorrow_early_signal.message}
                  </p>
                  <p className="mt-2 text-xs text-text-muted">
                    Target day: {branchDay.review_phase.tomorrow_early_signal.target_date}
                    {" · "}
                    Demand change: {branchDay.review_phase.tomorrow_early_signal.expected_demand_change_pct >= 0 ? "+" : ""}
                    {branchDay.review_phase.tomorrow_early_signal.expected_demand_change_pct.toFixed(1)}%
                    {branchDay.review_phase.tomorrow_early_signal.weekday
                      ? ` · ${branchDay.review_phase.tomorrow_early_signal.weekday}`
                      : ""}
                  </p>
                </article>
              </section>
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
