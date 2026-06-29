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
import { MarkUnavailableModal } from "@/components/dashboard/today/mark-unavailable-modal";
import { inventoryQueryKeys } from "@/services/inventory/hooks";

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
  narrative?: string;
  food_cost_at_risk?: number;
  shortfall_margin_risk?: number;
};

const EMPTY_LIST: never[] = [];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function confidenceLabel(t: (k: string, vars?: Record<string, string | number>) => string, score: number) {
  if (score >= 0.75) return t("today.confidence.high");
  if (score >= 0.5) return t("today.confidence.medium");
  return t("today.confidence.low");
}

function percent(value: number) {
  const normalized = Math.max(0, Math.min(1, value));
  return `${(normalized * 100).toFixed(0)}%`;
}

function confidenceNarrative(t: (k: string, vars?: Record<string, string | number>) => string, score?: number | null) {
  if (score == null) return t("today.confidenceNarrative.insufficient");
  if (score >= 0.75) return t("today.confidenceNarrative.high");
  if (score >= 0.5) return t("today.confidenceNarrative.moderate");
  return t("today.confidenceNarrative.low");
}

function agreementNarrative(t: (k: string, vars?: Record<string, string | number>) => string, score?: number | null) {
  if (score == null) return t("today.agreementNarrative.notAvailable");
  if (score >= 0.75) return t("today.agreementNarrative.high");
  if (score >= 0.5) return t("today.agreementNarrative.partial");
  return t("today.agreementNarrative.low");
}

function velocitySummary(t: (k: string, vars?: Record<string, string | number>) => string, comparison?: {
  status?: string;
  deviation_pct?: number;
}) {
  if (!comparison || !comparison.status) {
    return t("today.velocity.noPaceCheck");
  }
  const deviation = comparison.deviation_pct ?? 0;
  const absDeviation = Math.abs(deviation);
  const deviationLabel = `${absDeviation.toFixed(0)}%`;
  if (comparison.status === "HIGH_DEMAND") {
    return t("today.velocity.highDemand", { deviation: deviationLabel });
  }
  if (comparison.status === "LOW_DEMAND") {
    return t("today.velocity.lowDemand", { deviation: deviationLabel });
  }
  return t("today.velocity.onTrack");
}

function velocityStatusTone(status?: string) {
  if (status === "HIGH_DEMAND") return "text-status-critical";
  if (status === "LOW_DEMAND") return "text-status-warning";
  return "text-status-success";
}

