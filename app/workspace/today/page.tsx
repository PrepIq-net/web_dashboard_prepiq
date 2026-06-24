"use client";

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shop, Calendar } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { OperationalCalendar } from "@/components/ui/operational-calendar";
import { ConfirmActionModal } from "@/components/dashboard/today/confirm-action-modal";
import { LogWasteModal } from "@/components/dashboard/today/log-waste-modal";
import { IngredientRequirements } from "@/components/dashboard/today/ingredient-requirements";
import { ModalShell } from "@/components/ui/modal-shell";
import { ScenarioBarChart } from "@/components/dashboard/scenario-bar-chart";
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
  useUpdateBranchDayNotes,
  useUpdatePrepPlanItem,
  useAdvancedForecast,
  useForecastMetrics,
  useDataQualityReport,
  useRealTimeVelocity,
  productionIntelligenceQueryKeys,
} from "@/services/production-intelligence/hooks";
import { productionIntelligenceEndpoints } from "@/services/production-intelligence/endpoints";
import { parseCSVFile } from "@/services/production-intelligence/csv-mapping";
import { useCSVUploadSessionStore } from "@/services/production-intelligence/csv-upload-session";
import { AdvancedForecastModalContent } from "@/components/dashboard/today/advanced-forecast-modal-content";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";

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
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function confidenceNarrative(score?: number | null) {
  if (score == null) return "Insufficient history to score confidence.";
  if (score >= 0.75) return "High confidence based on stable recent demand.";
  if (score >= 0.5) return "Moderate confidence with some expected variance.";
  return "Low confidence; demand is volatile or sparse.";
}

function agreementNarrative(score?: number | null) {
  if (score == null) return "Consensus not available for this forecast.";
  if (score >= 0.75) return "Models align closely on expected demand.";
  if (score >= 0.5) return "Models partially agree; signals are mixed.";
  return "Models diverge; treat the forecast as less certain.";
}

function velocitySummary(comparison?: {
  status?: string;
  deviation_pct?: number;
}) {
  if (!comparison || !comparison.status) {
    return "No live pace check yet. Tap update to compare today’s sales pace to plan.";
  }
  const deviation = comparison.deviation_pct ?? 0;
  const absDeviation = Math.abs(deviation);
  const deviationLabel = `${absDeviation.toFixed(0)}%`;
  if (comparison.status === "HIGH_DEMAND") {
    return `Selling faster than plan by ${deviationLabel}. Consider a quick batch cook to protect revenue.`;
  }
  if (comparison.status === "LOW_DEMAND") {
    return `Sales are ${deviationLabel} below plan. Slow prep to reduce waste.`;
  }
  return "Sales pace matches the plan. Keep the current prep rhythm.";
}

function velocityStatusTone(status?: string) {
  if (status === "HIGH_DEMAND") return "text-status-critical";
  if (status === "LOW_DEMAND") return "text-status-warning";
  return "text-status-success";
}

const REACTION_MESSAGES: Record<string, string[]> = {
  FIRED_UP: [
    "That energy runs the whole team. Great shift.",
    "This is the kind of day that builds momentum.",
    "The kitchen felt it. Good work.",
    "You showed up and it showed.",
    "Days like this are what it is all for.",
    "That was a real service. Well done.",
  ],
  GOOD: [
    "Solid. Rest up, you earned it.",
    "Not every day needs to be epic. This one worked.",
    "Consistent work. The best kind.",
    "Good work. Go rest.",
    "A good day is a good day. Take that.",
    "Steady and solid. Nice work.",
  ],
  MEH: [
    "Not every service hits. Tomorrow is fresh.",
    "Steady counts too. You were there.",
    "Some days just drift through. That is fine.",
    "You ran the shift. That is what matters.",
    "Even flat days teach the model something.",
    "Not everything needs to be great. You showed up.",
  ],
  ROUGH: [
    "Rough ones pass. You got through it.",
    "Hard services are the ones that build you.",
    "Take care of yourself tonight.",
    "You showed up on a hard day. That is not nothing.",
    "Some days push back. You kept going.",
    "It was a tough shift. Rest now.",
  ],
};

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

function buildFinancialSnapshot(params: {
  plannedQty: number;
  predictedQty: number;
  unit: string;
  unitPrice?: number | null;
  unitCost?: number | null;
  unitMargin?: number | null;
}) {
  const { plannedQty, predictedQty, unit, unitPrice, unitCost, unitMargin } =
    params;
  const revenueIfSold = unitPrice != null ? plannedQty * unitPrice : null;
  const marginIfSold = unitMargin != null ? plannedQty * unitMargin : null;
  const wasteIfAll = unitCost != null ? plannedQty * unitCost : null;
  const shortfallQty = Math.max(0, predictedQty - plannedQty);
  const lostMarginIfStockout =
    unitMargin != null ? shortfallQty * unitMargin : null;
  return {
    revenueIfSold,
    marginIfSold,
    wasteIfAll,
    shortfallQty,
    lostMarginIfStockout,
    unit,
  };
}

function comparisonTone(
  direction: "up" | "down" | "flat",
  positiveWhen: "up" | "down",
) {
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

function signalToneClasses(
  direction: "up" | "down" | "neutral",
  valuePct: number,
) {
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
  return ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes(
    (unit || "").toUpperCase(),
  );
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

function signalLabel(key: string): string {
  const map: Record<string, string> = {
    reservation: "Reservations",
    event: "Event",
    weather: "Weather",
    staffing: "Staffing",
    kitchen_capacity: "Kitchen capacity",
    delivery_mix: "Delivery mix",
    traffic: "Traffic",
    similar_day: "Similar days",
    local_event: "Local event",
  };
  return map[key] ?? key;
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

function TodayWorkspacePageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const canAccess = Boolean(user?.has_organization);

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const branchOptions = useMemo(() => {
    const accessibleBranchIds = new Set(
      accessibleBranches.map((branch) => branch.id),
    );
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
  }, [
    branches,
    accessibleBranches,
    user?.organization_id,
    user?.organization_name,
  ]);

  const defaultBranch =
    branchOptions.find(
      (branch) => branch.id === accessScope?.default_branch_id,
    ) ??
    branchOptions.find((branch) => branch.is_primary) ??
    branchOptions[0] ??
    null;

  const [targetDate, setTargetDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [branchId, setBranchId] = useState(defaultBranch?.id ?? "");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const [plannedQtyByItem, setPlannedQtyByItem] = useState<
    Record<string, number | "">
  >({});
  const [impactByItem, setImpactByItem] = useState<
    Record<string, ImpactPreview>
  >({});
  const [actionErrorByItem, setActionErrorByItem] = useState<
    Record<string, string>
  >({});
  const [confirmAction, setConfirmAction] = useState<
    null | "START_LIVE" | "CLOSE_DAY"
  >(null);
  const [wasteItem, setWasteItem] = useState<null | {
    id: string;
    title: string;
    unit: string;
  }>(null);
  const [importantItemsOnly, setImportantItemsOnly] = useState(true);
  const [ignoredLiveAlertIds, setIgnoredLiveAlertIds] = useState<string[]>([]);
  const [quietMode, setQuietMode] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvUploadFile, setCsvUploadFile] = useState<File | null>(null);
  const [csvUploadHeaders, setCsvUploadHeaders] = useState<string[]>([]);
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);
  const [csvUploadStatus, setCsvUploadStatus] = useState<string | null>(null);
  const [showCsvImportBanner, setShowCsvImportBanner] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [showOkRows, setShowOkRows] = useState(false);
  const [dayNote, setDayNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [dayReaction, setDayReaction] = useState<"FIRED_UP" | "GOOD" | "MEH" | "ROUGH" | "">("");
  const [ackMessage, setAckMessage] = useState("");
  const [ackVisible, setAckVisible] = useState(false);
  const [ackPending, setAckPending] = useState(false);

  const toggleItemExpand = (id: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const csvUploadSession = useCSVUploadSessionStore();
  const queryClient = useQueryClient();

  const evaluateDebounce = useRef<Record<string, number>>({});
  const initializeAttemptedByKey = useRef<Record<string, boolean>>({});

  const searchParams = useSearchParams();
  useEffect(() => {
    const paramBranchId = searchParams.get("branch_id");
    if (paramBranchId && UUID_PATTERN.test(paramBranchId)) {
      setBranchId(paramBranchId);
    }
    const paramDate = searchParams.get("date");
    if (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) {
      setTargetDate(paramDate);
    }
    setShowCsvImportBanner(searchParams.get("csv_import") === "1");
  }, [searchParams]);

  useEffect(() => {
    if (!branchId && defaultBranch?.id) {
      setBranchId(defaultBranch.id);
    }
  }, [branchId, defaultBranch?.id]);
  useEffect(() => {
    if (!branchId || UUID_PATTERN.test(branchId)) return;
    const normalizedName = branchId.split(" day ")[0].trim();
    const matched = branchOptions.find(
      (branch) => branch.name.toLowerCase() === normalizedName.toLowerCase(),
    );
    if (matched?.id) {
      setBranchId(matched.id);
    } else {
      setBranchId(defaultBranch?.id ?? "");
    }
  }, [branchId, branchOptions, defaultBranch?.id]);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, canAccess]);

  const safeBranchId = UUID_PATTERN.test(branchId) ? branchId : "";
  const { isLoading: subLoading, shouldBlockAccess, gateVariant } = useSubscriptionTier(safeBranchId || undefined);
  const canFetchData = Boolean(safeBranchId) && !subLoading && !shouldBlockAccess;

  const todayQuery = useBranchDayToday(
    { branch_id: safeBranchId, date: targetDate },
    canFetchData,
  );
  const initializeMutation = useInitializeBranchDay();
  const evaluateMutation = useEvaluatePrepPlan();
  const lockPlanMutation = useLockBranchDayPlan();
  const updateBranchDayStatusMutation = useUpdateBranchDayStatus();
  const updateBranchDayNotesMutation = useUpdateBranchDayNotes();
  const createProductionLogMutation = useCreateProductionLog({
    skipInvalidate: true,
  });
  const salesQuickEntryMutation = useSalesManualQuickEntry({
    skipInvalidate: true,
  });
  const ignoreLiveAlertMutation = useIgnoreBranchDayLiveAlert();
  const updatePrepPlanMutation = useUpdatePrepPlanItem();
  const advancedForecastQuery = useAdvancedForecast(
    {
      branch_id: safeBranchId,
      item_id: selectedItemId,
      target_date: targetDate,
    },
    Boolean(safeBranchId && selectedItemId && advancedModalOpen),
  );
  const metricsQuery = useForecastMetrics(
    {
      branch_id: safeBranchId,
      item_id: selectedItemId || undefined,
      lookback_days: 60,
    },
    Boolean(safeBranchId && selectedItemId && advancedModalOpen),
  );
  const dataQualityQuery = useDataQualityReport(
    { branch_id: safeBranchId, days_window: 30 },
    Boolean(safeBranchId && advancedModalOpen),
  );
  const velocityMutation = useRealTimeVelocity();
  const advancedForecast = advancedForecastQuery.data;
  const forecastMetrics = metricsQuery.data;
  const dataQuality = dataQualityQuery.data;
  const velocitySnapshot = velocityMutation.data;
  const [velocityLastUpdated, setVelocityLastUpdated] = useState<Date | null>(
    null,
  );
  const branchDay = initializeMutation.data ?? todayQuery.data;

  useEffect(() => {
    if (!advancedModalOpen || !safeBranchId || !selectedItemId) return;
    advancedForecastQuery.refetch();
    metricsQuery.refetch();
    dataQualityQuery.refetch();
  }, [
    advancedModalOpen,
    safeBranchId,
    selectedItemId,
    advancedForecastQuery,
    metricsQuery,
    dataQualityQuery,
  ]);

  useEffect(() => {
    if (velocitySnapshot) {
      setVelocityLastUpdated(new Date());
    }
  }, [velocitySnapshot]);

  useEffect(() => {
    if (
      !advancedModalOpen ||
      !safeBranchId ||
      !selectedItemId ||
      branchDay?.status !== "LIVE"
    ) {
      return;
    }

    const runVelocityCheck = () => {
      if (velocityMutation.isPending) return;
      velocityMutation.mutate({
        branch_id: safeBranchId,
        item_id: selectedItemId,
        window_minutes: 60,
      });
    };

    runVelocityCheck();
    const interval = window.setInterval(runVelocityCheck, 180000);
    return () => window.clearInterval(interval);
  }, [
    advancedModalOpen,
    safeBranchId,
    selectedItemId,
    branchDay?.status,
    velocityMutation,
  ]);

  useEffect(() => {
    if (showCsvImportBanner) {
      todayQuery.refetch();
    }
  }, [showCsvImportBanner, todayQuery]);

  const initKey =
    safeBranchId && targetDate ? `${safeBranchId}:${targetDate}` : "";
  useEffect(() => {
    if (!todayQuery.isError) return;
    const err = todayQuery.error as {
      status?: number;
      details?: unknown;
    } | null;
    const errDetails =
      err && typeof err === "object" ? (err.details as any) : null;
    const canInitialize =
      err?.status === 404 ||
      Boolean(errDetails?.error?.details?.can_initialize);
    if (
      !canInitialize ||
      !safeBranchId ||
      !initKey ||
      initializeMutation.isPending
    )
      return;
    if (initializeAttemptedByKey.current[initKey]) return;

    initializeAttemptedByKey.current[initKey] = true;
    initializeMutation.mutate({ branch_id: safeBranchId, date: targetDate });
  }, [
    todayQuery.isError,
    todayQuery.error,
    safeBranchId,
    targetDate,
    initializeMutation.isPending,
    initializeMutation.mutate,
    initKey,
  ]);

  useEffect(() => {
    if (!branchDay?.prep_plan_items?.length) return;
    const hasSelected = branchDay.prep_plan_items.some(
      (item) => item.product_id === selectedItemId,
    );
    if (hasSelected) return;
    setSelectedItemId(branchDay.prep_plan_items[0].product_id);
  }, [branchDay?.id, branchDay?.prep_plan_items, selectedItemId]);
  const networkLearnings = useMemo(() => {
    const network = branchDay?.kitchen_intelligence_network;
    if (!network) return [];
    const learnings: Array<{
      label: string;
      detail: string;
      confidence?: number;
    }> = [];
    const activeLocations = network.network_aggregation.active_locations ?? 0;
    const positivePattern = (
      network.network_aggregation.detected_patterns ?? []
    )
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
      .filter(
        (pattern) =>
          pattern.is_validated &&
          pattern.trigger_factor === "rain" &&
          pattern.effect_pct > 0,
      )
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (rainPattern) {
      const supported =
        network.knowledge_transfer.find(
          (row) =>
            row.item_id === rainPattern.item_id &&
            row.trigger_factor === "rain",
        )?.supporting_kitchens_count ?? 0;
      learnings.push({
        label: `Rain increases ${rainPattern.item_name.toLowerCase()} demand`,
        detail: `Validated in ${supported || 1} similar branch${supported === 1 ? "" : "es"}.`,
        confidence: rainPattern.confidence,
      });
    }
    const wastePattern = (network.network_aggregation.cross_location_patterns ??
      [])[0];
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
    const transfer =
      branchDay?.kitchen_intelligence_network?.knowledge_transfer?.[0];
    if (transfer?.suggested_action) return transfer.suggested_action;
    const wastePattern =
      branchDay?.kitchen_intelligence_network?.network_aggregation
        ?.cross_location_patterns?.[0];
    if (!wastePattern) return "No high-confidence network action right now.";
    return `Reduce ${wastePattern.item_name} prep exposure for the next run and monitor sell-through before close.`;
  }, [branchDay?.kitchen_intelligence_network]);
  const selectedPrepItem = useMemo(() => {
    if (!branchDay?.prep_plan_items) return null;
    return (
      branchDay.prep_plan_items.find(
        (item) => item.product_id === selectedItemId,
      ) ?? null
    );
  }, [branchDay?.prep_plan_items, selectedItemId]);

  const openAdvancedModal = (item: { product_id: string }) => {
    if (!safeBranchId) return;
    setSelectedItemId(item.product_id);
    setAdvancedModalOpen(true);
  };

  useEffect(() => {
    if (!branchDay) return;
    const initialPlans: Record<string, number | ""> = {};
    for (const item of branchDay.prep_plan_items) {
      const seedValue = item.planned_quantity ?? item.suggested_quantity;
      initialPlans[item.id] = isDiscreteUnit(item.unit)
        ? Math.round(seedValue)
        : seedValue;
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
      const planned =
        plannedQtyByItem[item.id] === ""
          ? null
          : Number(plannedQtyByItem[item.id]);
      const variance =
        planned == null ? null : planned - item.suggested_quantity;
      const impact = impactByItem[item.id];
      const baseRisk = Math.max(
        item.forecast_context.risk_of_stockout,
        item.forecast_context.risk_of_waste,
      );
      const impactRiskBoost =
        impact == null
          ? 0
          : Math.max(
              Math.max(0, impact.waste_risk_increase) / 100,
              Math.max(0, impact.stockout_risk_change) / 100,
            );
      const riskScore = Math.min(1, baseRisk + impactRiskBoost);
      return { item, planned, variance, impact, riskScore };
    });
    return preparedRows.sort((a, b) => b.riskScore - a.riskScore);
  }, [branchDay, plannedQtyByItem, impactByItem]);

  const forecastRowsByDemand = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          b.item.forecast_context.predicted_orders -
          a.item.forecast_context.predicted_orders,
      ),
    [rows],
  );
  const importantForecastRowIds = useMemo(() => {
    const topDemand = forecastRowsByDemand
      .slice(0, 5)
      .map((row) => row.item.id);
    const highRisk = rows
      .filter((row) => row.riskScore >= 0.35)
      .map((row) => row.item.id);
    const lowConfidence = rows
      .filter((row) => row.item.forecast_context.confidence_score < 0.6)
      .map((row) => row.item.id);
    return new Set([...topDemand, ...highRisk, ...lowConfidence]);
  }, [forecastRowsByDemand, rows]);
  const section2Rows = useMemo(() => {
    if (!importantItemsOnly) return forecastRowsByDemand;
    const filtered = forecastRowsByDemand.filter((row) =>
      importantForecastRowIds.has(row.item.id),
    );
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

  const onPlannedChange = (
    prepPlanItemId: string,
    value: string,
    unit: string,
  ) => {
    const parsed =
      value === "" ? "" : normalizePlannedQuantity(Number(value), unit);
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

  const acceptSuggestion = (
    prepPlanItemId: string,
    suggestedQuantity: number,
    unit: string,
  ) => {
    const normalizedQuantity = normalizePlannedQuantity(
      suggestedQuantity,
      unit,
    );
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
          setPlannedQtyByItem((prev) => ({
            ...prev,
            [prepPlanItemId]: normalizedQuantity,
          }));
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

  const keepMyPlan = (
    prepPlanItemId: string,
    plannedQuantity: number | null,
    unit: string,
  ) => {
    if (plannedQuantity == null || Number.isNaN(plannedQuantity)) return;
    const normalizedQuantity = normalizePlannedQuantity(plannedQuantity, unit);
    updatePrepPlanMutation.mutate(
      {
        prepPlanItemId,
        payload: {
          planned_quantity: normalizedQuantity,
          accepted_suggestion: false,
        },
      },
      {
        onSuccess: () => {
          setPlannedQtyByItem((prev) => ({
            ...prev,
            [prepPlanItemId]: normalizedQuantity,
          }));
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
      },
    );
  };

  const backendDecisionFeedback = (item: {
    decision?: string | null;
    accepted_suggestion?: boolean;
  }) => {
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
    setConfirmAction(null);
    updateBranchDayStatusMutation.mutate(
      {
        branchDayId: branchDay.id,
        payload: { status: "LIVE" },
      },
      {},
    );
  };

  const lockPlan = () => {
    if (!branchDay?.id || isPlanLocked) return;
    lockPlanMutation.mutate({ branchDayId: branchDay.id, payload: {} });
  };

  const closeServiceDay = () => {
    if (!branchDay?.id) return;
    setConfirmAction(null);
    updateBranchDayStatusMutation.mutate(
      {
        branchDayId: branchDay.id,
        payload: { status: "CLOSED" },
      },
      {},
    );
  };

  const openWasteModal = (
    prepPlanItemId: string,
    productTitle: string,
    unit: string,
  ) => {
    setWasteItem({
      id: prepPlanItemId,
      title: productTitle,
      unit,
    });
  };

  const applyOptimisticLiveMonitor = (
    prepPlanItemId: string,
    adjust: (live: { planned: number; additional: number; sold: number }) => {
      additional?: number;
      sold?: number;
    },
  ) => {
    if (!safeBranchId) return null;
    const queryKey = productionIntelligenceQueryKeys.branchDayToday({
      branch_id: safeBranchId,
      date: targetDate,
    });
    const current = queryClient.getQueryData<typeof branchDay>(queryKey);
    if (!current) return null;

    const nextItems = current.prep_plan_items.map((row) => {
      if (row.id !== prepPlanItemId) return row;
      const live = row.live_monitor ?? null;
      const planned =
        live?.planned_qty ??
        row.planned_quantity ??
        row.suggested_quantity ??
        0;
      const additional =
        live?.additional_qty ?? Math.max(row.final_quantity - planned, 0);
      const sold = live?.sold_today ?? 0;
      const delta = adjust({ planned, additional, sold });
      const nextAdditional =
        typeof delta.additional === "number"
          ? Math.max(0, delta.additional)
          : additional;
      const nextSold =
        typeof delta.sold === "number" ? Math.max(0, delta.sold) : sold;
      const totalPrepared = planned + nextAdditional;
      const remaining = Math.max(0, totalPrepared - nextSold);

      const nextLive = {
        ...(live ?? {}),
        planned_qty: planned,
        additional_qty: nextAdditional,
        total_prepared_qty: totalPrepared,
        sold_today: nextSold,
        remaining_qty: remaining,
        risk_engine: live?.risk_engine
          ? {
              ...live.risk_engine,
              remaining_stock: remaining,
            }
          : live?.risk_engine,
      };

      return { ...row, live_monitor: nextLive };
    });

    queryClient.setQueryData(queryKey, {
      ...current,
      prep_plan_items: nextItems,
    });
    return { queryKey, previous: current };
  };

  const logProduction = (
    prepPlanItemId: string,
    quantityProduced: number,
    reason?: string,
  ) => {
    const snapshot = applyOptimisticLiveMonitor(prepPlanItemId, (live) => ({
      additional: live.additional + quantityProduced,
    }));
    createProductionLogMutation.mutate(
      {
        prep_plan_item_id: prepPlanItemId,
        quantity_produced: quantityProduced,
        waste_quantity: 0,
        event_type: "additional",
        reason: reason ?? "Chef decision",
      },
      {
        onSuccess: (data) => {
          if (!data?.live_monitor || !snapshot) return;
          queryClient.setQueryData(
            snapshot.queryKey,
            (existing: typeof branchDay | undefined) => {
              if (!existing) return existing;
              return {
                ...existing,
                prep_plan_items: existing.prep_plan_items.map((row) =>
                  row.id === prepPlanItemId
                    ? { ...row, live_monitor: data.live_monitor }
                    : row,
                ),
              };
            },
          );
        },
        onError: () => {
          if (snapshot) {
            queryClient.setQueryData(snapshot.queryKey, snapshot.previous);
          }
        },
      },
    );
  };

  const logWaste = (prepPlanItemId: string, wasteQuantity: number) => {
    createProductionLogMutation.mutate(
      {
        prep_plan_item_id: prepPlanItemId,
        quantity_produced: 0,
        waste_quantity: wasteQuantity,
      },
      {
        onSuccess: () => setWasteItem(null),
      },
    );
  };

  const quickTapSale = (
    prepPlanItemId: string,
    item: { product_id: string; unit: string },
    quantitySold: number,
  ) => {
    if (!branchId) return;
    const normalizedQty = isDiscreteUnit(item.unit)
      ? Math.round(quantitySold)
      : quantitySold;
    const snapshot = applyOptimisticLiveMonitor(prepPlanItemId, (live) => ({
      sold: live.sold + normalizedQty,
    }));
    salesQuickEntryMutation.mutate(
      {
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
      },
      {
        onSuccess: (data) => {
          const liveMap = data?.live_monitor_by_item ?? {};
          if (!snapshot || !Object.keys(liveMap).length) return;
          queryClient.setQueryData(
            snapshot.queryKey,
            (existing: typeof branchDay | undefined) => {
              if (!existing) return existing;
              return {
                ...existing,
                prep_plan_items: existing.prep_plan_items.map((row) =>
                  liveMap[row.id]
                    ? { ...row, live_monitor: liveMap[row.id] }
                    : row,
                ),
              };
            },
          );
        },
        onError: () => {
          if (snapshot) {
            queryClient.setQueryData(snapshot.queryKey, snapshot.previous);
          }
        },
      },
    );
  };

  const handlePrepareMoreAlert = (alert: {
    id: string;
    prep_plan_item_id: string;
    suggested_prepare_qty: number;
    details: Record<string, string | number | boolean | null>;
  }) => {
    const liveItem = branchDay?.prep_plan_items.find(
      (row) => row.id === alert.prep_plan_item_id,
    );
    if (!liveItem) return;
    const rawQty = Number(alert.suggested_prepare_qty || 0);
    const normalizedQty = isDiscreteUnit(liveItem.unit)
      ? Math.max(1, Math.round(rawQty))
      : Math.max(0.1, rawQty);
    logProduction(liveItem.id, normalizedQty, "Demand spike");
    ignoreLiveAlert(alert.id, {
      prep_plan_item_id: alert.prep_plan_item_id,
      type: "STOCKOUT_RISK",
    });
  };
  const resetCsvUploadState = () => {
    setCsvUploadFile(null);
    setCsvUploadHeaders([]);
    setCsvUploadError(null);
    setCsvUploadStatus(null);
  };

  const handleCsvFileSelect = async (file: File | null) => {
    resetCsvUploadState();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvUploadError("Please upload a .csv file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCsvUploadError("CSV must be 5MB or smaller.");
      return;
    }
    try {
      const parsed = await parseCSVFile(file);
      if (!parsed.headers.length) {
        setCsvUploadError("CSV file is missing a header row.");
        return;
      }
      setCsvUploadFile(file);
      setCsvUploadHeaders(parsed.headers);
      setCsvUploadStatus(`Detected ${parsed.headers.length} columns.`);
    } catch {
      setCsvUploadError("Unable to read this CSV file.");
    }
  };

  const handleCsvDownload = async () => {
    setCsvUploadStatus(null);
    setCsvUploadError(null);
    try {
      const response = await fetch(
        productionIntelligenceEndpoints.posCSVTemplate(),
      );
      if (!response.ok) {
        setCsvUploadError("Unable to download template. Please try again.");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "prepIQ_pos_sales_import_template.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
      setCsvUploadStatus("Template downloaded.");
    } catch {
      setCsvUploadError("Unable to download template. Please try again.");
    }
  };

  const proceedToCsvMapping = () => {
    if (!csvUploadFile || !branchId) {
      setCsvUploadError("Select a CSV file before continuing.");
      return;
    }
    const returnPath = `/workspace/today?branch_id=${branchId}&date=${targetDate}&csv_import=1`;
    csvUploadSession.setSession({
      file: csvUploadFile,
      branchId,
      returnPath,
      targetDate,
    });
    setCsvModalOpen(false);
    router.push("/workspace/today/csv-map");
  };

  useEffect(() => {
    if (!isLive || !branchDay?.id) return;
    if (
      createProductionLogMutation.isPending ||
      salesQuickEntryMutation.isPending
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      todayQuery.refetch();
    }, 20000);
    return () => window.clearInterval(interval);
  }, [
    isLive,
    branchDay?.id,
    todayQuery,
    createProductionLogMutation.isPending,
    salesQuickEntryMutation.isPending,
  ]);

  const loading =
    isLoading ||
    branchesQuery.isLoading ||
    todayQuery.isLoading ||
    initializeMutation.isPending;
  const noBranchContext = !loading && !branchOptions.length;
  const statusLabel = loading
    ? "Loading..."
    : noBranchContext
      ? "No branch assigned"
      : branchDay?.status === "MORNING"
        ? "Planning mode"
        : branchDay?.status === "LIVE"
          ? "Service is live"
          : branchDay?.status === "CLOSED"
            ? "Day closed"
            : branchId
              ? "Setting up..."
              : "Select a branch";
  const todayQueryErrorMessage = useMemo(() => {
    if (!todayQuery.isError) return "";
    const err = todayQuery.error as {
      message?: string;
      details?: unknown;
      status?: number;
    } | null;
    if (!err) return "Unable to load day data.";
    if (typeof err.message === "string" && err.message.length)
      return err.message;
    const details = (err as any)?.details;
    if (typeof details?.message === "string") return details.message;
    if (typeof details?.detail === "string") return details.detail;
    if (typeof details?.error === "string") return details.error;
    return "Unable to load day data.";
  }, [todayQuery.isError, todayQuery.error]);
  const canInitializeDay = useMemo(() => {
    if (!todayQuery.isError) return false;
    const err = todayQuery.error as {
      status?: number;
      details?: unknown;
    } | null;
    const details =
      err && typeof err === "object" ? (err.details as any) : null;
    return (
      err?.status === 404 || Boolean(details?.error?.details?.can_initialize)
    );
  }, [todayQuery.isError, todayQuery.error]);

  const liveRows = useMemo(
    () =>
      (branchDay?.prep_plan_items ?? []).map((item) => {
        const monitor = item.live_monitor;
        const planned =
          monitor?.planned_qty ??
          item.planned_quantity ??
          item.suggested_quantity;
        const additional =
          monitor?.additional_qty ?? Math.max(item.final_quantity - planned, 0);
        const sold = monitor?.sold_today ?? 0;
        const remaining =
          monitor?.remaining_qty ?? Math.max(item.final_quantity - sold, 0);
        return { item, monitor, planned, additional, sold, remaining };
      }),
    [branchDay?.prep_plan_items],
  );
  const liveSmartAlerts = useMemo(
    () =>
      (branchDay?.live_alerts ?? [])
        .filter((alert) => !ignoredLiveAlertIds.includes(alert.id))
        .slice(0, 3),
    [branchDay?.live_alerts, ignoredLiveAlertIds],
  );
  const criticalLiveAlertItemIds = useMemo(
    () =>
      new Set(
        liveSmartAlerts
          .filter(
            (alert) =>
              alert.severity === "HIGH" || alert.severity === "CRITICAL",
          )
          .map((alert) => alert.prep_plan_item_id),
      ),
    [liveSmartAlerts],
  );
  const visibleLiveRows = useMemo(
    () =>
      quietMode
        ? liveRows.filter((row) => criticalLiveAlertItemIds.has(row.item.id))
        : liveRows,
    [quietMode, liveRows, criticalLiveAlertItemIds],
  );
  const stockoutWatchCount = useMemo(
    () =>
      liveRows.filter((row) => (row.monitor?.stockout_risk_score ?? 0) >= 0.7)
        .length,
    [liveRows],
  );
  const overproductionWatchCount = useMemo(
    () =>
      liveRows.filter(
        (row) => (row.monitor?.overproduction_risk_score ?? 0) >= 0.7,
      ).length,
    [liveRows],
  );

  // Tier rows for live monitor: critical → watch → ok
  const { criticalRows, watchRows, okRows } = useMemo(() => {
    const crit: typeof liveRows = [];
    const watch: typeof liveRows = [];
    const ok: typeof liveRows = [];
    for (const row of liveRows) {
      const sr = row.monitor?.risk_engine?.stockout_risk ?? "LOW";
      const wr = row.monitor?.risk_engine?.waste_risk ?? "LOW";
      if (sr === "HIGH") crit.push(row);
      else if (sr === "MEDIUM" || wr === "HIGH" || wr === "MEDIUM") watch.push(row);
      else ok.push(row);
    }
    return { criticalRows: crit, watchRows: watch, okRows: ok };
  }, [liveRows]);

  const demandDeltaPct = useMemo(
    () =>
      branchDay
        ? (branchDay.demand_signal.expected_demand_delta_pct ??
          (branchDay.demand_signal.expected_demand_index - 1) * 100)
        : 0,
    [branchDay],
  );
  const demandSignals = useMemo(() => {
    if (!branchDay) return FALLBACK_DEMAND_SIGNALS;
    return branchDay.demand_signal.signals?.length
      ? branchDay.demand_signal.signals
      : FALLBACK_DEMAND_SIGNALS;
  }, [branchDay]);
  const prepConfidenceGauge = useMemo(() => {
    if (!rows.length || !branchDay) return 0;
    const avgItemConfidence =
      rows.reduce(
        (sum, row) => sum + row.item.forecast_context.confidence_score,
        0,
      ) / rows.length;
    const avgRisk =
      rows.reduce((sum, row) => sum + row.riskScore, 0) / rows.length;
    const base =
      branchDay.demand_signal.forecast_confidence * 0.45 +
      avgItemConfidence * 0.4 +
      (1 - avgRisk) * 0.15;
    return Math.max(0, Math.min(1, base));
  }, [rows, branchDay]);
  const prepConfidenceRiskLabel = useMemo(() => {
    if (prepConfidenceGauge >= 0.75) return "Low";
    if (prepConfidenceGauge >= 0.55) return "Medium";
    return "High";
  }, [prepConfidenceGauge]);
  const decisionSummary = useMemo(() => {
    const reviewed = rows.filter((row) => row.planned != null).length;
    const accepted = rows.filter(
      (row) =>
        row.item.decision === "ACCEPTED_AI" || row.item.accepted_suggestion,
    ).length;
    const overridden = rows.filter(
      (row) => row.item.decision === "CHEF_OVERRIDE",
    ).length;
    const projectedWaste = rows.length
      ? (rows.reduce(
          (sum, row) => sum + row.item.forecast_context.risk_of_waste,
          0,
        ) /
          rows.length) *
        100
      : 0;
    const avgDeviation = rows.length
      ? rows.reduce((sum, row) => sum + Math.abs(row.variance ?? 0), 0) /
        rows.length
      : 0;
    const avgSuggested = rows.length
      ? rows.reduce(
          (sum, row) => sum + Math.max(1, row.item.suggested_quantity),
          0,
        ) / rows.length
      : 1;
    const accuracyImpact = Math.max(
      -5,
      Math.min(5, ((avgSuggested - avgDeviation) / avgSuggested - 0.5) * 4),
    );
    return { reviewed, accepted, overridden, projectedWaste, accuracyImpact };
  }, [rows]);
  const morningRiskAlerts = useMemo(() => {
    const candidates = rows
      .filter(
        (row) =>
          row.riskScore >= 0.45 ||
          row.item.forecast_context.confidence_score < 0.65 ||
          Math.abs(row.variance ?? 0) > row.item.suggested_quantity * 0.15,
      )
      .slice(0, 3);
    return candidates.map(({ item, riskScore, impact, planned, variance }) => {
      const confidence = confidenceLabel(
        item.forecast_context.confidence_score,
      );
      const stockoutRiskPct = item.forecast_context.risk_of_stockout * 100;
      const wasteRiskPct = item.forecast_context.risk_of_waste * 100;
      const plannedQty = planned ?? item.suggested_quantity;
      const shortfallQty = Math.max(0, item.suggested_quantity - plannedQty);
      const overprepQty = Math.max(0, plannedQty - item.suggested_quantity);
      const suggestedBuffer = Math.max(
        1,
        isDiscreteUnit(item.unit)
          ? Math.round(item.suggested_quantity * 0.08)
          : Number((item.suggested_quantity * 0.08).toFixed(2)),
      );
      const primaryRiskType =
        stockoutRiskPct >= wasteRiskPct && stockoutRiskPct >= 42
          ? "STOCKOUT"
          : wasteRiskPct >= 38
            ? "WASTE"
            : "MARGIN";
      const primaryRiskSeverity =
        riskScore >= 0.65 || stockoutRiskPct >= 60 || wasteRiskPct >= 60
          ? "HIGH"
          : riskScore >= 0.45 || stockoutRiskPct >= 45 || wasteRiskPct >= 45
            ? "MEDIUM"
            : "WATCH";
      const drivers: string[] = [
        `Your current plan is ${formatQuantity(plannedQty, item.unit)} vs suggested ${formatQuantity(item.suggested_quantity, item.unit)}.`,
        `Expected orders: ${Math.round(item.forecast_context.predicted_orders)}. Forecast confidence: ${confidence} (${percent(item.forecast_context.confidence_score)}).`,
      ];
      if (primaryRiskType === "STOCKOUT") {
        drivers.push(
          shortfallQty > 0
            ? `At this plan, you are ${formatQuantity(shortfallQty, item.unit)} below baseline, increasing stockout exposure.`
            : "Demand pressure is high for this item; consider a protective buffer.",
        );
      }
      if (primaryRiskType === "WASTE") {
        drivers.push(
          overprepQty > 0
            ? `At this plan, you are ${formatQuantity(overprepQty, item.unit)} above baseline, increasing waste exposure.`
            : "Sell-through signal is weaker than usual for this item.",
        );
      }
      if (primaryRiskType === "MARGIN" && impact) {
        drivers.push(
          `Current deviation can shift estimated margin by ${formatSignedCurrency(impact.margin_impact_estimate)}.`,
        );
      }
      const suggestedFixQty =
        primaryRiskType === "STOCKOUT"
          ? isDiscreteUnit(item.unit)
            ? Math.round(item.suggested_quantity + suggestedBuffer)
            : Number((item.suggested_quantity + suggestedBuffer).toFixed(2))
          : primaryRiskType === "WASTE"
            ? isDiscreteUnit(item.unit)
              ? Math.round(item.suggested_quantity - suggestedBuffer * 0.5)
              : Number(
                  (item.suggested_quantity - suggestedBuffer * 0.5).toFixed(2),
                )
            : isDiscreteUnit(item.unit)
              ? Math.round(item.suggested_quantity)
              : item.suggested_quantity;
      const financials = buildFinancialSnapshot({
        plannedQty,
        predictedQty: item.forecast_context.predicted_quantity_needed,
        unit: item.unit,
        unitPrice: item.forecast_context.unit_price,
        unitCost: item.forecast_context.unit_cost,
        unitMargin: item.forecast_context.unit_margin,
      });
      const hasPricing =
        item.forecast_context.unit_price != null ||
        item.forecast_context.unit_cost != null ||
        item.forecast_context.unit_margin != null;
      return {
        id: item.id,
        itemName: item.product_title,
        unit: item.unit,
        riskType: primaryRiskType,
        severity: primaryRiskSeverity,
        title: `${primaryRiskType} RISK`,
        detail: `Risk of ${primaryRiskType === "STOCKOUT" ? "running out" : primaryRiskType === "WASTE" ? "overproduction waste" : "margin loss"} is ${primaryRiskSeverity.toLowerCase()} right now based on your current plan input.`,
        riskMetrics: {
          stockoutRiskPct,
          wasteRiskPct,
          marginImpact: impact?.margin_impact_estimate ?? 0,
          variance: variance ?? 0,
          suggestedBuffer,
        },
        varianceLabel: signedQuantity(variance ?? 0, item.unit),
        bufferLabel: formatQuantity(suggestedBuffer, item.unit),
        suggestedFixQty,
        drivers,
        impact,
        financials,
        hasPricing,
      };
    });
  }, [rows]);

  const outlookActionSentence = useMemo(() => {
    if (!branchDay || !rows.length) return null;
    const delta = demandDeltaPct;
    const directionWord = delta >= 2 ? "up" : delta <= -2 ? "down" : "steady";
    const deltaPlan =
      delta >= 2
        ? `+${Math.round(Math.abs(delta))}%`
        : delta <= -2
          ? `${Math.round(delta)}%`
          : null;
    const topRiskItems = rows
      .filter((row) => row.riskScore >= 0.35)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 2)
      .map((row) => row.item.product_title);
    const topDemandItems = forecastRowsByDemand
      .slice(0, 2)
      .map((row) => row.item.product_title);
    const priorityItems = topRiskItems.length ? topRiskItems : topDemandItems;
    if (directionWord === "steady") {
      return priorityItems.length
        ? `Maintain baseline prep. Watch ${priorityItems.join(" and ")} — they carry the highest risk today.`
        : "Maintain baseline prep across all items. No elevated signals.";
    }
    const planAction = deltaPlan ? `Plan ${deltaPlan} across all items.` : "";
    return priorityItems.length
      ? `${planAction} Prioritize ${priorityItems.join(" and ")} — ${directionWord === "up" ? "most sensitive to demand surges" : "most exposed to waste risk"}.`
      : `${planAction} Review high-demand items before locking plan.`;
  }, [branchDay, rows, demandDeltaPct, forecastRowsByDemand]);

  const demandMeterPosition = useMemo(() => {
    const clamped = Math.max(-20, Math.min(20, demandDeltaPct));
    return ((clamped + 20) / 40) * 100;
  }, [demandDeltaPct]);

  const ignoreLiveAlert = (
    alertId: string,
    alert?: {
      prep_plan_item_id: string;
      type: "STOCKOUT_RISK" | "WASTE_RISK" | "SALES_SPIKE";
    },
  ) => {
    setIgnoredLiveAlertIds((prev) =>
      prev.includes(alertId) ? prev : [...prev, alertId],
    );
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
      title="Today's Kitchen"
      description="Review your forecast, confirm production targets, and execute with precision."
      insight="Each decision — accepted or overridden — sharpens the forecast. The system learns from every shift."
    >
      {/* Slim context bar — no heavy card */}
      <div className="mb-8 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-6">
        <div className="flex-1 min-w-[180px] max-w-xs">
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
            placeholder={
              noBranchContext ? "No branches available" : "Select branch"
            }
          />
        </div>

        <div className="flex-1 min-w-[160px] max-w-xs">
          <OperationalCalendar
            label="Date"
            value={targetDate}
            onChange={setTargetDate}
          />
        </div>

        <div className="flex items-center gap-2 pb-1">
          <span
            className={`h-2 w-2 rounded-full ${
              loading
                ? "bg-text-muted animate-pulse"
                : noBranchContext
                  ? "bg-status-critical"
                  : branchDay?.status === "LIVE"
                    ? "bg-status-success animate-pulse"
                    : branchDay
                      ? "bg-status-success"
                      : "bg-status-warning"
            }`}
          />
          <p className="text-sm text-text-muted">{statusLabel}</p>
        </div>
      </div>

      {safeBranchId && !subLoading && shouldBlockAccess ? (
        <SubscriptionRequiredState variant={gateVariant} compact />
      ) : (
        <>
      {todayQuery.isError ? (
        <div className={`mb-6 rounded-r-lg border-l-4 px-4 py-3 text-xs transition-colors ${
          initializeMutation.isPending
            ? "border-l-brand-gold bg-brand-gold/8 text-brand-gold"
            : "border-l-status-warning bg-status-warning/8 text-status-warning"
        }`}>
          {initializeMutation.isPending ? (
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-brand-gold border-t-transparent animate-spin shrink-0" />
              <p className="font-semibold">Setting up your day&hellip;</p>
            </div>
          ) : (
            <>
              <p className="font-semibold">Day data not available.</p>
              <p className="mt-1 text-text-secondary">{todayQueryErrorMessage}</p>
              {canInitializeDay && safeBranchId ? (
                <button
                  type="button"
                  disabled={initializeMutation.isPending}
                  onClick={() =>
                    initializeMutation.mutate({
                      branch_id: safeBranchId,
                      date: targetDate,
                    })
                  }
                  className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full border border-status-warning/50 px-3 text-xs font-semibold text-status-warning hover:bg-status-warning/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Initialize Day
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {noBranchContext ? (
        <div className="mt-8 py-16 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-status-warning/20 mb-4">
            <Shop className="h-6 w-6 text-status-warning" />
          </div>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            No branch context is available for this account yet. Assign this
            user to at least one active branch, then refresh this page.
          </p>
        </div>
      ) : null}

      {isMorning && branchDay ? (
        <>
          {/* ── Morning Brief — always visible, no click required ── */}
          <div className="mb-8 pb-8 border-b border-surface-4/50">
            <div className="flex flex-wrap items-start gap-8">
              {/* Demand KPI + meter */}
              <div className="shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Expected demand
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span
                    className={`font-display text-4xl font-semibold tracking-[-0.5px] ${
                      demandDeltaPct >= 2
                        ? "text-status-success"
                        : demandDeltaPct <= -2
                          ? "text-status-warning"
                          : "text-text-primary"
                    }`}
                  >
                    {toPercent(demandDeltaPct)}
                  </span>
                  <span className="text-sm text-text-muted">
                    {demandDeltaPct <= -2
                      ? "quieter than usual"
                      : demandDeltaPct >= 2
                        ? "busier than usual"
                        : "about normal"}
                  </span>
                </div>
                <div className="mt-3 relative h-[3px] w-40 rounded-full bg-surface-4">
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-brand-gold shadow-sm"
                    style={{ left: `calc(${demandMeterPosition}% - 6px)` }}
                  />
                </div>
                <div className="mt-1 flex w-40 justify-between text-[9px] text-text-muted/60">
                  <span>Quiet</span>
                  <span>Normal</span>
                  <span>Busy</span>
                </div>
              </div>

              {/* Vertical divider */}
              <div className="hidden sm:block w-px self-stretch bg-surface-4/60" />

              {/* Signal chips + action sentence */}
              <div className="flex-1 min-w-[180px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Demand signals
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {demandSignals.slice(0, 4).map((signal) => (
                    <span
                      key={signal.key}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${signalToneClasses(signal.direction, signal.value_pct)}`}
                    >
                      {signal.label}
                      <span className="font-semibold">
                        {signal.direction === "neutral" ? "—" : toPercent(signal.value_pct)}
                      </span>
                    </span>
                  ))}
                </div>
                {outlookActionSentence ? (
                  <p className="mt-3 text-xs text-text-secondary">
                    <span className="mr-1 font-semibold text-brand-gold">→</span>
                    {outlookActionSentence}
                  </p>
                ) : null}
              </div>

              {/* Vertical divider */}
              <div className="hidden sm:block w-px self-stretch bg-surface-4/60" />

              {/* Plan reliability */}
              <div className="shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Plan reliability
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-semibold tracking-[-0.5px] text-text-primary">
                    {percent(prepConfidenceGauge)}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      prepConfidenceRiskLabel === "Low"
                        ? "text-status-success"
                        : prepConfidenceRiskLabel === "Medium"
                          ? "text-status-warning"
                          : "text-status-critical"
                    }`}
                  >
                    {prepConfidenceRiskLabel === "Low"
                      ? "Good shape"
                      : prepConfidenceRiskLabel === "Medium"
                        ? "Review items"
                        : "Check alerts"}
                  </span>
                </div>
                <div className="mt-2 h-[3px] w-40 overflow-hidden rounded-full bg-surface-4">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      prepConfidenceRiskLabel === "Low"
                        ? "bg-status-success"
                        : prepConfidenceRiskLabel === "Medium"
                          ? "bg-status-warning"
                          : "bg-status-critical"
                    }`}
                    style={{ width: percent(prepConfidenceGauge) }}
                  />
                </div>
                <div className="mt-2 flex gap-6 text-[11px]">
                  <div>
                    <p className="text-text-muted">Needs attention</p>
                    <p className="font-semibold text-text-primary">
                      {branchDay.morning_overview?.high_risk_items ?? branchDay.demand_signal.high_risk_items ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Tracked</p>
                    <p className="font-semibold text-text-primary">
                      {branchDay.demand_signal.tracked_items ?? rows.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Risk alerts — shown above the table when present ── */}
          {morningRiskAlerts.length > 0 && !isPlanLocked ? (
            <div className="mb-6 space-y-2">
              {morningRiskAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start justify-between gap-4 rounded-r-xl border-l-4 px-4 py-3 ${
                    alert.severity === "HIGH"
                      ? "border-l-status-critical bg-status-critical/8"
                      : "border-l-status-warning bg-status-warning/8"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${alert.severity === "HIGH" ? "text-status-critical" : "text-status-warning"}`}>
                      {alert.itemName} ·{" "}
                      {alert.riskType === "STOCKOUT" ? "May run out" : alert.riskType === "WASTE" ? "Risk of waste" : "Margin at risk"}
                    </p>
                    <p className="mt-0.5 text-sm text-text-secondary">
                      {alert.riskType === "STOCKOUT"
                        ? "Stockout risk. Your current plan falls short of projected demand."
                        : alert.riskType === "WASTE"
                          ? "Waste exposure detected. Demand signal is weaker than your current prep."
                          : "Margin variance. Deviation from forecast affects estimated contribution."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onPlannedChange(alert.id, String(alert.suggestedFixQty), alert.unit);
                      acceptSuggestion(alert.id, alert.suggestedFixQty, alert.unit);
                    }}
                    disabled={isPlanLocked}
                    className={`shrink-0 inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                      alert.severity === "HIGH"
                        ? "border-status-critical/40 bg-status-critical/10 text-status-critical hover:bg-status-critical/20"
                        : "border-status-warning/40 bg-status-warning/10 text-status-warning hover:bg-status-warning/20"
                    }`}
                  >
                    Fix → {formatQuantity(alert.suggestedFixQty, alert.unit)}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* ── Prep table — the main event ── */}
          <section className="mb-11">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Prep Plan
                </p>
                <h3 className="font-display text-xl font-semibold text-text-primary sm:text-2xl">
                  What to cook today
                </h3>
                {/* Inline stats — no cards */}
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-secondary">
                  <span>
                    <span className="font-semibold text-text-primary">{decisionSummary.reviewed}</span>
                    {" "}of {forecastRowsByDemand.length} reviewed
                  </span>
                  {(branchDay.morning_overview?.projected_margin_total ?? 0) > 0 ? (
                    <span>
                      Projected margin:{" "}
                      <span className="font-semibold text-status-success">
                        {formatCurrency(branchDay.morning_overview?.projected_margin_total ?? 0)}
                      </span>
                    </span>
                  ) : null}
                  {branchDay.morning_overview?.chef_accuracy_score?.available ? (
                    <span>
                      Your accuracy:{" "}
                      <span className="font-semibold text-text-primary">
                        {branchDay.morning_overview.chef_accuracy_score.chef_forecast_accuracy_pct.toFixed(1)}%
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
              {/* Primary CTAs — prominent, right-aligned */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportantItemsOnly((prev) => !prev)}
                  className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/50 hover:text-brand-gold"
                >
                  {importantItemsOnly ? "Priority items" : "All items"}
                </button>
                <button
                  type="button"
                  onClick={lockPlan}
                  disabled={isPlanLocked || lockPlanMutation.isPending}
                  className="inline-flex h-10 items-center rounded-full border border-surface-4 px-5 text-sm font-semibold text-text-primary transition-all duration-200 hover:border-status-success/60 hover:text-status-success active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPlanLocked ? "Plan locked ✓" : lockPlanMutation.isPending ? "Locking..." : "Lock plan"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction("START_LIVE")}
                  disabled={updateBranchDayStatusMutation.isPending || !isPlanLocked}
                  className="inline-flex h-10 items-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-[#141416] transition-all duration-200 hover:bg-[#B8962E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updateBranchDayStatusMutation.isPending ? "Starting..." : "Start service →"}
                </button>
              </div>
            </div>
            {!isPlanLocked ? (
              <p className="mb-4 text-xs text-text-muted">Lock the plan first, then start service.</p>
            ) : branchDay?.plan_lock?.locked_at ? (
              <p className="mb-4 text-xs text-status-success">
                Locked at{" "}
                {new Date(branchDay.plan_lock.locked_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                {branchDay.plan_lock.locked_by?.name ? ` by ${branchDay.plan_lock.locked_by.name}` : ""}.
              </p>
            ) : null}

            {/* ── Mobile cards ── */}
            <div className="lg:hidden space-y-2">
              {section2Rows.map(({ item, riskScore, planned, variance, impact }) => {
                const plannedQty = planned ?? item.suggested_quantity;
                const financials = buildFinancialSnapshot({
                  plannedQty,
                  predictedQty: item.forecast_context.predicted_quantity_needed,
                  unit: item.unit,
                  unitPrice: item.forecast_context.unit_price,
                  unitCost: item.forecast_context.unit_cost,
                  unitMargin: item.forecast_context.unit_margin,
                });
                const hasPricing =
                  item.forecast_context.unit_price != null ||
                  item.forecast_context.unit_cost != null ||
                  item.forecast_context.unit_margin != null;
                const isAccepted = item.decision === "ACCEPTED_AI" || item.accepted_suggestion;
                const isOverride = item.decision === "CHEF_OVERRIDE";
                const isExpanded = expandedItemIds.has(item.id);

                return (
                  <article
                    key={`mobile-forecast-${item.id}`}
                    className={`overflow-hidden rounded-xl border bg-surface-2 transition-colors ${
                      isAccepted
                        ? "border-l-[3px] border-l-status-success/70 border-status-success/30"
                        : isOverride
                          ? "border-l-[3px] border-l-status-warning/70 border-status-warning/30"
                          : riskScore >= 0.45
                            ? "border-l-[3px] border-l-status-critical/50 border-status-critical/25"
                            : "border-surface-4"
                    }`}
                  >
                    {/* Row 1: identity + risk badge */}
                    <div className="flex items-start justify-between gap-3 px-4 pt-4">
                      <div className="flex items-start gap-3">
                        {item.product_image_url ? (
                          <img
                            src={item.product_image_url}
                            alt={item.product_title}
                            className="h-10 w-10 shrink-0 rounded-lg border border-surface-4 object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-surface-4 bg-surface-3 text-[10px] font-bold text-text-muted">
                            {item.product_title.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-text-primary">
                            {item.product_title}
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {popularityLabel(forecastRankById[item.id] ?? 999)}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskTone(riskScore)}`}>
                        {riskLabel(riskScore)}
                      </span>
                    </div>

                    {/* Row 2: AI suggests / Your plan — flat, no nested cards */}
                    <div className="mt-3 grid grid-cols-2 divide-x divide-surface-4/60 border-y border-surface-4/60">
                      <div className="px-4 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          AI suggests
                        </p>
                        <p className="mt-1 font-display text-lg font-semibold text-text-primary">
                          {formatQuantity(item.suggested_quantity, item.unit)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-text-muted">
                          ~{Math.round(item.forecast_context.predicted_orders)} orders ·{" "}
                          {confidenceLabel(item.forecast_context.confidence_score)}
                        </p>
                      </div>
                      <div className="px-4 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          Your plan
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <input
                            type="number"
                            step={isDiscreteUnit(item.unit) ? 1 : 0.01}
                            value={plannedQtyByItem[item.id] ?? ""}
                            onChange={(e) => onPlannedChange(item.id, e.target.value, item.unit)}
                            disabled={isPlanLocked}
                            className="h-8 w-20 rounded-lg border border-surface-4 bg-surface-3 px-2.5 text-sm font-semibold text-text-primary transition-colors focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 disabled:opacity-60"
                          />
                          <span className="text-xs text-text-muted">{item.unit}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-text-muted">
                          {variance == null || variance === 0
                            ? "Matches suggestion"
                            : variance > 0
                              ? `${signedQuantity(variance, item.unit)} above`
                              : `${signedQuantity(variance, item.unit)} below`}
                        </p>
                      </div>
                    </div>

                    {/* Row 3: actions */}
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => acceptSuggestion(item.id, item.suggested_quantity, item.unit)}
                          disabled={isPlanLocked}
                          className="inline-flex h-8 items-center rounded-full border border-status-success/40 bg-status-success/15 px-3 text-xs font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success/30"
                        >
                          ✓ Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => keepMyPlan(item.id, planned, item.unit)}
                          disabled={isPlanLocked}
                          className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/20"
                        >
                          Keep mine
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleItemExpand(item.id)}
                          className="text-[11px] font-semibold text-brand-gold hover:text-brand-gold/80 transition-colors"
                        >
                          {isExpanded ? "Hide ↑" : "Why? ↓"}
                        </button>
                        <Link
                          href={`/workspace/today/item/${item.id}?branch=${safeBranchId}&date=${targetDate}&title=${encodeURIComponent(item.product_title)}&product_id=${item.product_id}&org=${user?.organization_id ?? ""}`}
                          className="text-[11px] font-medium text-brand-gold/70 hover:text-brand-gold transition-colors"
                        >
                          Deep dive ↗
                        </Link>
                        <Link
                          href={`/workspace/items/${item.product_id}?branch=${safeBranchId}`}
                          className="text-[11px] font-medium text-text-muted hover:text-brand-gold transition-colors"
                        >
                          Track record ↗
                        </Link>
                      </div>
                    </div>

                    {/* Decision feedback */}
                    {actionErrorByItem[item.id] ? (
                      <p className="px-4 pb-3 text-xs text-status-critical">
                        {actionErrorByItem[item.id]}
                      </p>
                    ) : backendDecisionFeedback(item) ? (
                      <p
                        className={`px-4 pb-3 text-xs ${
                          backendDecisionFeedback(item)?.tone === "success"
                            ? "text-status-success"
                            : "text-status-warning"
                        }`}
                      >
                        {backendDecisionFeedback(item)?.message}
                      </p>
                    ) : null}

                    {/* Why this quantity — toggleable, full-width */}
                    {isExpanded ? (
                      <div className="space-y-2.5 border-t border-surface-4/60 bg-surface-3/20 px-4 py-3 text-[11px] text-text-secondary">
                        <div className="space-y-0.5">
                          {item.forecast_context.reasoning.map((line) => (
                            <p key={`mobile-r-${item.id}-${line}`}>{line}</p>
                          ))}
                        </div>
                        {item.forecast_context.applied_signals ? (
                          <div className="border-t border-surface-4/40 pt-2">
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                              Signal adjustments
                            </p>
                            <div className="space-y-1">
                              {Object.entries(item.forecast_context.applied_signals).map(([key, signal]: [string, any]) => {
                                const modifier = signal?.modifier ?? 0;
                                if (Math.abs(modifier) < 0.005) return null;
                                return (
                                  <div key={key} className="flex items-center justify-between">
                                    <span className="text-text-secondary">{signalLabel(key)}</span>
                                    <span className={`font-semibold ${modifier > 0 ? "text-status-success" : "text-status-warning"}`}>
                                      {modifier > 0 ? "↑" : "↓"} {(Math.abs(modifier) * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        {impact ? (
                          <p className="border-t border-surface-4/40 pt-2">
                            Margin impact:{" "}
                            <span className={`font-semibold ${impact.margin_impact_estimate >= 0 ? "text-status-success" : "text-status-critical"}`}>
                              {formatSignedCurrency(impact.margin_impact_estimate)}
                            </span>
                          </p>
                        ) : null}
                        {hasPricing ? (
                          <div className="space-y-0.5 border-t border-surface-4/40 pt-2">
                            {financials.revenueIfSold != null && (
                              <p>
                                If sold out:{" "}
                                <span className="font-semibold text-text-primary">{formatCurrency(financials.revenueIfSold)}</span>{" "}
                                revenue{financials.marginIfSold != null ? ` · ${formatCurrency(financials.marginIfSold)} margin` : ""}
                              </p>
                            )}
                            {financials.wasteIfAll != null && (
                              <p>
                                If wasted:{" "}
                                <span className="font-semibold text-text-primary">{formatCurrency(financials.wasteIfAll)}</span>{" "}
                                in food cost.
                              </p>
                            )}
                            {financials.lostMarginIfStockout != null && financials.shortfallQty > 0 && (
                              <p>
                                If you stock out by{" "}
                                <span className="font-semibold text-text-primary">{formatQuantity(financials.shortfallQty, financials.unit)}</span>,{" "}
                                you could lose{" "}
                                <span className="font-semibold text-text-primary">{formatCurrency(financials.lostMarginIfStockout)}</span>{" "}
                                margin.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="border-t border-surface-4/40 pt-2 text-text-muted">
                            Add selling price and cost to unlock financial scenarios.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 lg:block">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-surface-4/80 bg-surface-3/40">
                  <tr>
                    <th className="w-[200px] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      AI Suggests
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Confidence
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      Your Plan
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {/* actions */}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4/50">
                  {section2Rows.map(({ item, riskScore, planned, variance, impact }) => {
                    const plannedQty = planned ?? item.suggested_quantity;
                    const financials = buildFinancialSnapshot({
                      plannedQty,
                      predictedQty: item.forecast_context.predicted_quantity_needed,
                      unit: item.unit,
                      unitPrice: item.forecast_context.unit_price,
                      unitCost: item.forecast_context.unit_cost,
                      unitMargin: item.forecast_context.unit_margin,
                    });
                    const hasPricing =
                      item.forecast_context.unit_price != null ||
                      item.forecast_context.unit_cost != null ||
                      item.forecast_context.unit_margin != null;
                    const isAccepted = item.decision === "ACCEPTED_AI" || item.accepted_suggestion;
                    const isOverride = item.decision === "CHEF_OVERRIDE";
                    const isExpanded = expandedItemIds.has(item.id);
                    const accentClass = isAccepted
                      ? "border-l-[3px] border-l-status-success/70"
                      : isOverride
                        ? "border-l-[3px] border-l-status-warning/70"
                        : riskScore >= 0.45
                          ? "border-l-[3px] border-l-status-critical/50"
                          : "border-l-[3px] border-l-transparent";

                    return (
                      <Fragment key={item.id}>
                        <tr
                          className={`align-top transition-colors hover:bg-surface-3/20 ${accentClass} ${
                            isAccepted ? "bg-status-success/[0.025]" : isOverride ? "bg-status-warning/[0.025]" : ""
                          }`}
                        >
                          {/* Item */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {item.product_image_url ? (
                                <img
                                  src={item.product_image_url}
                                  alt={item.product_title}
                                  className="h-9 w-9 shrink-0 rounded-lg border border-surface-4 object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-4 bg-surface-3 text-[10px] font-bold text-text-muted">
                                  {item.product_title.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-semibold leading-tight text-text-primary">
                                  {item.product_title}
                                </p>
                                <p className="mt-0.5 text-[11px] text-text-muted">
                                  {popularityLabel(forecastRankById[item.id] ?? 999)}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* AI Suggests */}
                          <td className="px-4 py-4">
                            <p className="font-display text-lg font-semibold text-text-primary">
                              {formatQuantity(item.suggested_quantity, item.unit)}
                            </p>
                            <p className="mt-0.5 text-xs text-text-muted">
                              ~{Math.round(item.forecast_context.predicted_orders)} orders
                            </p>
                          </td>

                          {/* Confidence + Risk */}
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold text-text-primary">
                              {percent(item.forecast_context.confidence_score)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-text-muted">
                              {confidenceLabel(item.forecast_context.confidence_score)}
                            </p>
                            <span className={`mt-1.5 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${riskTone(riskScore)}`}>
                              {riskLabel(riskScore)} risk
                            </span>
                          </td>

                          {/* Your Plan */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step={isDiscreteUnit(item.unit) ? 1 : 0.01}
                                value={plannedQtyByItem[item.id] ?? ""}
                                onChange={(e) => onPlannedChange(item.id, e.target.value, item.unit)}
                                disabled={isPlanLocked}
                                className="h-8 w-24 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm font-semibold text-text-primary transition-colors focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30 disabled:opacity-60"
                              />
                              <span className="text-xs text-text-muted">{item.unit}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-text-muted">
                              {variance == null || variance === 0
                                ? "Matches suggestion"
                                : variance > 0
                                  ? `${signedQuantity(variance, item.unit)} above`
                                  : `${signedQuantity(variance, item.unit)} below`}
                            </p>
                            {actionErrorByItem[item.id] ? (
                              <p className="mt-1 text-[11px] text-status-critical">
                                {actionErrorByItem[item.id]}
                              </p>
                            ) : backendDecisionFeedback(item) ? (
                              <p
                                className={`mt-1 text-[11px] ${
                                  backendDecisionFeedback(item)?.tone === "success"
                                    ? "text-status-success"
                                    : "text-status-warning"
                                }`}
                              >
                                {backendDecisionFeedback(item)?.message}
                              </p>
                            ) : null}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => acceptSuggestion(item.id, item.suggested_quantity, item.unit)}
                                disabled={isPlanLocked}
                                className="inline-flex h-7 items-center rounded-full border border-status-success/40 bg-status-success/15 px-3 text-xs font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success/30"
                              >
                                ✓ Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => keepMyPlan(item.id, planned, item.unit)}
                                disabled={isPlanLocked}
                                className="inline-flex h-7 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/20"
                              >
                                Keep mine
                              </button>
                            </div>
                            <div className="mt-1.5 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => toggleItemExpand(item.id)}
                                className="text-[11px] font-semibold text-brand-gold transition-colors hover:text-brand-gold/80"
                              >
                                {isExpanded ? "Hide ↑" : "Why this number? ↓"}
                              </button>
                              <Link
                                href={`/workspace/today/item/${item.id}?branch=${safeBranchId}&date=${targetDate}&title=${encodeURIComponent(item.product_title)}&product_id=${item.product_id}&org=${user?.organization_id ?? ""}`}
                                className="text-[11px] font-medium text-brand-gold/70 transition-colors hover:text-brand-gold"
                              >
                                Deep dive ↗
                              </Link>
                              <Link
                                href={`/workspace/items/${item.product_id}?branch=${safeBranchId}`}
                                className="text-[11px] font-medium text-text-muted transition-colors hover:text-brand-gold"
                              >
                                Track record ↗
                              </Link>
                            </div>
                          </td>
                        </tr>

                        {/* Expand row — full-width reasoning panel */}
                        {isExpanded ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="border-b border-surface-4/50 bg-surface-3/20 px-6 pb-5 pt-0"
                            >
                              <div className="grid grid-cols-1 gap-4 pt-3 text-[11px] text-text-secondary md:grid-cols-2 lg:grid-cols-3">
                                {/* Reasoning */}
                                <div>
                                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                    Why this quantity
                                  </p>
                                  <div className="space-y-0.5">
                                    {item.forecast_context.reasoning.map((line) => (
                                      <p key={`r-${item.id}-${line}`}>{line}</p>
                                    ))}
                                  </div>
                                </div>

                                {/* Signals */}
                                {item.forecast_context.applied_signals ? (
                                  <div>
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                      Signal adjustments
                                    </p>
                                    <div className="space-y-1">
                                      {Object.entries(item.forecast_context.applied_signals).map(([key, signal]: [string, any]) => {
                                        const modifier = signal?.modifier ?? 0;
                                        if (Math.abs(modifier) < 0.005) return null;
                                        return (
                                          <div key={key} className="flex items-center justify-between">
                                            <span className="text-text-secondary">{signalLabel(key)}</span>
                                            <span className={`font-semibold ${modifier > 0 ? "text-status-success" : "text-status-warning"}`}>
                                              {modifier > 0 ? "↑" : "↓"} {(Math.abs(modifier) * 100).toFixed(1)}%
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}

                                {/* Financial */}
                                <div>
                                  {impact ? (
                                    <div className="mb-3">
                                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                        Margin impact
                                      </p>
                                      <p className={`text-sm font-semibold ${impact.margin_impact_estimate >= 0 ? "text-status-success" : "text-status-critical"}`}>
                                        {formatSignedCurrency(impact.margin_impact_estimate)}
                                      </p>
                                    </div>
                                  ) : null}
                                  {hasPricing ? (
                                    <div className="space-y-0.5">
                                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                        Financial scenarios
                                      </p>
                                      {financials.revenueIfSold != null && (
                                        <p>
                                          If sold out:{" "}
                                          <span className="font-semibold text-text-primary">{formatCurrency(financials.revenueIfSold)}</span>{" "}
                                          revenue{financials.marginIfSold != null ? ` · ${formatCurrency(financials.marginIfSold)} margin` : ""}
                                        </p>
                                      )}
                                      {financials.wasteIfAll != null && (
                                        <p>
                                          If wasted:{" "}
                                          <span className="font-semibold text-text-primary">{formatCurrency(financials.wasteIfAll)}</span>{" "}
                                          food cost.
                                        </p>
                                      )}
                                      {financials.lostMarginIfStockout != null && financials.shortfallQty > 0 && (
                                        <p>
                                          Stockout by{" "}
                                          <span className="font-semibold text-text-primary">{formatQuantity(financials.shortfallQty, financials.unit)}</span>{" "}
                                          → lose{" "}
                                          <span className="font-semibold text-text-primary">{formatCurrency(financials.lostMarginIfStockout)}</span>{" "}
                                          margin.
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-text-muted">
                                      Add selling price and cost to unlock financial scenarios.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Commit zone — progress + Lock/Start anchored at list bottom ── */}
            <div className="mt-6 flex flex-col gap-3 border-t border-surface-4/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-text-secondary">
                <span className="font-semibold text-text-primary">{decisionSummary.reviewed}</span>
                {" "}of {forecastRowsByDemand.length} reviewed
                {decisionSummary.reviewed < forecastRowsByDemand.length ? (
                  <span className="ml-2 text-text-muted">
                    · {forecastRowsByDemand.length - decisionSummary.reviewed} pending
                  </span>
                ) : (
                  <span className="ml-2 text-status-success">· All reviewed</span>
                )}
                {!isPlanLocked && (
                  <span className="ml-3 text-xs text-text-muted">Lock the plan to start service.</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={lockPlan}
                  disabled={isPlanLocked || lockPlanMutation.isPending}
                  className="inline-flex h-10 items-center rounded-full border border-surface-4 px-5 text-sm font-semibold text-text-primary transition-all duration-200 hover:border-status-success/60 hover:text-status-success active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPlanLocked ? "Plan locked ✓" : lockPlanMutation.isPending ? "Locking..." : "Lock plan"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction("START_LIVE")}
                  disabled={updateBranchDayStatusMutation.isPending || !isPlanLocked}
                  className="inline-flex h-10 items-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-[#141416] transition-all duration-200 hover:bg-[#B8962E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updateBranchDayStatusMutation.isPending ? "Starting..." : "Start service →"}
                </button>
              </div>
            </div>
          </section>

          {/* ── Ingredient Requirements — on-demand calculation ── */}
          <section className="mt-8 mb-4">
            <IngredientRequirements
              branchId={safeBranchId}
              targetDate={targetDate}
              orgId={user?.organization_id ?? ""}
            />
          </section>

          {/* ── Collapsed footer: network intelligence + decision summary ── */}
          <details className="mt-8 mb-4">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-text-secondary transition-colors">
              Network signals & decision summary
            </summary>

            <div className="mt-4 space-y-6">
              {/* Network intelligence */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
                  What other kitchens are seeing
                </p>
                {networkLearnings.length ? (
                  <div className="space-y-2">
                    {networkLearnings.map((learning) => (
                      <div
                        key={`${learning.label}-${learning.detail}`}
                        className="flex items-start gap-3 py-2 border-b border-surface-4/50 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-text-primary">{learning.label}</p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {learning.detail}
                            {typeof learning.confidence === "number" ? ` Reliability: ${percent(learning.confidence)}.` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">Nothing notable from other branches this morning.</p>
                )}
                {networkSuggestedAction ? (
                  <p className="mt-3 text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">Suggested: </span>
                    {networkSuggestedAction}
                  </p>
                ) : null}
              </div>

              {/* Decision summary */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
                  Your decisions so far
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
                  <span>Reviewed: <span className="font-semibold text-text-primary">{decisionSummary.reviewed}</span></span>
                  <span>Used suggestion: <span className="font-semibold text-status-success">{decisionSummary.accepted}</span></span>
                  <span>Your own number: <span className="font-semibold text-status-warning">{decisionSummary.overridden}</span></span>
                  <span>Waste exposure: <span className="font-semibold text-text-primary">{decisionSummary.projectedWaste.toFixed(1)}%</span></span>
                  <span>
                    Forecast impact:{" "}
                    <span className={`font-semibold ${decisionSummary.accuracyImpact >= 0 ? "text-status-success" : "text-status-critical"}`}>
                      {decisionSummary.accuracyImpact >= 0 ? "+" : ""}{decisionSummary.accuracyImpact.toFixed(1)}%
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </details>
        </>
      ) : null}

      {isLive && branchDay ? (
        <section className="mt-8">
          {/* Live header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-status-success animate-pulse" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-success">
                  Service is live
                </p>
                <h3 className="font-display text-2xl font-semibold text-text-primary">
                  Kitchen monitor
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCsvModalOpen(true)}
                className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary hover:border-brand-gold/50 hover:text-brand-gold"
              >
                CSV Import
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction("CLOSE_DAY")}
                disabled={updateBranchDayStatusMutation.isPending}
                className="inline-flex h-9 items-center justify-center rounded-full border border-surface-4 px-5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-status-critical/60 hover:text-status-critical active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateBranchDayStatusMutation.isPending ? "Closing…" : "Close day"}
              </button>
            </div>
          </div>
          {showCsvImportBanner ? (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-status-success/35 bg-status-success/10 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-status-success">
                  CSV Import Complete
                </p>
                <p className="mt-1 text-sm text-text-primary">
                  Sales data is updated from your CSV. Live totals now include
                  the imported rows.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCsvImportBanner(false);
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("csv_import");
                  const next = params.toString();
                  router.replace(
                    next ? `/workspace/today?${next}` : "/workspace/today",
                  );
                }}
                className="text-xs font-semibold text-status-success hover:text-status-success/80"
              >
                Dismiss
              </button>
            </div>
          ) : null}
          <ModalShell
            open={csvModalOpen}
            onClose={() => {
              setCsvModalOpen(false);
              resetCsvUploadState();
            }}
            title="CSV Sales Import"
            description="Upload a POS export when live sales are offline. We will validate the file, then let you map columns before importing."
            maxWidthClassName="max-w-xl"
            footer={
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCsvModalOpen(false);
                    resetCsvUploadState();
                  }}
                  className="inline-flex h-10 items-center rounded-full border border-surface-4 px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-3"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={proceedToCsvMapping}
                  disabled={!csvUploadFile}
                  className="inline-flex h-10 items-center rounded-full border border-brand-gold/45 px-4 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue to Mapping
                </button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Template
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  Download a clean template if you need it.
                </p>
                <button
                  type="button"
                  onClick={handleCsvDownload}
                  className="mt-3 inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-semibold text-text-primary hover:bg-surface-3"
                >
                  Download CSV Template
                </button>
              </div>

              <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Upload
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  If you upload the same file twice, PrepIQ will not
                  double-count sales.
                </p>
                <label className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-full border border-surface-4 bg-surface-2 px-4 py-2 text-sm text-text-secondary hover:border-brand-gold">
                  <span>
                    {csvUploadFile ? csvUploadFile.name : "Choose CSV file"}
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(event) =>
                      handleCsvFileSelect(event.target.files?.[0] ?? null)
                    }
                    className="hidden"
                  />
                  <span className="text-xs font-semibold text-brand-gold">
                    Browse
                  </span>
                </label>
                {csvUploadStatus ? (
                  <p className="mt-2 text-xs text-text-secondary">
                    {csvUploadStatus}
                  </p>
                ) : null}
                {csvUploadHeaders.length ? (
                  <p className="mt-2 text-xs text-text-muted">
                    Columns detected: {csvUploadHeaders.join(", ")}
                  </p>
                ) : null}
                {csvUploadError ? (
                  <p className="mt-2 text-xs text-status-critical">
                    {csvUploadError}
                  </p>
                ) : null}
              </div>
            </div>
          </ModalShell>

          {/* ── TIER 1: NEEDS ACTION ── */}
          {criticalRows.length > 0 ? (
            <div className="mb-7">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-status-critical animate-pulse" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-status-critical">
                  Needs action · {criticalRows.length}
                </p>
              </div>
              <div className="space-y-3">
                {criticalRows.map(({ item, monitor, planned, additional, sold, remaining }) => {
                  const totalPrepared = planned + additional;
                  const pctRemaining = totalPrepared > 0 ? Math.round((remaining / totalPrepared) * 100) : 0;
                  const runoutMin = typeof monitor?.risk_engine?.runout_minutes === "number"
                    ? Math.round(monitor.risk_engine.runout_minutes) : null;
                  const prepTimeMin = Math.round(monitor?.risk_engine?.prep_time_minutes ?? 0);
                  const startBatchNow = Boolean(monitor?.risk_engine?.start_new_batch_now);
                  const suggestedAdditional = Math.max(0, Number(
                    monitor?.should_prepare_more_qty ?? monitor?.suggested_additional_qty ?? 0,
                  ));

                  return (
                    <article
                      key={item.id}
                      className="rounded-xl border border-status-critical/35 bg-surface-2 p-5"
                    >
                      {/* Item name + countdown */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-xl font-semibold text-text-primary">
                            {item.product_title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm text-text-muted">
                            <span>{formatQuantity(sold, item.unit)} sold</span>
                            <span>{formatQuantity(totalPrepared, item.unit)} prepared</span>
                          </div>
                        </div>
                        {runoutMin !== null && (
                          <div className="shrink-0 rounded-xl border border-status-critical/40 bg-status-critical/10 px-4 py-2.5 text-center">
                            <p className="font-display text-3xl font-semibold tabular-nums text-status-critical leading-none">
                              {runoutMin}
                            </p>
                            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-status-critical/70">
                              min left
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Stock bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-muted">
                            {formatQuantity(remaining, item.unit)} remaining
                          </span>
                          <span className="font-semibold text-status-critical">
                            {pctRemaining}% left
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-surface-4">
                          <div
                            className="h-2 rounded-full bg-status-critical transition-all duration-500"
                            style={{ width: `${pctRemaining}%` }}
                          />
                        </div>
                      </div>

                      {/* Action row */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-status-critical">
                          {startBatchNow && runoutMin !== null
                            ? `Start a batch now — runs out in ${runoutMin} min, prep takes ${prepTimeMin} min`
                            : runoutMin !== null
                              ? `Cook more — demand at this rate runs stock out in ${runoutMin} min`
                              : "Demand is outpacing stock — cook more now"}
                        </p>
                        <div className="flex items-center gap-2">
                          {suggestedAdditional > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                logProduction(
                                  item.id,
                                  Math.max(1, isDiscreteUnit(item.unit)
                                    ? Math.round(suggestedAdditional)
                                    : suggestedAdditional),
                                  "Demand spike",
                                )
                              }
                              className="inline-flex h-10 items-center rounded-full border border-status-success/50 bg-status-success/15 px-4 text-sm font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98]"
                            >
                              + Prepare {formatQuantity(Math.max(1, suggestedAdditional), item.unit)}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => logProduction(item.id, 1, "Demand spike")}
                              className="inline-flex h-10 items-center rounded-full border border-status-success/50 bg-status-success/15 px-4 text-sm font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98]"
                            >
                              + Cook more
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => quickTapSale(item.id, item, 1)}
                            className="inline-flex h-10 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary hover:bg-surface-3"
                          >
                            +1 sold
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* ── TIER 2: KEEP AN EYE ON ── */}
          {watchRows.length > 0 ? (
            <div className="mb-7">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-status-warning" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-status-warning">
                  Keep an eye on · {watchRows.length}
                </p>
              </div>
              <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4">
                {watchRows.map(({ item, monitor, planned, additional, sold, remaining }) => {
                  const totalPrepared = planned + additional;
                  const pctRemaining = totalPrepared > 0 ? Math.round((remaining / totalPrepared) * 100) : 0;
                  const wasteRisk = monitor?.risk_engine?.waste_risk ?? "LOW";
                  const runoutMin = typeof monitor?.risk_engine?.runout_minutes === "number"
                    ? Math.round(monitor.risk_engine.runout_minutes) : null;
                  const note = wasteRisk === "HIGH"
                    ? "Slow sales — hold off on more batches"
                    : runoutMin !== null && runoutMin < 45
                      ? `May need more in ~${runoutMin} min`
                      : "Running steady";

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 border-l-[3px] border-l-status-warning/60 pl-4 pr-4 py-4"
                    >
                      {/* Name + bar */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary leading-tight">
                          {item.product_title}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 w-24 shrink-0 rounded-full bg-surface-4">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-500 ${pctRemaining < 25 ? "bg-status-critical" : "bg-status-warning"}`}
                              style={{ width: `${pctRemaining}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-muted">
                            {formatQuantity(remaining, item.unit)} left
                          </span>
                        </div>
                      </div>

                      {/* Note */}
                      <p className="hidden sm:block text-xs text-status-warning max-w-[180px] text-right leading-tight">
                        {note}
                      </p>

                      {/* Log buttons */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => quickTapSale(item.id, item, 1)}
                          className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary hover:bg-surface-3 active:scale-[0.97]"
                        >
                          +1 sold
                        </button>
                        <button
                          type="button"
                          onClick={() => logProduction(item.id, 1)}
                          className="inline-flex h-8 items-center rounded-full border border-brand-gold/40 px-3 text-xs font-medium text-brand-gold hover:bg-brand-gold/10 active:scale-[0.97]"
                        >
                          + batch
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* ── TIER 3: ON TRACK (collapsed) ── */}
          {okRows.length > 0 ? (
            <div className="mb-7">
              <button
                type="button"
                onClick={() => setShowOkRows((p) => !p)}
                className="flex w-full items-center justify-between rounded-xl border border-surface-4/60 bg-surface-2 px-5 py-3.5 text-left transition-colors hover:border-surface-4"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    On track · {okRows.length} items
                  </span>
                </div>
                <span className="text-xs text-text-muted">
                  {showOkRows ? "Hide" : "Show all ↓"}
                </span>
              </button>

              {showOkRows && (
                <div className="mt-1 overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
                  {okRows.map(({ item, planned, additional, sold, remaining }) => {
                    const totalPrepared = planned + additional;
                    const pctRemaining = totalPrepared > 0 ? Math.round((remaining / totalPrepared) * 100) : 0;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 px-5 py-3"
                      >
                        <p className="flex-1 min-w-0 truncate text-sm text-text-secondary">
                          {item.product_title}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-16 shrink-0 rounded-full bg-surface-4">
                            <div
                              className="h-1 rounded-full bg-surface-4/60 transition-all duration-500"
                              style={{ width: `${pctRemaining}%` }}
                            />
                          </div>
                          <span className="w-14 text-right text-xs text-text-muted">
                            {formatQuantity(remaining, item.unit)}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => quickTapSale(item.id, item, 1)}
                            className="inline-flex h-7 items-center rounded-full border border-surface-4 px-2.5 text-[11px] text-text-muted hover:bg-surface-3 active:scale-[0.97]"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => logProduction(item.id, 1)}
                            className="inline-flex h-7 items-center rounded-full border border-surface-4 px-2.5 text-[11px] text-text-muted hover:bg-surface-3 active:scale-[0.97]"
                          >
                            +batch
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {/* ── ALL CLEAR ── */}
          {criticalRows.length === 0 && watchRows.length === 0 && (
            <div className="mb-7 flex items-center gap-3 rounded-xl border border-status-success/30 bg-status-success/5 px-5 py-4">
              <span className="h-2 w-2 shrink-0 rounded-full bg-status-success" />
              <p className="text-sm text-status-success">
                All clear — every item is running to plan.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {isClosed && branchDay ? (
        <section className="mt-8">
          {branchDay.review_phase ? (() => {
            const rp = branchDay.review_phase!;
            const accuracy = rp.daily_outcome.metrics.forecast_accuracy.value;
            const wasteCost = rp.daily_outcome.metrics.waste_cost.value;
            const stockouts = rp.daily_outcome.metrics.stockouts.value;
            const revenueProtected = rp.daily_outcome.metrics.revenue_protected.value;
            const wasteDelta = rp.daily_outcome.metrics.waste_cost.comparison;
            const accDelta = rp.daily_outcome.metrics.forecast_accuracy.comparison;

            const grade =
              accuracy >= 85 && stockouts === 0 ? "Great day"
              : accuracy >= 75 && stockouts <= 1 ? "Good day"
              : accuracy >= 60 ? "Solid day"
              : "Tough one";
            const gradeClass =
              grade === "Great day" ? "text-status-success"
              : grade === "Good day" ? "text-status-success"
              : grade === "Solid day" ? "text-status-warning"
              : "text-status-critical";
            const gradeSub =
              grade === "Great day"
                ? `${accuracy.toFixed(0)}% accuracy and no stockouts. Clean service.`
                : grade === "Good day"
                  ? `${accuracy.toFixed(0)}% accuracy. ${stockouts === 0 ? "No stockouts." : `${stockouts} stockout${stockouts > 1 ? "s" : ""}.`}`
                  : grade === "Solid day"
                    ? `${accuracy.toFixed(0)}% accuracy. Room to improve on a few items.`
                    : `Service can be unpredictable. Here's what to learn from it.`;

            // Override items — from training_rows where chef_adjustment is meaningful
            const overrideItems = rp.learning_signals.training_rows.filter(
              (row) => Math.abs(row.chef_adjustment) >= 0.5,
            );

            return (
            <div className="space-y-10">
              {/* ── 1. HEADLINE ── */}
              <div className="flex flex-col gap-3 border-b border-surface-4/60 pb-8 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    Day closed · {new Date(branchDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                  <h3 className={`mt-1 font-display text-4xl font-semibold ${gradeClass}`}>
                    {grade}
                  </h3>
                  <p className="mt-1.5 text-sm text-text-secondary">{gradeSub}</p>
                  {rp.key_insights?.insights?.length ? (
                    <p className="mt-2 text-sm text-text-muted italic">
                      "{rp.key_insights.insights[0]}"
                    </p>
                  ) : null}
                </div>
              </div>

              {/* ── 2. KPI BAR ── */}
              <div className="grid grid-cols-2 gap-px bg-surface-4/40 rounded-xl overflow-hidden sm:grid-cols-4">
                {[
                  {
                    label: "AI accuracy",
                    value: `${accuracy.toFixed(0)}%`,
                    sub: accDelta
                      ? `${accDelta.direction === "up" ? "↑" : accDelta.direction === "down" ? "↓" : "→"} ${Math.abs(accDelta.delta_pct).toFixed(0)}% vs last ${new Date(branchDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}`
                      : "vs last same day",
                    tone: accuracy >= 80 ? "text-status-success" : accuracy >= 65 ? "text-status-warning" : "text-status-critical",
                  },
                  {
                    label: "Waste cost",
                    value: formatCurrency(wasteCost),
                    sub: wasteDelta
                      ? `${wasteDelta.direction === "up" ? "↑ worse" : wasteDelta.direction === "down" ? "↓ better" : "→ same"} vs last same day`
                      : null,
                    tone: wasteCost === 0 ? "text-status-success" : wasteDelta?.direction === "down" ? "text-status-success" : "text-status-warning",
                  },
                  {
                    label: "Revenue protected",
                    value: formatCurrency(revenueProtected),
                    sub: "from avoiding stockouts",
                    tone: revenueProtected > 0 ? "text-status-success" : "text-text-muted",
                  },
                  {
                    label: "Stockouts",
                    value: stockouts === 0 ? "None" : `${stockouts}`,
                    sub: stockouts === 0 ? "Clean service today" : `${stockouts} item${stockouts > 1 ? "s" : ""} ran out`,
                    tone: stockouts === 0 ? "text-status-success" : "text-status-critical",
                  },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-surface-2 px-5 py-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{kpi.label}</p>
                    <p className={`mt-2 font-display text-2xl font-semibold ${kpi.tone}`}>{kpi.value}</p>
                    {kpi.sub && <p className="mt-1 text-[11px] text-text-muted">{kpi.sub}</p>}
                  </div>
                ))}
              </div>

              {/* ── 3. ITEM SCORECARD ── */}
              {rp.item_performance?.rows?.length ? (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                    How each item did
                  </p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
                    {rp.item_performance.rows.map((row) => {
                      const isStockout = row.stockout;
                      const wasteRatio = row.prepared > 0 ? row.waste / row.prepared : 0;
                      const hasWaste = !isStockout && wasteRatio > 0.08;
                      const outcome = isStockout
                        ? { icon: "⚡", label: "Ran short", cls: "text-status-critical", sub: row.lost_revenue_estimate > 0 ? `~${formatCurrency(row.lost_revenue_estimate)} missed revenue` : null }
                        : hasWaste
                          ? { icon: "○", label: "Had waste", cls: "text-status-warning", sub: `${formatQuantity(row.waste, row.unit)} leftover` }
                          : { icon: "✓", label: "Sold clean", cls: "text-status-success", sub: null };
                      return (
                        <div key={row.item_id} className="flex items-center gap-4 px-5 py-3.5">
                          <span className={`shrink-0 w-5 text-center text-base ${outcome.cls}`}>{outcome.icon}</span>
                          <div className="flex-1 min-w-0">
                            <Link href={`/workspace/items/${row.item_id}?branch=${safeBranchId}`} className="text-sm font-medium text-text-primary hover:text-brand-gold transition-colors">{row.item_title}</Link>
                            {outcome.sub && (
                              <p className="mt-0.5 text-xs text-text-muted">{outcome.sub}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-text-muted">
                              {formatQuantity(row.sold, row.unit)} sold
                            </p>
                            {row.prepared > 0 && (
                              <p className="text-xs text-text-muted">
                                of {formatQuantity(row.prepared, row.unit)} prepped
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {/* ── 4. AI VS YOU ── */}
              {overrideItems.length > 0 ? (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                    Where you diverged from the AI
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {overrideItems.length === 1
                      ? "1 item where you changed the plan."
                      : `${overrideItems.length} items where you changed the plan.`}{" "}
                    Here's how it played out.
                  </p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
                    {overrideItems.map((row) => {
                      const won = row.service_outcome === "IMPROVED_BY_CHEF";
                      return (
                        <div key={row.item_id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5">
                          <p className="min-w-[140px] text-sm font-medium text-text-primary">{row.item_title}</p>
                          <div className="flex items-center gap-2 text-xs text-text-muted">
                            <span>AI: <span className="font-medium text-text-secondary">{formatQuantity(row.forecast_qty, row.unit)}</span></span>
                            <span className="text-text-muted">→</span>
                            <span>You: <span className="font-medium text-text-secondary">{formatQuantity(row.chef_planned_qty, row.unit)}</span></span>
                            <span className="text-text-muted">→</span>
                            <span>Sold: <span className="font-semibold text-text-primary">{formatQuantity(row.actual_sales, row.unit)}</span></span>
                          </div>
                          <span className={`ml-auto shrink-0 text-xs font-semibold ${won ? "text-status-success" : "text-status-warning"}`}>
                            {won ? "✓ Your call paid off" : "AI was closer"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {(rp.learning_signals.ml_learning_signals?.chef_outperformed_forecast_rows ?? 0) > 0 && (
                    <p className="mt-3 text-xs text-status-success">
                      Your overrides improved outcomes on{" "}
                      <span className="font-semibold">{rp.learning_signals.ml_learning_signals?.chef_outperformed_forecast_rows}</span>{" "}
                      item{(rp.learning_signals.ml_learning_signals?.chef_outperformed_forecast_rows ?? 0) > 1 ? "s" : ""} — those signals are weighted into tomorrow's model.
                    </p>
                  )}
                </section>
              ) : null}

              {/* ── 5. WHAT THE MODEL LEARNED ── */}
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  What the model learned today
                </p>
                <div className="mt-3 grid grid-cols-2 gap-0 rounded-xl border border-surface-4 bg-surface-2 overflow-hidden sm:grid-cols-4 divide-x divide-surface-4/60">
                  {[
                    {
                      value: rp.learning_signals.ml_learning_signals?.rows ?? rp.learning_signals.training_rows.length,
                      label: "Training signals",
                      sub: "items tracked",
                    },
                    {
                      value: rp.learning_signals.ml_learning_signals?.chef_override_rows ?? overrideItems.length,
                      label: "Your overrides",
                      sub: "plan changes",
                    },
                    {
                      value: rp.learning_signals.ml_learning_signals?.waste_rows ?? 0,
                      label: "Waste events",
                      sub: "items with leftover",
                    },
                    {
                      value: rp.learning_signals.ml_learning_signals?.stockout_rows ?? stockouts,
                      label: "Stockouts",
                      sub: "items that ran out",
                    },
                  ].map((s) => (
                    <div key={s.label} className="px-5 py-4">
                      <p className="font-display text-2xl font-semibold text-text-primary">{s.value}</p>
                      <p className="mt-0.5 text-xs font-medium text-text-secondary">{s.label}</p>
                      <p className="mt-0.5 text-[11px] text-text-muted">{s.sub}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  Today's data is feeding into tomorrow's forecast. The model improves with every service.
                </p>
              </section>

              {/* ── 6. TOMORROW ── */}
              <section className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Before you come in tomorrow
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {rp.tomorrow_early_signal.message}
                </p>
                {rp.tomorrow_early_signal.expected_demand_change_pct !== 0 && (
                  <p className="mt-1 text-xs text-text-muted">
                    Demand expected to be{" "}
                    <span className={`font-semibold ${rp.tomorrow_early_signal.expected_demand_change_pct > 0 ? "text-status-success" : "text-status-warning"}`}>
                      {rp.tomorrow_early_signal.expected_demand_change_pct > 0 ? "+" : ""}{rp.tomorrow_early_signal.expected_demand_change_pct.toFixed(0)}%
                    </span>{" "}
                    {rp.tomorrow_early_signal.weekday ? `vs a typical ${rp.tomorrow_early_signal.weekday}` : "vs baseline"}
                    {rp.tomorrow_early_signal.sample_size ? ` · based on ${rp.tomorrow_early_signal.sample_size} similar days` : ""}
                  </p>
                )}
                {rp.learning_signals.tomorrow_actions?.length ? (
                  <ul className="mt-4 space-y-2 border-t border-brand-gold/20 pt-4">
                    {rp.learning_signals.tomorrow_actions.map((action) => (
                      <li key={action} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" />
                        {action}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Link
                  href={`/workspace/today?branch_id=${branchDay.branch_id}&date=${rp.tomorrow_early_signal.target_date}`}
                  className="mt-4 inline-flex h-9 items-center rounded-full border border-brand-gold/40 px-4 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/15"
                >
                  Preview tomorrow's plan →
                </Link>
              </section>

              {/* ── 7. HOW DID TODAY FEEL + NOTE ── */}
              <section className="space-y-6">
                {/* Reaction */}
                {(() => {
                  const activeReaction = dayReaction || branchDay.day_reaction || "";
                  const reactions: {
                    value: "FIRED_UP" | "GOOD" | "MEH" | "ROUGH";
                    emoji: string;
                    label: string;
                  }[] = [
                    { value: "FIRED_UP", emoji: "🔥", label: "Fired up" },
                    { value: "GOOD",     emoji: "😊", label: "Good" },
                    { value: "MEH",      emoji: "😐", label: "Meh" },
                    { value: "ROUGH",    emoji: "😮‍💨", label: "Rough one" },
                  ];
                  return (
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        How are you leaving today?
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        Not what happened — how <em>you</em> feel right now.
                      </p>
                      <div className="mt-3 flex gap-3">
                        {reactions.map((r) => {
                          const isActive = activeReaction === r.value;
                          return (
                            <button
                              key={r.value}
                              type="button"
                              title={r.label}
                              onClick={() => {
                                const next = isActive ? "" : r.value;
                                setDayReaction(next as typeof dayReaction);
                                setAckVisible(false);
                                setAckMessage("");
                                if (!branchDay.id) return;
                                updateBranchDayNotesMutation.mutate({
                                  branchDayId: branchDay.id,
                                  reaction: next,
                                });
                                if (next) {
                                  const pool = REACTION_MESSAGES[next] ?? [];
                                  const msg = pool[Math.floor(Math.random() * pool.length)] ?? "";
                                  setAckPending(true);
                                  setTimeout(() => {
                                    setAckMessage(msg);
                                    setAckPending(false);
                                    setAckVisible(true);
                                  }, 400 + Math.random() * 900);
                                } else {
                                  setAckPending(false);
                                }
                              }}
                              className={`flex flex-col items-center gap-1.5 rounded-xl border px-4 py-3 transition-all ${
                                isActive
                                  ? "border-brand-gold bg-brand-gold/10 scale-105"
                                  : "border-surface-4 bg-surface-3 hover:border-brand-gold/30 hover:bg-brand-gold/5"
                              }`}
                            >
                              <span className="text-2xl leading-none">{r.emoji}</span>
                              <span className={`text-[11px] font-medium ${isActive ? "text-brand-gold" : "text-text-muted"}`}>
                                {r.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {ackPending && (
                        <div className="mt-3 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
                        </div>
                      )}
                      {ackVisible && ackMessage && (
                        <p className="mt-3 text-sm text-text-secondary animate-in fade-in slide-in-from-bottom-1 duration-300">
                          {ackMessage}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Note */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                    Anything worth noting?
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Special event, staffing issue, unexpected rush — context here makes tomorrow's forecast sharper.
                  </p>
                  {noteSaved ? (
                    <p className="mt-4 text-sm text-status-success">✓ Saved — the model will factor this in.</p>
                  ) : (
                    <div className="mt-3">
                      <textarea
                        rows={3}
                        placeholder="e.g. Birthday party for 40 guests, short-staffed, local event nearby..."
                        value={dayNote || branchDay.session_notes || ""}
                        onChange={(e) => setDayNote(e.target.value)}
                        className="w-full resize-none rounded-xl border border-surface-4 bg-surface-3 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[11px] text-text-muted">Not shared externally — goes into your training data.</p>
                        <button
                          type="button"
                          disabled={!dayNote.trim() || updateBranchDayNotesMutation.isPending}
                          onClick={() => {
                            if (!branchDay.id || !dayNote.trim()) return;
                            updateBranchDayNotesMutation.mutate(
                              { branchDayId: branchDay.id, notes: dayNote.trim() },
                              { onSuccess: () => setNoteSaved(true) },
                            );
                          }}
                          className="inline-flex h-9 items-center rounded-full border border-brand-gold/40 px-4 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/15 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updateBranchDayNotesMutation.isPending ? "Saving…" : "Save note"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
            );
          })() : (
            <div className="py-16 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/20 mb-3">
                <div className="h-5 w-5 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-text-muted">Preparing your day summary…</p>
              <p className="mt-1 text-xs text-text-muted">This takes a few seconds.</p>
            </div>
          )}
        </section>
      ) : null}

      {branchDay &&
      branchDay.status !== "MORNING" &&
      branchDay.status !== "LIVE" &&
      branchDay.status !== "CLOSED" ? (
        <div className="mt-8 py-12 text-center">
          <Calendar className="mx-auto h-8 w-8 text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">
            Status is{" "}
            <span className="font-semibold text-text-primary">{branchDay.status}</span>.
          </p>
        </div>
      ) : null}

      {!loading &&
      branchDay &&
      branchDay.status === "MORNING" &&
      branchDay.prep_plan_items.length === 0 ? (
        <div className="mt-8 py-12 text-center">
          <Calendar className="mx-auto h-8 w-8 text-status-warning mb-3" />
          <p className="text-sm text-text-secondary">
            Morning mode is initialized, but there are no active prep items for this branch yet.
          </p>
        </div>
      ) : null}

      <ConfirmActionModal
        open={confirmAction === "START_LIVE"}
        title="Start Service?"
        description="Service begins. Live monitoring activates and production logs open."
        confirmLabel="Start Service"
        isConfirming={updateBranchDayStatusMutation.isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={startLiveService}
      />

      <ConfirmActionModal
        open={confirmAction === "CLOSE_DAY"}
        title="Close Day?"
        description="End-of-day summary will be generated. Today closes and cannot be re-opened."
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
        </>
      )}
    </WorkspaceShell>
  );
}

export default function TodayWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <TodayWorkspacePageContent />
    </Suspense>
  );
}