function getReactionMessages(t: (k: string, vars?: Record<string, string | number>) => string): Record<string, string[]> {
  return {
    FIRED_UP: [
      t("today.reaction.firedUp.0"),
      t("today.reaction.firedUp.1"),
      t("today.reaction.firedUp.2"),
      t("today.reaction.firedUp.3"),
      t("today.reaction.firedUp.4"),
      t("today.reaction.firedUp.5"),
    ],
    GOOD: [
      t("today.reaction.good.0"),
      t("today.reaction.good.1"),
      t("today.reaction.good.2"),
      t("today.reaction.good.3"),
      t("today.reaction.good.4"),
      t("today.reaction.good.5"),
    ],
    MEH: [
      t("today.reaction.meh.0"),
      t("today.reaction.meh.1"),
      t("today.reaction.meh.2"),
      t("today.reaction.meh.3"),
      t("today.reaction.meh.4"),
      t("today.reaction.meh.5"),
    ],
    ROUGH: [
      t("today.reaction.rough.0"),
      t("today.reaction.rough.1"),
      t("today.reaction.rough.2"),
      t("today.reaction.rough.3"),
      t("today.reaction.rough.4"),
      t("today.reaction.rough.5"),
    ],
  };
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

function overrideImpactLine(
  t: (k: string, vars?: Record<string, string | number>) => string,
  impact: ImpactPreview | undefined,
  variance: number | null,
  suggestedQty: number,
): { text: string; tone: "warning" | "critical" } | null {
  if (!impact || variance == null || Math.abs(variance) < suggestedQty * 0.06) return null;
  if (variance > 0 && impact.food_cost_at_risk && impact.food_cost_at_risk > 0) {
    return {
      text: t("today.override.foodAtRisk", { amount: formatCurrency(impact.food_cost_at_risk) }),
      tone: "warning",
    };
  }
  if (variance < 0 && impact.shortfall_margin_risk && impact.shortfall_margin_risk > 0) {
    return {
      text: t("today.override.marginAtRisk", { amount: formatCurrency(impact.shortfall_margin_risk) }),
      tone: "critical",
    };
  }
  return null;
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

function riskLabel(t: (k: string, vars?: Record<string, string | number>) => string, value: number) {
  if (value >= 0.45) return t("today.riskLabel.high");
  if (value >= 0.25) return t("today.riskLabel.medium");
  return t("today.riskLabel.low");
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

function popularityLabel(t: (k: string, vars?: Record<string, string | number>) => string, rank: number) {
  if (rank <= 3) return t("today.popularity.top3");
  if (rank <= 5) return t("today.popularity.highDemand");
  return t("today.popularity.rank", { rank });
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

function signalLabel(t: (k: string, vars?: Record<string, string | number>) => string, key: string): string {
  const map: Record<string, string> = {
    reservation: t("today.signalLabel.reservation"),
    event: t("today.signalLabel.event"),
    weather: t("today.signalLabel.weather"),
    staffing: t("today.signalLabel.staffing"),
    kitchen_capacity: t("today.signalLabel.kitchenCapacity"),
    delivery_mix: t("today.signalLabel.deliveryMix"),
    traffic: t("today.signalLabel.traffic"),
    similar_day: t("today.signalLabel.similarDay"),
    local_event: t("today.signalLabel.localEvent"),
  };
  return map[key] ?? key;
}

function getFallbackDemandSignals(t: (k: string, vars?: Record<string, string | number>) => string) {
  return [
    {
      key: "similar_day",
      label: t("today.fallbackSignal.similarDay.label"),
      value_pct: 0,
      direction: "neutral" as const,
      explanation: t("today.fallbackSignal.similarDay.explanation"),
    },
    {
      key: "reservation",
      label: t("today.fallbackSignal.reservation.label"),
      value_pct: 0,
      direction: "neutral" as const,
      explanation: t("today.fallbackSignal.reservation.explanation"),
    },
    {
      key: "weather",
      label: t("today.fallbackSignal.weather.label"),
      value_pct: 0,
      direction: "neutral" as const,
      explanation: t("today.fallbackSignal.weather.explanation"),
    },
    {
      key: "local_event",
      label: t("today.fallbackSignal.localEvent.label"),
      value_pct: 0,
      direction: "neutral" as const,
      explanation: t("today.fallbackSignal.localEvent.explanation"),
    },
  ];
}

function TodayWorkspacePageContent() {
  const { t } = useTranslation();
  const reactionMessages = useMemo(() => getReactionMessages(t), [t]);
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
  const [markUnavailableItem, setMarkUnavailableItem] = useState<{ id: string; title: string } | null>(null);

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
    if (!wastePattern) return t("today.network.noAction");
    return t("today.network.reduceExposure", { itemName: wastePattern.item_name });
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
            [prepPlanItemId]: t("today.error.acceptSuggestion"),
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
            [prepPlanItemId]: t("today.error.keepPlan"),
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
        message: t("today.feedback.accepted"),
      };
    }
    if (item.decision === "CHEF_OVERRIDE") {
      return {
        tone: "warning" as const,
        message: t("today.feedback.overridden"),
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
    logProduction(liveItem.id, normalizedQty, t("today.reason.demandSpike"));
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
      setCsvUploadError(t("today.csv.invalidExtension"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCsvUploadError(t("today.csv.tooLarge"));
      return;
    }
    try {
      const parsed = await parseCSVFile(file);
      if (!parsed.headers.length) {
        setCsvUploadError(t("today.csv.noHeader"));
        return;
      }
      setCsvUploadFile(file);
      setCsvUploadHeaders(parsed.headers);
      setCsvUploadStatus(t("today.csv.columnsDetected", { count: parsed.headers.length }));
    } catch {
      setCsvUploadError(t("today.csv.unreadable"));
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
        setCsvUploadError(t("today.csv.downloadError"));
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "prepIQ_pos_sales_import_template.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
      setCsvUploadStatus(t("today.csv.downloadSuccess"));
    } catch {
      setCsvUploadError(t("today.csv.downloadError"));
    }
  };

  const proceedToCsvMapping = () => {
    if (!csvUploadFile || !branchId) {
      setCsvUploadError(t("today.csv.selectFile"));
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
    ? t("today.status.loading")
    : noBranchContext
      ? t("today.status.noBranch")
      : branchDay?.status === "MORNING"
        ? t("today.status.planning")
        : branchDay?.status === "LIVE"
          ? t("today.status.live")
          : branchDay?.status === "CLOSED"
            ? t("today.status.closed")
            : branchId
              ? t("today.status.settingUp")
              : t("today.status.selectBranch");
  const todayQueryErrorMessage = useMemo(() => {
    if (!todayQuery.isError) return "";
    const err = todayQuery.error as {
      message?: string;
      details?: unknown;
      status?: number;
    } | null;
    if (!err) return t("today.error.loadDayData");
    if (typeof err.message === "string" && err.message.length)
      return err.message;
    const details = (err as any)?.details;
    if (typeof details?.message === "string") return details.message;
    if (typeof details?.detail === "string") return details.detail;
    if (typeof details?.error === "string") return details.error;
    return t("today.error.loadDayData");
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
    if (!branchDay) return getFallbackDemandSignals(t);
    return branchDay.demand_signal.signals?.length
      ? branchDay.demand_signal.signals
      : getFallbackDemandSignals(t);
  }, [branchDay, t]);
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
  const prepConfidenceRiskLevel = useMemo(() => {
    if (prepConfidenceGauge >= 0.75) return "low";
    if (prepConfidenceGauge >= 0.55) return "medium";
    return "high";
  }, [prepConfidenceGauge]);
  const prepConfidenceRiskLabel = useMemo(() => {
    if (prepConfidenceRiskLevel === "low") return t("today.prepRisk.low");
    if (prepConfidenceRiskLevel === "medium") return t("today.prepRisk.medium");
    return t("today.prepRisk.high");
  }, [prepConfidenceRiskLevel, t]);
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
        t,
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
        t("today.riskAlert.driver.planVsSuggested", { planned: formatQuantity(plannedQty, item.unit), suggested: formatQuantity(item.suggested_quantity, item.unit) }),
        t("today.riskAlert.driver.expectedOrders", { orders: Math.round(item.forecast_context.predicted_orders), confidence, pct: percent(item.forecast_context.confidence_score) }),
      ];
      if (primaryRiskType === "STOCKOUT") {
        drivers.push(
          shortfallQty > 0
            ? t("today.riskAlert.driver.stockoutBelow", { quantity: formatQuantity(shortfallQty, item.unit) })
            : t("today.riskAlert.driver.stockoutPressure"),
        );
      }
      if (primaryRiskType === "WASTE") {
        drivers.push(
          overprepQty > 0
            ? t("today.riskAlert.driver.wasteAbove", { quantity: formatQuantity(overprepQty, item.unit) })
            : t("today.riskAlert.driver.wasteSignal"),
        );
      }
      if (primaryRiskType === "MARGIN" && impact) {
        drivers.push(
          t("today.riskAlert.driver.marginShift", { amount: formatSignedCurrency(impact.margin_impact_estimate) }),
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
        title: t("today.riskAlert.title", { riskType: primaryRiskType }),
        detail: t("today.riskAlert.detail", { riskType: primaryRiskType.toLowerCase(), severity: primaryRiskSeverity.toLowerCase() }),
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
        ? t("today.outlook.maintainBaselineWatch", { items: priorityItems.join(t("today.outlook.and")) })
        : t("today.outlook.maintainBaselineAll");
    }
    const planAction = deltaPlan
      ? t("today.outlook.planAcrossAll", { delta: deltaPlan })
      : "";
    const suffix =
      directionWord === "up"
        ? t("today.outlook.sensitiveSuffix")
        : t("today.outlook.wasteSuffix");
    return priorityItems.length
      ? `${planAction} ${t("today.outlook.prioritize", { items: priorityItems.join(t("today.outlook.and")), suffix })}`
      : `${planAction} ${t("today.outlook.reviewHighDemand")}`;
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
      eyebrow={t("today.eyebrow")}
      title={t("today.title")}
      description={t("today.description")}
      insight={t("today.insight")}
    >
      {/* Slim context bar — no heavy card */}
      <div className="mb-8 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-6">
        <div className="flex-1 min-w-[180px] max-w-xs">
          <Select
            label={t("today.branch.label")}
            leadingIcon={<Shop className="h-4 w-4" />}
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={branchId}
            onChange={setBranchId}
            disabled={noBranchContext}
            placeholder={
              noBranchContext ? t("today.branch.noBranches") : t("today.branch.selectBranch")
            }
          />
        </div>

        <div className="flex-1 min-w-[160px] max-w-xs">
          <OperationalCalendar
            label={t("today.date.label")}
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
              <p className="font-semibold">{t("today.error.settingUp")}</p>
            </div>
          ) : (
            <>
              <p className="font-semibold">{t("today.error.dayDataNotAvailable")}</p>
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
                  {t("today.error.initializeDay")}
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
            {t("today.error.noBranchContext")}
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
                  {t("today.expectedDemand")}
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
                      ? t("today.demand.quieter")
                      : demandDeltaPct >= 2
                        ? t("today.demand.busier")
                        : t("today.demand.normal")}
                  </span>
                </div>
                <div className="mt-3 relative h-[3px] w-40 rounded-full bg-surface-4">
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-brand-gold shadow-sm"
                    style={{ left: `calc(${demandMeterPosition}% - 6px)` }}
                  />
                </div>
                <div className="mt-1 flex w-40 justify-between text-[9px] text-text-muted/60">
                  <span>{t("today.demand.quiet")}</span>
                  <span>{t("today.demand.normalShort")}</span>
                  <span>{t("today.demand.busy")}</span>
                </div>
              </div>

              {/* Vertical divider */}
              <div className="hidden sm:block w-px self-stretch bg-surface-4/60" />

              {/* Signal chips + action sentence */}
              <div className="flex-1 min-w-[180px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("today.demandSignals")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(() => {
                    const activeSignals = demandSignals.filter((s) => s.direction !== "neutral");
                    if (activeSignals.length === 0) {
                      return (
                        <span className="text-[11px] italic text-text-muted">
                          {t("today.demandSignals.noStrong")}
                        </span>
                      );
                    }
                    return activeSignals.slice(0, 4).map((signal) => (
                      <span
                        key={signal.key}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${signalToneClasses(signal.direction, signal.value_pct)}`}
                      >
                        {signal.label}
                        <span className="font-semibold">{toPercent(signal.value_pct)}</span>
                      </span>
                    ));
                  })()}
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
                  {t("today.planReliability")}
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-semibold tracking-[-0.5px] text-text-primary">
                    {percent(prepConfidenceGauge)}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      prepConfidenceRiskLevel === "low"
                        ? "text-status-success"
                        : prepConfidenceRiskLevel === "medium"
                          ? "text-status-warning"
                          : "text-status-critical"
                    }`}
                  >
                    {prepConfidenceRiskLevel === "low"
                      ? t("today.prepRiskLabel.goodShape")
                      : prepConfidenceRiskLevel === "medium"
                        ? t("today.prepRiskLabel.reviewItems")
                        : t("today.prepRiskLabel.checkAlerts")}
                  </span>
                </div>
                <div className="mt-2 h-[3px] w-40 overflow-hidden rounded-full bg-surface-4">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      prepConfidenceRiskLevel === "low"
                        ? "bg-status-success"
                        : prepConfidenceRiskLevel === "medium"
                          ? "bg-status-warning"
                          : "bg-status-critical"
                    }`}
                    style={{ width: percent(prepConfidenceGauge) }}
                  />
                </div>
                <div className="mt-2 flex gap-6 text-[11px]">
                  <div>
                    <p className="text-text-muted">{t("today.needsAttention")}</p>
                    <p className="font-semibold text-text-primary">
                      {branchDay.morning_overview?.high_risk_items ?? branchDay.demand_signal.high_risk_items ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">{t("today.tracked")}</p>
                    <p className="font-semibold text-text-primary">
                      {branchDay.demand_signal.tracked_items ?? rows.length}
                    </p>
                  </div>
                </div>
                {branchDay.demand_signal.confidence_breakdown &&
                  branchDay.demand_signal.forecast_confidence < 0.75 ? (
                  <p className="mt-2 max-w-[180px] text-[10px] leading-snug text-text-muted">
                    <span className="font-semibold text-status-warning">{t("today.why")}: </span>
                    {branchDay.demand_signal.confidence_breakdown.limiting_factor}.
                  </p>
                ) : null}
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
                      {alert.riskType === "STOCKOUT" ? t("today.alert.mayRunOut") : alert.riskType === "WASTE" ? t("today.alert.riskOfWaste") : t("today.alert.marginAtRisk")}
                    </p>
                    <p className="mt-0.5 text-sm text-text-secondary">
                      {alert.riskType === "STOCKOUT"
                        ? alert.financials.lostMarginIfStockout != null && alert.financials.lostMarginIfStockout > 0
                          ? t("today.alert.stockoutRiskWithMargin", { amount: formatCurrency(alert.financials.lostMarginIfStockout) })
                          : t("today.alert.stockoutRisk")
                        : alert.riskType === "WASTE"
                          ? alert.financials.wasteIfAll != null && alert.financials.wasteIfAll > 0
                            ? t("today.alert.wasteRiskWithCost", { amount: formatCurrency(alert.financials.wasteIfAll) })
                            : t("today.alert.wasteRisk")
                          : alert.riskMetrics.marginImpact !== 0
                            ? t("today.alert.marginRiskWithImpact", { amount: formatSignedCurrency(alert.riskMetrics.marginImpact) })
                            : t("today.alert.marginRisk")}
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
                  {t("today.prepPlan.title")}
                </p>
                <h3 className="font-display text-xl font-semibold text-text-primary sm:text-2xl">
                  {t("today.prepPlan.subtitle")}
                </h3>
                {/* Inline stats — no cards */}
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-secondary">
                  <span>
                    <span className="font-semibold text-text-primary">{decisionSummary.reviewed}</span>
                    {" "}{t("today.prepPlan.ofCount", { total: forecastRowsByDemand.length })}
                  </span>
                  {(branchDay.morning_overview?.projected_margin_total ?? 0) > 0 ? (
                    <span>
                      {t("today.prepPlan.projectedMargin")}{" "}
                      <span className="font-semibold text-status-success">
                        {formatCurrency(branchDay.morning_overview?.projected_margin_total ?? 0)}
                      </span>
                    </span>
                  ) : null}
                  {branchDay.morning_overview?.chef_accuracy_score?.available ? (
                    <span>
                      {t("today.prepPlan.yourAccuracy")}{" "}
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
                  {importantItemsOnly ? t("today.prepPlan.priorityItems") : t("today.prepPlan.allItems")}
                </button>
                <button
                  type="button"
                  onClick={lockPlan}
                  disabled={isPlanLocked || lockPlanMutation.isPending}
                  className="inline-flex h-10 items-center rounded-full border border-surface-4 px-5 text-sm font-semibold text-text-primary transition-all duration-200 hover:border-status-success/60 hover:text-status-success active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPlanLocked ? t("today.prepPlan.planLocked") : lockPlanMutation.isPending ? t("today.prepPlan.locking") : t("today.prepPlan.lockPlan")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction("START_LIVE")}
                  disabled={updateBranchDayStatusMutation.isPending || !isPlanLocked}
                  className="inline-flex h-10 items-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-[#141416] transition-all duration-200 hover:bg-[#B8962E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updateBranchDayStatusMutation.isPending ? t("today.prepPlan.starting") : t("today.prepPlan.startService")}
                </button>
              </div>
            </div>
            {!isPlanLocked ? (
              <p className="mb-4 text-xs text-text-muted">{t("today.prepPlan.lockFirst")}</p>
            ) : branchDay?.plan_lock?.locked_at ? (
              <p className="mb-4 text-xs text-status-success">
                {branchDay.plan_lock.locked_by?.name
                  ? t("today.prepPlan.lockedAtBy", {
                      time: new Date(branchDay.plan_lock.locked_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                      user: branchDay.plan_lock.locked_by.name,
                    })
                  : t("today.prepPlan.lockedAtTime", {
                      time: new Date(branchDay.plan_lock.locked_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                    })}
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
                            {popularityLabel(t, forecastRankById[item.id] ?? 999)}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskTone(riskScore)}`}>
                        {riskLabel(t, riskScore)}
                      </span>
                    </div>

                    {/* Row 2: AI suggests / Your plan — flat, no nested cards */}
                    <div className="mt-3 grid grid-cols-2 divide-x divide-surface-4/60 border-y border-surface-4/60">
                      <div className="px-4 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          {t("today.table.aiSuggests")}
                        </p>
                        {(() => {
                          const avail = (item.suggestion_reason_json as any)?.availability;
                          const isSupplyConstrained = avail?.available === false && avail?.suppressed_demand === false;
                          return isSupplyConstrained ? (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="inline-flex h-6 items-center rounded-full border border-status-warning/30 bg-status-warning/10 px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-status-warning">
                                Supply Constrained
                              </span>
                              <span className="text-sm font-semibold text-status-warning">0 {item.unit}</span>
                            </div>
                          ) : (
                            <p className="mt-1 font-display text-lg font-semibold text-text-primary">
                              {formatQuantity(item.suggested_quantity, item.unit)}
                            </p>
                          );
                        })()}
                        <p className="mt-0.5 text-[11px] text-text-muted">
                          {t("today.table.ordersAndConfidence", { orders: Math.round(item.forecast_context.predicted_orders), confidence: confidenceLabel(t, item.forecast_context.confidence_score) })}
                        </p>
                      </div>
                      <div className="px-4 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                          {t("today.table.yourPlan")}
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
                            ? t("today.table.matchesSuggestion")
                            : variance > 0
                              ? `${signedQuantity(variance, item.unit)} ${t("today.table.above")}`
                              : `${signedQuantity(variance, item.unit)} ${t("today.table.below")}`}
                        </p>
                        {(() => {
                          const line = overrideImpactLine(t, impact, variance, item.suggested_quantity);
                          return line ? (
                            <p className={`mt-0.5 text-[11px] font-medium ${line.tone === "warning" ? "text-status-warning" : "text-status-critical"}`}>
                              {line.text}
                            </p>
                          ) : null;
                        })()}
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
                          {t("today.table.accept")}
                        </button>
                        <button
                          type="button"
                          onClick={() => keepMyPlan(item.id, planned, item.unit)}
                          disabled={isPlanLocked}
                          className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/20"
                        >
                          {t("today.table.keepMine")}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleItemExpand(item.id)}
                          className="text-[11px] font-semibold text-brand-gold hover:text-brand-gold/80 transition-colors"
                        >
                          {isExpanded ? t("today.table.hide") : t("today.table.why")}
                        </button>
                        <Link
                          href={`/workspace/today/item/${item.id}?branch=${safeBranchId}&date=${targetDate}&title=${encodeURIComponent(item.product_title)}&product_id=${item.product_id}&org=${user?.organization_id ?? ""}`}
                          className="text-[11px] font-medium text-brand-gold/70 hover:text-brand-gold transition-colors"
                        >
                          {t("today.table.deepDive")}
                        </Link>
                        <Link
                          href={`/workspace/items/${item.product_id}?branch=${safeBranchId}`}
                          className="text-[11px] font-medium text-text-muted hover:text-brand-gold transition-colors"
                        >
                          {t("today.table.trackRecord")}
                        </Link>
                        {isMorning && (
                          <button
                            type="button"
                            onClick={() => setMarkUnavailableItem({ id: item.product_id, title: item.product_title })}
                            className="text-[11px] font-medium text-text-muted hover:text-status-warning transition-colors"
                          >
                            Mark Unavailable
                          </button>
                        )}
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
                        {/* Batch constraint annotation */}
                        {(() => {
                          const constraints = (item.suggestion_reason_json as any)?.constraints as any[] | undefined;
                          if (!constraints?.length) return null;
                          return (
                            <div className="border-b border-surface-4/40 pb-2 space-y-0.5">
                              {constraints.map((c: any, i: number) => (
                                <p key={i} className="text-text-muted">
                                  Batch rule: {c.raw_qty} → {c.rounded_qty}
                                  {c.batch_size != null ? ` (batch size ${c.batch_size})` : ""}
                                </p>
                              ))}
                            </div>
                          );
                        })()}
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
                                    <span className="text-text-secondary">{signalLabel(t, key)}</span>
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
                          <p className={`border-t border-surface-4/40 pt-2 ${impact.narrative ? (impact.delta_quantity > 0 ? "text-status-warning" : "text-status-critical") : ""}`}>
                            {impact.narrative ? (
                              impact.narrative
                            ) : (
                              <>
                                {t("today.table.marginImpact")}:{" "}
                                <span className={`font-semibold ${impact.margin_impact_estimate >= 0 ? "text-status-success" : "text-status-critical"}`}>
                                  {formatSignedCurrency(impact.margin_impact_estimate)}
                                </span>
                              </>
                            )}
                          </p>
                        ) : null}
                        {hasPricing ? (
                          <div className="space-y-0.5 border-t border-surface-4/40 pt-2">
                            {financials.revenueIfSold != null && (
                              <p>
                                {financials.marginIfSold != null
                                  ? t("today.table.ifSoldOutWithMargin", { revenue: formatCurrency(financials.revenueIfSold), margin: formatCurrency(financials.marginIfSold) })
                                  : t("today.table.ifSoldOut", { revenue: formatCurrency(financials.revenueIfSold) })}
                              </p>
                            )}
                            {financials.wasteIfAll != null && (
                              <p>
                                {t("today.table.ifWasted", { cost: formatCurrency(financials.wasteIfAll) })}
                              </p>
                            )}
                            {financials.lostMarginIfStockout != null && financials.shortfallQty > 0 && (
                              <p>
                                {t("today.table.stockoutWarning", { quantity: formatQuantity(financials.shortfallQty, financials.unit), margin: formatCurrency(financials.lostMarginIfStockout) })}
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
                      {t("today.table.item")}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("today.table.aiSuggests")}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("today.table.confidence")}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("today.table.yourPlan")}
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
                                  {popularityLabel(t, forecastRankById[item.id] ?? 999)}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* AI Suggests */}
                          <td className="px-4 py-4">
                            {(() => {
                              const avail = (item.suggestion_reason_json as any)?.availability;
                              const isSupplyConstrained = avail?.available === false && avail?.suppressed_demand === false;
                              return isSupplyConstrained ? (
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex h-6 w-fit items-center rounded-full border border-status-warning/30 bg-status-warning/10 px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-status-warning">
                                    Supply Constrained
                                  </span>
                                  <span className="text-sm font-semibold text-status-warning">0 {item.unit}</span>
                                </div>
                              ) : (
                                <p className="font-display text-lg font-semibold text-text-primary">
                                  {formatQuantity(item.suggested_quantity, item.unit)}
                                </p>
                              );
                            })()}
                            <p className="mt-0.5 text-xs text-text-muted">
                              {t("today.table.expectedOrders", { orders: Math.round(item.forecast_context.predicted_orders) })}
                            </p>
                          </td>

                          {/* Confidence + Risk */}
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold text-text-primary">
                              {percent(item.forecast_context.confidence_score)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-text-muted">
                              {confidenceLabel(t, item.forecast_context.confidence_score)}
                            </p>
                            <span className={`mt-1.5 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${riskTone(riskScore)}`}>
                              {riskLabel(t, riskScore)} {t("today.table.risk")}
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
                                ? t("today.table.matchesSuggestion")
                                : variance > 0
                                  ? `${signedQuantity(variance, item.unit)} ${t("today.table.above")}`
                                  : `${signedQuantity(variance, item.unit)} ${t("today.table.below")}`}
                            </p>
                            {(() => {
                              const line = overrideImpactLine(t, impact, variance, item.suggested_quantity);
                              return line ? (
                                <p className={`mt-0.5 text-[11px] font-medium ${line.tone === "warning" ? "text-status-warning" : "text-status-critical"}`}>
                                  {line.text}
                                </p>
                              ) : null;
                            })()}
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
                                {t("today.table.accept")}
                              </button>
                              <button
                                type="button"
                                onClick={() => keepMyPlan(item.id, planned, item.unit)}
                                disabled={isPlanLocked}
                                className="inline-flex h-7 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/20"
                              >
                                {t("today.table.keepMine")}
                              </button>
                            </div>
                            <div className="mt-1.5 flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => toggleItemExpand(item.id)}
                                className="text-[11px] font-semibold text-brand-gold transition-colors hover:text-brand-gold/80"
                              >
                                {isExpanded ? t("today.table.hide") : t("today.table.whyDesktop")}
                              </button>
                              <Link
                                href={`/workspace/today/item/${item.id}?branch=${safeBranchId}&date=${targetDate}&title=${encodeURIComponent(item.product_title)}&product_id=${item.product_id}&org=${user?.organization_id ?? ""}`}
                                className="text-[11px] font-medium text-brand-gold/70 transition-colors hover:text-brand-gold"
                              >
                                {t("today.table.deepDive")}
                              </Link>
                              <Link
                                href={`/workspace/items/${item.product_id}?branch=${safeBranchId}`}
                                className="text-[11px] font-medium text-text-muted transition-colors hover:text-brand-gold"
                              >
                                {t("today.table.trackRecord")}
                              </Link>
                              {isMorning && (
                                <button
                                  type="button"
                                  onClick={() => setMarkUnavailableItem({ id: item.product_id, title: item.product_title })}
                                  className="text-[11px] font-medium text-text-muted transition-colors hover:text-status-warning"
                                >
                                  Mark Unavailable
                                </button>
                              )}
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
                                    {t("today.table.whyThisQuantity")}
                                  </p>
                                  <div className="space-y-0.5">
                                    {item.forecast_context.reasoning.map((line) => (
                                      <p key={`r-${item.id}-${line}`}>{line}</p>
                                    ))}
                                  </div>
                                  {/* Batch constraint annotation */}
                                  {(() => {
                                    const constraints = (item.suggestion_reason_json as any)?.constraints as any[] | undefined;
                                    if (!constraints?.length) return null;
                                    return (
                                      <div className="mt-2 space-y-0.5 border-t border-surface-4/40 pt-2">
                                        {constraints.map((c: any, i: number) => (
                                          <p key={i} className="text-text-muted">
                                            Batch rule: {c.raw_qty} → {c.rounded_qty}
                                            {c.batch_size != null ? ` (batch size ${c.batch_size})` : ""}
                                          </p>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Signals */}
                                {item.forecast_context.applied_signals ? (
                                  <div>
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                              {t("today.table.signalAdjustments")}
                                    </p>
                                    <div className="space-y-1">
                                      {Object.entries(item.forecast_context.applied_signals).map(([key, signal]: [string, any]) => {
                                        const modifier = signal?.modifier ?? 0;
                                        if (Math.abs(modifier) < 0.005) return null;
                                        return (
                                          <div key={key} className="flex items-center justify-between">
                                            <span className="text-text-secondary">{signalLabel(t, key)}</span>
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
                                  {impact?.narrative ? (
                                    <div className="mb-3">
                                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                        {t("today.table.overrideImpact")}
                                      </p>
                                      <p className={`text-sm font-medium ${impact.delta_quantity > 0 ? "text-status-warning" : "text-status-critical"}`}>
                                        {impact.narrative}
                                      </p>
                                    </div>
                                  ) : impact ? (
                                    <div className="mb-3">
                                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                        {t("today.table.marginImpact")}
                                      </p>
                                      <p className={`text-sm font-semibold ${impact.margin_impact_estimate >= 0 ? "text-status-success" : "text-status-critical"}`}>
                                        {formatSignedCurrency(impact.margin_impact_estimate)}
                                      </p>
                                    </div>
                                  ) : null}
                                  {hasPricing ? (
                                    <div className="space-y-0.5">
                                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                        {t("today.table.financialScenarios")}
                                      </p>
                                      {financials.revenueIfSold != null && (
                                        <p>
                                          {financials.marginIfSold != null
                                            ? t("today.table.ifSoldOutWithMargin", { revenue: formatCurrency(financials.revenueIfSold), margin: formatCurrency(financials.marginIfSold) })
                                            : t("today.table.ifSoldOut", { revenue: formatCurrency(financials.revenueIfSold) })}
                                        </p>
                                      )}
                                      {financials.wasteIfAll != null && (
                                        <p>
                                          {t("today.table.ifWasted", { cost: formatCurrency(financials.wasteIfAll) })}
                                        </p>
                                      )}
                                      {financials.lostMarginIfStockout != null && financials.shortfallQty > 0 && (
                                        <p>
                                          {t("today.table.stockoutWarning", { quantity: formatQuantity(financials.shortfallQty, financials.unit), margin: formatCurrency(financials.lostMarginIfStockout) })}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-text-muted">
                            {t("today.table.missingPricing")}
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
                {" "}{t("today.prepPlan.ofCount", { total: forecastRowsByDemand.length })}
                {decisionSummary.reviewed < forecastRowsByDemand.length ? (
                  <span className="ml-2 text-text-muted">
                    · {forecastRowsByDemand.length - decisionSummary.reviewed} {t("today.prepPlan.pending")}
                  </span>
                ) : (
                  <span className="ml-2 text-status-success">· {t("today.table.allReviewed")}</span>
                )}
                {!isPlanLocked && (
                  <span className="ml-3 text-xs text-text-muted">{t("today.prepPlan.lockToStart")}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={lockPlan}
                  disabled={isPlanLocked || lockPlanMutation.isPending}
                  className="inline-flex h-10 items-center rounded-full border border-surface-4 px-5 text-sm font-semibold text-text-primary transition-all duration-200 hover:border-status-success/60 hover:text-status-success active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPlanLocked ? t("today.prepPlan.planLocked") : lockPlanMutation.isPending ? t("today.prepPlan.locking") : t("today.prepPlan.lockPlan")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction("START_LIVE")}
                  disabled={updateBranchDayStatusMutation.isPending || !isPlanLocked}
                  className="inline-flex h-10 items-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-[#141416] transition-all duration-200 hover:bg-[#B8962E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updateBranchDayStatusMutation.isPending ? t("today.prepPlan.starting") : t("today.prepPlan.startService")}
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
              {t("today.morning.moreContext")}
            </summary>

            <div className="mt-4 space-y-6">
              {/* Network intelligence */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
                  {t("today.morning.otherKitchens")}
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
                            {typeof learning.confidence === "number" ? ` ${t("today.morning.reliability", { pct: percent(learning.confidence) })}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">{t("today.morning.nothingNotable")}</p>
                )}
                {networkSuggestedAction ? (
                  <p className="mt-3 text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">{t("today.morning.suggested")}: </span>
                    {networkSuggestedAction}
                  </p>
                ) : null}
              </div>

              {/* Decision summary */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
                  {t("today.morning.decisionSummary")}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
                  <span>{t("today.morning.reviewed")}: <span className="font-semibold text-text-primary">{decisionSummary.reviewed}</span></span>
                  <span>{t("today.morning.usedSuggestion")}: <span className="font-semibold text-status-success">{decisionSummary.accepted}</span></span>
                  <span>{t("today.morning.ownNumber")}: <span className="font-semibold text-status-warning">{decisionSummary.overridden}</span></span>
                  <span>{t("today.morning.wasteExposure")}: <span className="font-semibold text-text-primary">{decisionSummary.projectedWaste.toFixed(1)}%</span></span>
                  <span>
                    {t("today.morning.forecastImpact")}:{" "}
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
                  {t("today.live.status")}
                </p>
                <h3 className="font-display text-2xl font-semibold text-text-primary">
                  {t("today.live.monitor")}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCsvModalOpen(true)}
                className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary hover:border-brand-gold/50 hover:text-brand-gold"
              >
                {t("today.live.csvImport")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction("CLOSE_DAY")}
                disabled={updateBranchDayStatusMutation.isPending}
                className="inline-flex h-9 items-center justify-center rounded-full border border-surface-4 px-5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-status-critical/60 hover:text-status-critical active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateBranchDayStatusMutation.isPending ? t("today.live.closing") : t("today.live.closeDay")}
              </button>
            </div>
          </div>
          {showCsvImportBanner ? (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-status-success/35 bg-status-success/10 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-status-success">
                  {t("today.live.csvImportComplete")}
                </p>
                <p className="mt-1 text-sm text-text-primary">
                  {t("today.live.csvImportDescription")}
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
                {t("today.live.dismiss")}
              </button>
            </div>
          ) : null}
          <ModalShell
            open={csvModalOpen}
            onClose={() => {
              setCsvModalOpen(false);
              resetCsvUploadState();
            }}
            title={t("today.csv.modalTitle")}
            description={t("today.csv.modalDescription")}
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
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={proceedToCsvMapping}
                  disabled={!csvUploadFile}
                  className="inline-flex h-10 items-center rounded-full border border-brand-gold/45 px-4 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("today.csv.continueToMapping")}
                </button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("today.csv.template")}
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  {t("today.csv.templateDescription")}
                </p>
                <button
                  type="button"
                  onClick={handleCsvDownload}
                  className="mt-3 inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-semibold text-text-primary hover:bg-surface-3"
                >
                  {t("today.csv.downloadTemplate")}
                </button>
              </div>

              <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("today.csv.upload")}
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  {t("today.csv.uploadDescription")}
                </p>
                <label className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-full border border-surface-4 bg-surface-2 px-4 py-2 text-sm text-text-secondary hover:border-brand-gold">
                  <span>
                    {csvUploadFile ? csvUploadFile.name : t("today.csv.chooseFile")}
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
                    {t("today.csv.browse")}
                  </span>
                </label>
                {csvUploadStatus ? (
                  <p className="mt-2 text-xs text-text-secondary">
                    {csvUploadStatus}
                  </p>
                ) : null}
                {csvUploadHeaders.length ? (
                  <p className="mt-2 text-xs text-text-muted">
                    {t("today.csv.columnsDetectedList", { columns: csvUploadHeaders.join(", ") })}
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

          {/* ── System health banner — POS / data gap alert ── */}
          {branchDay.system_health && branchDay.system_health.readiness !== "GREEN" ? (
            <div
              className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 ${
                branchDay.system_health.readiness === "RED"
                  ? "border-status-critical/35 bg-status-critical/8"
                  : "border-status-warning/35 bg-status-warning/8"
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  branchDay.system_health.readiness === "RED"
                    ? "bg-status-critical"
                    : "bg-status-warning animate-pulse"
                }`}
              />
              <p
                className={`text-sm font-medium ${
                  branchDay.system_health.readiness === "RED"
                    ? "text-status-critical"
                    : "text-status-warning"
                }`}
              >
                {branchDay.system_health.note}
              </p>
            </div>
          ) : null}

          {/* ── TIER 1: NEEDS ACTION ── */}
          {criticalRows.length > 0 ? (
            <div className="mb-7">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-status-critical animate-pulse" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-status-critical">
                  {t("today.live.needsAction")} · {criticalRows.length}
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
                            <span>{t("today.live.sold", { quantity: formatQuantity(sold, item.unit) })}</span>
                            <span>{t("today.live.prepared", { quantity: formatQuantity(totalPrepared, item.unit) })}</span>
                          </div>
                        </div>
                        {runoutMin !== null && (
                          <div className="shrink-0 rounded-xl border border-status-critical/40 bg-status-critical/10 px-4 py-2.5 text-center">
                            <p className="font-display text-3xl font-semibold tabular-nums text-status-critical leading-none">
                              {runoutMin}
                            </p>
                            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-status-critical/70">
                              {t("today.live.minLeft")}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Stock bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-muted">
                            {t("today.live.remaining", { quantity: formatQuantity(remaining, item.unit) })}
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
                            ? t("today.live.startBatchNow", { runoutMin, prepTimeMin })
                            : runoutMin !== null
                              ? t("today.live.cookMoreRunout", { runoutMin })
                              : t("today.live.cookMoreNow")}
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
                                  t("today.reason.demandSpike"),
                                )
                              }
                              className="inline-flex h-10 items-center rounded-full border border-status-success/50 bg-status-success/15 px-4 text-sm font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98]"
                            >
                              {t("today.live.prepare", { quantity: formatQuantity(Math.max(1, suggestedAdditional), item.unit) })}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => logProduction(item.id, 1, t("today.reason.demandSpike"))}
                              className="inline-flex h-10 items-center rounded-full border border-status-success/50 bg-status-success/15 px-4 text-sm font-semibold text-status-success transition-colors hover:bg-status-success/25 active:scale-[0.98]"
                            >
                              {t("today.live.cookMore")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => quickTapSale(item.id, item, 1)}
                            className="inline-flex h-10 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary hover:bg-surface-3"
                          >
                            {t("today.live.plusOneSold")}
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
                  {t("today.live.keepEye")} · {watchRows.length}
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
                    ? t("today.live.slowSales")
                    : runoutMin !== null && runoutMin < 45
                      ? t("today.live.mayNeedMore", { runoutMin })
                      : t("today.live.runningSteady");

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
                            {t("today.live.left", { quantity: formatQuantity(remaining, item.unit) })}
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
                          {t("today.live.plusOneSold")}
                        </button>
                        <button
                          type="button"
                          onClick={() => logProduction(item.id, 1)}
                          className="inline-flex h-8 items-center rounded-full border border-brand-gold/40 px-3 text-xs font-medium text-brand-gold hover:bg-brand-gold/10 active:scale-[0.97]"
                        >
                          {t("today.live.plusBatch")}
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
                    {t("today.live.onTrack")} · {okRows.length} {t("today.live.items")}
                  </span>
                </div>
                <span className="text-xs text-text-muted">
                  {showOkRows ? t("today.live.hide") : t("today.live.showAll")}
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
                            {t("today.live.plusOne")}
                          </button>
                          <button
                            type="button"
                            onClick={() => logProduction(item.id, 1)}
                            className="inline-flex h-7 items-center rounded-full border border-surface-4 px-2.5 text-[11px] text-text-muted hover:bg-surface-3 active:scale-[0.97]"
                          >
                            {t("today.live.plusBatch")}
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
                {t("today.live.allClear")}
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
              accuracy >= 85 && stockouts === 0 ? "great"
              : accuracy >= 75 && stockouts <= 1 ? "good"
              : accuracy >= 60 ? "solid"
              : "tough";
            const gradeLabel = grade === "great" ? t("today.closed.great")
              : grade === "good" ? t("today.closed.good")
              : grade === "solid" ? t("today.closed.solid")
              : t("today.closed.tough");
            const gradeClass =
              grade === "great" || grade === "good" ? "text-status-success"
              : grade === "solid" ? "text-status-warning"
              : "text-status-critical";
            const gradeSub =
              grade === "great"
                ? t("today.closed.greatSub", { accuracy: accuracy.toFixed(0) })
                : grade === "good"
                  ? stockouts === 0
                    ? t("today.closed.goodSubNoStockouts", { accuracy: accuracy.toFixed(0) })
                    : t("today.closed.goodSubStockouts", { accuracy: accuracy.toFixed(0), stockouts })
                  : grade === "solid"
                    ? t("today.closed.solidSub", { accuracy: accuracy.toFixed(0) })
                    : t("today.closed.toughSub");

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
                    {t("today.closed.dayClosed")} · {new Date(branchDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                  <h3 className={`mt-1 font-display text-4xl font-semibold ${gradeClass}`}>
                    {gradeLabel}
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
                    label: t("today.closed.aiAccuracy"),
                    value: `${accuracy.toFixed(0)}%`,
                    sub: accDelta
                      ? t("today.closed.accuracyDelta", { arrow: accDelta.direction === "up" ? "↑" : accDelta.direction === "down" ? "↓" : "→", pct: Math.abs(accDelta.delta_pct).toFixed(0), day: new Date(branchDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" }) })
                      : t("today.closed.vsLastSameDay"),
                    tone: accuracy >= 80 ? "text-status-success" : accuracy >= 65 ? "text-status-warning" : "text-status-critical",
                  },
                  {
                    label: t("today.closed.wasteCost"),
                    value: formatCurrency(wasteCost),
                    sub: wasteDelta
                      ? t("today.closed.wasteDelta", { direction: wasteDelta.direction })
                      : null,
                    tone: wasteCost === 0 ? "text-status-success" : wasteDelta?.direction === "down" ? "text-status-success" : "text-status-warning",
                  },
                  {
                    label: t("today.closed.revenueProtected"),
                    value: formatCurrency(revenueProtected),
                    sub: t("today.closed.fromAvoidingStockouts"),
                    tone: revenueProtected > 0 ? "text-status-success" : "text-text-muted",
                  },
                  {
                    label: t("today.closed.stockouts"),
                    value: stockouts === 0 ? t("today.closed.none") : `${stockouts}`,
                    sub: stockouts === 0 ? t("today.closed.cleanService") : t("today.closed.itemsRanOut", { count: stockouts }),
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
                    {t("today.closed.howEachItemDid")}
                  </p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
                    {rp.item_performance.rows.map((row) => {
                      const isStockout = row.stockout;
                      const wasteRatio = row.prepared > 0 ? row.waste / row.prepared : 0;
                      const hasWaste = !isStockout && wasteRatio > 0.08;
                      const outcome = isStockout
                        ? { icon: "⚡", label: t("today.closed.ranShort"), cls: "text-status-critical", sub: row.lost_revenue_estimate > 0 ? t("today.closed.missedRevenue", { amount: formatCurrency(row.lost_revenue_estimate) }) : null }
                        : hasWaste
                          ? { icon: "○", label: t("today.closed.hadWaste"), cls: "text-status-warning", sub: t("today.closed.leftover", { quantity: formatQuantity(row.waste, row.unit) }) }
                          : { icon: "✓", label: t("today.closed.soldClean"), cls: "text-status-success", sub: null };
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
                              {t("today.closed.soldQuantity", { quantity: formatQuantity(row.sold, row.unit) })}
                            </p>
                            {row.prepared > 0 && (
                              <p className="text-xs text-text-muted">
                                {t("today.closed.ofPrepped", { quantity: formatQuantity(row.prepared, row.unit) })}
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
                    {t("today.closed.whereYouDiverged")}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {t("today.closed.changedPlan", { count: overrideItems.length })}{" "}
                    {t("today.closed.howItPlayed")}
                  </p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
                    {overrideItems.map((row) => {
                      const won = row.service_outcome === "IMPROVED_BY_CHEF";
                      const snapshot = branchDay.review_item_snapshot?.find((s) => s.item_id === row.item_id);
                      const wasteCost = snapshot ? parseFloat(snapshot.waste_cost) : 0;
                      const missedRevenue = snapshot ? parseFloat(snapshot.lost_revenue_estimate) : 0;
                      const costLine = wasteCost > 1
                        ? t("today.closed.wasteLine", { amount: formatCurrency(wasteCost) })
                        : missedRevenue > 1
                          ? t("today.closed.missedLine", { amount: formatCurrency(missedRevenue) })
                          : null;
                      return (
                        <div key={row.item_id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5">
                          <p className="min-w-[140px] text-sm font-medium text-text-primary">{row.item_title}</p>
                          <div className="flex items-center gap-2 text-xs text-text-muted">
                            <span>{t("today.closed.ai")}: <span className="font-medium text-text-secondary">{formatQuantity(row.forecast_qty, row.unit)}</span></span>
                            <span className="text-text-muted">→</span>
                            <span>{t("today.closed.you")}: <span className="font-medium text-text-secondary">{formatQuantity(row.chef_planned_qty, row.unit)}</span></span>
                            <span className="text-text-muted">→</span>
                            <span>{t("today.closed.sold")}: <span className="font-semibold text-text-primary">{formatQuantity(row.actual_sales, row.unit)}</span></span>
                            {costLine && (
                              <span className={won ? "text-status-success" : "text-status-warning"}>
                                · {costLine}
                              </span>
                            )}
                          </div>
                          <span className={`ml-auto shrink-0 text-xs font-semibold ${won ? "text-status-success" : "text-status-warning"}`}>
                            {won ? t("today.closed.yourCallPaidOff") : t("today.closed.aiWasCloser")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {(rp.learning_signals.ml_learning_signals?.chef_outperformed_forecast_rows ?? 0) > 0 && (
                    <p className="mt-3 text-xs text-status-success">
                      {t("today.closed.overridesImproved", { count: rp.learning_signals.ml_learning_signals?.chef_outperformed_forecast_rows ?? 0 })}
                    </p>
                  )}
                </section>
              ) : null}

              {/* ── 5. WHAT THE MODEL LEARNED ── */}
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  {t("today.closed.whatModelLearned")}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-0 rounded-xl border border-surface-4 bg-surface-2 overflow-hidden sm:grid-cols-4 divide-x divide-surface-4/60">
                  {[
                    {
                      value: rp.learning_signals.ml_learning_signals?.rows ?? rp.learning_signals.training_rows.length,
                      label: t("today.closed.trainingSignals"),
                      sub: t("today.closed.itemsTracked"),
                    },
                    {
                      value: rp.learning_signals.ml_learning_signals?.chef_override_rows ?? overrideItems.length,
                      label: t("today.closed.yourOverrides"),
                      sub: t("today.closed.planChanges"),
                    },
                    {
                      value: rp.learning_signals.ml_learning_signals?.waste_rows ?? 0,
                      label: t("today.closed.wasteEvents"),
                      sub: t("today.closed.itemsWithLeftover"),
                    },
                    {
                      value: rp.learning_signals.ml_learning_signals?.stockout_rows ?? stockouts,
                      label: t("today.closed.stockouts"),
                      sub: t("today.closed.itemsThatRanOut"),
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
                  {t("today.closed.modelImproves")}
                </p>
              </section>

              {/* ── 6. TOMORROW ── */}
              <section className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  {t("today.closed.beforeTomorrow")}
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {rp.tomorrow_early_signal.message}
                </p>
                {rp.tomorrow_early_signal.expected_demand_change_pct !== 0 && (
                  <p className="mt-1 text-xs text-text-muted">
                    {t("today.closed.demandExpectedToBe")}{" "}
                    <span className={`font-semibold ${rp.tomorrow_early_signal.expected_demand_change_pct > 0 ? "text-status-success" : "text-status-warning"}`}>
                      {rp.tomorrow_early_signal.expected_demand_change_pct > 0 ? "+" : ""}{rp.tomorrow_early_signal.expected_demand_change_pct.toFixed(0)}%
                    </span>{" "}
                    {rp.tomorrow_early_signal.weekday ? t("today.closed.vsTypical", { day: rp.tomorrow_early_signal.weekday }) : t("today.closed.vsBaseline")}
                    {rp.tomorrow_early_signal.sample_size ? t("today.closed.basedOn", { count: rp.tomorrow_early_signal.sample_size }) : ""}
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
                  {t("today.closed.previewTomorrow")}
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
                    { value: "FIRED_UP", emoji: "🔥", label: t("today.closed.firedUp") },
                    { value: "GOOD",     emoji: "😊", label: t("today.closed.good") },
                    { value: "MEH",      emoji: "😐", label: t("today.closed.meh") },
                    { value: "ROUGH",    emoji: "😮‍💨", label: t("today.closed.rough") },
                  ];
                  return (
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {t("today.closed.howLeaving")}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {t("today.closed.feelRightNow")}
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
                                    const pool = reactionMessages[next] ?? [];
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
                    {t("today.closed.anythingWorthNoting")}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {t("today.closed.contextMakesSharper")}
                  </p>
                  {noteSaved ? (
                    <p className="mt-4 text-sm text-status-success">{t("today.closed.saved")}</p>
                  ) : (
                    <div className="mt-3">
                      <textarea
                        rows={3}
                        placeholder={t("today.closed.notePlaceholder")}
                        value={dayNote || branchDay.session_notes || ""}
                        onChange={(e) => setDayNote(e.target.value)}
                        className="w-full resize-none rounded-xl border border-surface-4 bg-surface-3 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[11px] text-text-muted">{t("today.closed.notShared")}</p>
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
                          {updateBranchDayNotesMutation.isPending ? t("today.closed.saving") : t("today.closed.saveNote")}
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
              <p className="text-sm text-text-muted">{t("today.closed.preparingSummary")}</p>
              <p className="mt-1 text-xs text-text-muted">{t("today.closed.takesAFewSeconds")}</p>
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
            {t("today.statusIs")}{" "}
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
            {t("today.noActivePrepItems")}
          </p>
        </div>
      ) : null}

      <ConfirmActionModal
        open={confirmAction === "START_LIVE"}
        title={t("today.modal.startServiceTitle")}
        description={t("today.modal.startServiceDescription")}
        confirmLabel={t("today.modal.startServiceConfirm")}
        isConfirming={updateBranchDayStatusMutation.isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={startLiveService}
      />

      <ConfirmActionModal
        open={confirmAction === "CLOSE_DAY"}
        title={t("today.modal.closeDayTitle")}
        description={t("today.modal.closeDayDescription")}
        confirmLabel={t("today.modal.closeDayConfirm")}
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

      <MarkUnavailableModal
        open={Boolean(markUnavailableItem)}
        onClose={() => setMarkUnavailableItem(null)}
        branchId={safeBranchId}
        item={markUnavailableItem}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: productionIntelligenceQueryKeys.branchDayToday({ branch_id: safeBranchId, date: targetDate }),
          });
          queryClient.invalidateQueries({
            queryKey: inventoryQueryKeys.availabilityOverrides(safeBranchId),
          });
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
