"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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

function confidenceLabel(t: any, score: number) {
  if (score >= 0.75) return t("workspace.today.confidence.high");
  if (score >= 0.5) return t("workspace.today.confidence.medium");
  return t("workspace.today.confidence.low");
}

function percent(value: number) {
  const normalized = Math.max(0, Math.min(1, value));
  return `${(normalized * 100).toFixed(0)}%`;
}

function confidenceNarrative(t: any, score?: number | null) {
  if (score == null) return t("workspace.today.confidence.narrative.none");
  if (score >= 0.75) return t("workspace.today.confidence.narrative.high");
  if (score >= 0.5) return t("workspace.today.confidence.narrative.moderate");
  return t("workspace.today.confidence.narrative.low");
}

function agreementNarrative(t: any, score?: number | null) {
  if (score == null) return t("workspace.today.agreement.narrative.none");
  if (score >= 0.75) return t("workspace.today.agreement.narrative.high");
  if (score >= 0.5) return t("workspace.today.agreement.narrative.moderate");
  return t("workspace.today.agreement.narrative.low");
}

function velocitySummary(
  t: any,
  comparison?: {
    status?: string;
    deviation_pct?: number;
  },
) {
  if (!comparison || !comparison.status) {
    return t("workspace.today.velocity.noCheck");
  }
  const deviation = comparison.deviation_pct ?? 0;
  const absDeviation = Math.abs(deviation);
  const deviationLabel = `${absDeviation.toFixed(0)}%`;
  if (comparison.status === "HIGH_DEMAND") {
    return t("workspace.today.velocity.highDemand", {
      percent: deviationLabel,
    });
  }
  if (comparison.status === "LOW_DEMAND") {
    return t("workspace.today.velocity.lowDemand", { percent: deviationLabel });
  }
  return t("workspace.today.velocity.match");
}

function velocityStatusTone(status?: string) {
  if (status === "HIGH_DEMAND") return "text-status-critical";
  if (status === "LOW_DEMAND") return "text-status-warning";
  return "text-status-success";
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

function riskLabel(t: any, value: number) {
  if (value >= 0.45) return t("workspace.today.confidence.high");
  if (value >= 0.25) return t("workspace.today.confidence.medium");
  return t("workspace.today.confidence.low");
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

function popularityLabel(t: any, rank: number) {
  if (rank <= 3) return t("workspace.today.popularity.top3");
  if (rank <= 5) return t("workspace.today.popularity.highDemand");
  return t("workspace.today.popularity.rank", { rank });
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

  const role = user?.organization_role ?? "";
  const canAccess =
    role === "STAFF_OPERATOR" || role === "BRANCH_MANAGER" || role === "GM";

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
  const todayQuery = useBranchDayToday(
    { branch_id: safeBranchId, date: targetDate },
    Boolean(safeBranchId),
  );
  const initializeMutation = useInitializeBranchDay();
  const evaluateMutation = useEvaluatePrepPlan();
  const lockPlanMutation = useLockBranchDayPlan();
  const updateBranchDayStatusMutation = useUpdateBranchDayStatus();
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
        label: t("workspace.today.network.demandTrending", {
          item: positivePattern.item_name,
          percent: `${positivePattern.effect_pct >= 0 ? "+" : ""}${positivePattern.effect_pct.toFixed(1)}%`,
        }),
        detail: t("workspace.today.network.observedInLocations", {
          count: activeLocations,
          location: t(
            `workspace.today.network.location${activeLocations === 1 ? "" : "s"}`,
          ),
        }),
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
        label: t("workspace.today.network.rainIncrease", {
          item: rainPattern.item_name.toLowerCase(),
        }),
        detail: t("workspace.today.network.validatedInBranches", {
          count: supported || 1,
          branch: t(
            `workspace.today.network.branch${supported === 0 || supported === 1 ? "" : "es"}`,
          ),
        }),
        confidence: rainPattern.confidence,
      });
    }
    const wastePattern = (network.network_aggregation.cross_location_patterns ??
      [])[0];
    if (wastePattern) {
      learnings.push({
        label: t("workspace.today.network.wasteVariance", {
          item: wastePattern.item_name,
        }),
        detail: t("workspace.today.network.visibleAcross", {
          percent: wastePattern.spread_pct.toFixed(1),
        }),
        confidence: wastePattern.confidence,
      });
    }
    return learnings.slice(0, 3);
  }, [branchDay?.kitchen_intelligence_network, t]);
  const networkSuggestedAction = useMemo(() => {
    const transfer =
      branchDay?.kitchen_intelligence_network?.knowledge_transfer?.[0];
    if (transfer?.suggested_action) return transfer.suggested_action;
    const wastePattern =
      branchDay?.kitchen_intelligence_network?.network_aggregation
        ?.cross_location_patterns?.[0];
    if (!wastePattern) return t("workspace.today.network.noAction");
    return t("workspace.today.network.reduceExposure", {
      item: wastePattern.item_name,
    });
  }, [branchDay?.kitchen_intelligence_network, t]);
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
            [prepPlanItemId]: t("workspace.today.feedback.acceptError"),
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
            [prepPlanItemId]: t("workspace.today.feedback.keepError"),
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
        message: t("workspace.today.feedback.acceptedAi"),
      };
    }
    if (item.decision === "CHEF_OVERRIDE") {
      return {
        tone: "warning" as const,
        message: t("workspace.today.feedback.chefOverride"),
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
      setCsvUploadError(t("workspace.today.live.csvErrorFile"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCsvUploadError(t("workspace.today.live.csvErrorSize"));
      return;
    }
    try {
      const parsed = await parseCSVFile(file);
      if (!parsed.headers.length) {
        setCsvUploadError(t("workspace.today.live.csvErrorHeader"));
        return;
      }
      setCsvUploadFile(file);
      setCsvUploadHeaders(parsed.headers);
      setCsvUploadStatus(
        t("workspace.today.live.csvColumnsDetected", {
          count: parsed.headers.length,
        }),
      );
    } catch {
      setCsvUploadError(t("workspace.today.live.csvErrorRead"));
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
        setCsvUploadError(t("workspace.today.live.csvDownloadError"));
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "prepIQ_pos_sales_import_template.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
      setCsvUploadStatus(t("workspace.today.live.csvDownloadStatus"));
    } catch {
      setCsvUploadError(t("workspace.today.live.csvDownloadError"));
    }
  };

  const proceedToCsvMapping = () => {
    if (!csvUploadFile || !branchId) {
      setCsvUploadError(t("workspace.today.live.csvSelectError"));
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
    ? t("common.loading")
    : noBranchContext
      ? t("workspace.common.noBranchContext")
      : branchDay?.status === "MORNING"
        ? t("workspace.today.status.planning")
        : branchDay?.status === "LIVE"
          ? t("workspace.today.status.live")
          : branchDay?.status === "CLOSED"
            ? t("workspace.today.status.closed")
            : branchId
              ? t("workspace.today.status.settingUp")
              : t("workspace.common.selectBranch");
  const todayQueryErrorMessage = useMemo(() => {
    if (!todayQuery.isError) return "";
    const err = todayQuery.error as {
      message?: string;
      details?: unknown;
      status?: number;
    } | null;
    if (!err) return t("workspace.today.live.loadDayError");
    if (typeof err.message === "string" && err.message.length)
      return err.message;
    const details = (err as any)?.details;
    if (typeof details?.message === "string") return details.message;
    if (typeof details?.detail === "string") return details.detail;
    if (typeof details?.error === "string") return details.error;
    return t("workspace.today.live.loadDayError");
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
        t("workspace.today.risk.drivers.planVsSuggested", {
          planned: formatQuantity(plannedQty, item.unit),
          suggested: formatQuantity(item.suggested_quantity, item.unit),
        }),
        t("workspace.today.risk.drivers.expectedOrders", {
          orders: Math.round(item.forecast_context.predicted_orders),
          confidence,
          percent: percent(item.forecast_context.confidence_score),
        }),
      ];
      if (primaryRiskType === "STOCKOUT") {
        drivers.push(
          shortfallQty > 0
            ? t("workspace.today.risk.drivers.belowBaseline", {
                quantity: formatQuantity(shortfallQty, item.unit),
              })
            : t("workspace.today.risk.drivers.highDemandPressure"),
        );
      }
      if (primaryRiskType === "WASTE") {
        drivers.push(
          overprepQty > 0
            ? t("workspace.today.risk.drivers.aboveBaseline", {
                quantity: formatQuantity(overprepQty, item.unit),
              })
            : t("workspace.today.risk.drivers.weakSellThrough"),
        );
      }
      if (primaryRiskType === "MARGIN" && impact) {
        drivers.push(
          t("workspace.today.risk.drivers.marginShift", {
            amount: formatSignedCurrency(impact.margin_impact_estimate),
          }),
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
        detail: t("workspace.today.risk.alertDetail", {
          type: t(
            `workspace.today.risk.types.${primaryRiskType.toLowerCase() as "stockout" | "waste" | "margin"}`,
          ),
          severity: primaryRiskSeverity.toLowerCase(),
        }),
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
  }, [rows, t]);

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
        ? t("workspace.today.outlook.maintainBaseline", {
            items: priorityItems.join(" and "),
          })
        : t("workspace.today.outlook.maintainBaselineAll");
    }

    const planDelta = deltaPlan ? `${deltaPlan}` : "";
    return priorityItems.length
      ? t("workspace.today.outlook.planDelta", {
          delta: planDelta,
          items: priorityItems.join(" and "),
          reason:
            directionWord === "up"
              ? t("workspace.today.outlook.sensitiveToSurges")
              : t("workspace.today.outlook.exposedToWaste"),
        })
      : t("workspace.today.outlook.reviewHighDemand", { delta: planDelta });
  }, [branchDay, rows, demandDeltaPct, forecastRowsByDemand, t]);

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
      eyebrow={t("workspace.today.eyebrow")}
      title={t("workspace.today.title")}
      description={t("workspace.today.description")}
      insight={t("workspace.today.insight")}
    >
      {/* Slim context bar — no heavy card */}
      <div className="mb-8 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-6">
        <div className="flex-1 min-w-[180px] max-w-xs">
          <Select
            label={t("common.branch")}
            leadingIcon={<Shop className="h-4 w-4" />}
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={branchId}
            onChange={setBranchId}
            disabled={noBranchContext}
            placeholder={
              noBranchContext ? t("workspace.common.noBranches") : t("workspace.common.selectBranch")
            }
          />
        </div>

        <div className="flex-1 min-w-[160px] max-w-xs">
          <OperationalCalendar
            label={t("common.date")}
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

      {todayQuery.isError ? (
        <div className="mb-6 rounded-lg border-status-warning bg-status-warning/8 px-4 py-3 text-xs text-status-warning">
          <p className="font-semibold">{t("workspace.common.dayDataNotAvailable")}</p>
          <p className="mt-1 text-text-secondary">{todayQueryErrorMessage}</p>
          {canInitializeDay && safeBranchId ? (
            <button
              type="button"
              onClick={() =>
                initializeMutation.mutate({
                  branch_id: safeBranchId,
                  date: targetDate,
                })
              }
              className="mt-2 inline-flex h-8 items-center rounded-full border border-status-warning/50 px-3 text-xs font-semibold text-status-warning hover:bg-status-warning/10"
            >
              {t("workspace.common.initializeDay")}
            </button>
          ) : null}
        </div>
      ) : null}

      {noBranchContext ? (
        <div className="mt-8 py-16 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-status-warning/20 mb-4">
            <Shop className="h-6 w-6 text-status-warning" />
          </div>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            {t("workspace.common.noBranchContextDesc")}
          </p>
        </div>
      ) : null}

      {isMorning && branchDay ? (
        <>
          {/* ── Outlook banner — collapsible, secondary context ── */}
          <details className="mb-8 group">
            <summary className="flex cursor-pointer items-center justify-between rounded-xl border border-surface-4 bg-surface-2 px-5 py-4 list-none hover:border-surface-4/80 transition-colors">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.outlook.title")}</p>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {demandDeltaPct <= -2
                      ? `${t("workspace.today.outlook.quieter")} · ${t("workspace.today.outlook.expectedDemand", { percent: toPercent(demandDeltaPct) })}`
                      : demandDeltaPct >= 2
                        ? `${t("workspace.today.outlook.busier")} · ${t("workspace.today.outlook.expectedDemand", { percent: toPercent(demandDeltaPct) })}`
                        : t("workspace.today.outlook.normal")}
                    {" · "}
                    <span className={prepConfidenceRiskLabel === "Low" ? "text-status-success" : prepConfidenceRiskLabel === "Medium" ? "text-status-warning" : "text-status-critical"}>
                      {prepConfidenceRiskLabel === "Low" ? t("workspace.today.outlook.planSolid") : prepConfidenceRiskLabel === "Medium" ? t("workspace.today.outlook.reviewFlagged") : t("workspace.today.outlook.elevatedRisk")}
                    </span>
                  </p>
                </div>
              </div>
              <span className="text-xs text-text-muted group-open:hidden">{t("workspace.today.outlook.showDetails")} ↓</span>
              <span className="text-xs text-text-muted hidden group-open:inline">{t("workspace.today.outlook.hide")} ↑</span>
            </summary>

            {/* Single merged card — demand + reliability side by side, tight */}
            <div className="mt-2 px-1">
              <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-surface-4/60">

                  {/* Left — how busy */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.outlook.howBusy")}</p>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className={`font-display text-xl font-semibold ${demandDeltaPct >= 2 ? "text-status-success" : demandDeltaPct <= -2 ? "text-status-warning" : "text-text-primary"}`}>
                        {toPercent(demandDeltaPct)}
                      </span>
                      <span className="text-xs text-text-muted">
                        {demandDeltaPct <= -2 ? t("workspace.today.outlook.quieter") : demandDeltaPct >= 2 ? t("workspace.today.outlook.busier") : t("workspace.today.outlook.normal")}
                      </span>
                    </div>

                    {/* Slim demand meter */}
                    <div className="mt-2 relative h-1 rounded-full bg-surface-4">
                      <div
                        className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-brand-gold"
                        style={{ left: `calc(${demandMeterPosition}% - 5px)` }}
                      />
                    </div>
                    <div className="mt-0.5 flex justify-between text-[9px] text-text-muted/70">
                      <span>{t("workspace.today.outlook.quiet")}</span><span>{t("workspace.today.outlook.normal")}</span><span>{t("workspace.today.outlook.busy")}</span>
                    </div>

                    {/* Signal chips */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {demandSignals.slice(0, 4).map((signal) => (
                        <span
                          key={signal.key}
                          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${signalToneClasses(signal.direction, signal.value_pct)}`}
                        >
                          {signal.label}
                          <span className="font-semibold">
                            {signal.direction === "neutral" ? "—" : toPercent(signal.value_pct)}
                          </span>
                        </span>
                      ))}
                    </div>

                    {outlookActionSentence ? (
                      <p className="mt-2 text-[11px] text-text-secondary border-t border-surface-4/40 pt-2">
                        <span className="font-semibold text-brand-gold">→ </span>
                        {outlookActionSentence}
                      </p>
                    ) : null}
                  </div>

                  {/* Right — plan reliability */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.outlook.planReliability")}</p>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-display text-xl font-semibold text-text-primary">{percent(prepConfidenceGauge)}</span>
                      <span className={`text-xs font-medium ${prepConfidenceRiskLabel === "Low" ? "text-status-success" : prepConfidenceRiskLabel === "Medium" ? "text-status-warning" : "text-status-critical"}`}>
                        {prepConfidenceRiskLabel === "Low" ? t("workspace.today.outlook.goodShape") : prepConfidenceRiskLabel === "Medium" ? t("workspace.today.outlook.needsAttention") : t("workspace.today.outlook.checkAlerts")}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-4">
                      <div
                        className={`h-full rounded-full transition-all ${prepConfidenceRiskLabel === "Low" ? "bg-status-success" : prepConfidenceRiskLabel === "Medium" ? "bg-status-warning" : "bg-status-critical"}`}
                        style={{ width: percent(prepConfidenceGauge) }}
                      />
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                      <div>
                        <p className="text-text-muted">{t("workspace.today.outlook.needsAttention")}</p>
                        <p className="font-semibold text-text-primary">
                          {t("workspace.today.closed.items", { count: branchDay.morning_overview?.high_risk_items ?? branchDay.demand_signal.high_risk_items ?? 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted">{t("workspace.today.outlook.tracked")}</p>
                        <p className="font-semibold text-text-primary">
                          {t("workspace.today.closed.items", { count: branchDay.demand_signal.tracked_items ?? rows.length })}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted">{t("workspace.today.outlook.forecastConfidence")}</p>
                        <p className="font-semibold text-text-primary">
                          {branchDay.demand_signal.confidence_label ?? confidenceLabel(t, branchDay.demand_signal.forecast_confidence)}
                          {" "}
                          <span className="font-normal text-text-muted">({percent(branchDay.demand_signal.forecast_confidence)})</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted">{t("workspace.today.outlook.vsTypical", { day: branchDay.demand_signal.typical_day_label ?? new Date(branchDay.date).toLocaleDateString(t("common.language") === "fr" ? "fr-FR" : "en-US", { weekday: "short" }) })}</p>
                        <p className={`font-semibold ${demandDeltaPct >= 0 ? "text-status-success" : "text-status-critical"}`}>
                          {toPercent(demandDeltaPct)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </details>

          {/* ── Risk alerts — shown above the table when present ── */}
          {morningRiskAlerts.length > 0 && !isPlanLocked ? (
            <div className="mb-6 space-y-2">
              {morningRiskAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start justify-between gap-4 rounded-xl px-4 py-3 ${
                    alert.severity === "HIGH"
                      ? "border-status-critical bg-status-critical/8"
                      : "border-status-warning bg-status-warning/8"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${alert.severity === "HIGH" ? "text-status-critical" : "text-status-warning"}`}>
                      {alert.itemName} ·{" "}
                      {alert.riskType === "STOCKOUT" ? t("workspace.today.risk.mayRunOut") : alert.riskType === "WASTE" ? t("workspace.today.risk.riskOfWaste") : t("workspace.today.risk.marginAtRisk")}
                    </p>
                    <p className="mt-0.5 text-sm text-text-secondary">
                      {alert.riskType === "STOCKOUT"
                        ? t("workspace.today.risk.runOutDesc")
                        : alert.riskType === "WASTE"
                          ? t("workspace.today.risk.wasteDesc")
                          : t("workspace.today.risk.marginDesc")}
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
                    {t("workspace.today.risk.fix", { quantity: formatQuantity(alert.suggestedFixQty, alert.unit) })}
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
                  {t("workspace.today.prepPlan.title")}
                </p>
                <h3 className="font-display text-xl font-semibold text-text-primary sm:text-2xl">
                  {t("workspace.today.prepPlan.subtitle")}
                </h3>
                {/* Inline stats — no cards */}
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-secondary">
                  <span>
                    <span className="font-semibold text-text-primary">
                      {t("workspace.today.prepPlan.items", { count: section2Rows.length, total: forecastRowsByDemand.length })}
                    </span>
                  </span>
                  {(branchDay.morning_overview?.projected_margin_total ?? 0) > 0 ? (
                    <span>
                      {t("workspace.today.prepPlan.projectedMargin", { amount: formatCurrency(branchDay.morning_overview?.projected_margin_total ?? 0) })}
                    </span>
                  ) : null}
                  {branchDay.morning_overview?.chef_accuracy_score?.available ? (
                    <span>
                      {t("workspace.today.prepPlan.yourAccuracy", { percent: branchDay.morning_overview.chef_accuracy_score.chef_forecast_accuracy_pct.toFixed(1) })}
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
                  {importantItemsOnly ? t("workspace.today.prepPlan.priorityItems") : t("workspace.today.prepPlan.allItems")}
                </button>
                <button
                  type="button"
                  onClick={lockPlan}
                  disabled={isPlanLocked || lockPlanMutation.isPending}
                  className="inline-flex h-10 items-center rounded-full border border-surface-4 px-5 text-sm font-semibold text-text-primary transition-all duration-200 hover:border-status-success/60 hover:text-status-success active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPlanLocked ? t("workspace.today.prepPlan.planLocked") : lockPlanMutation.isPending ? t("workspace.today.prepPlan.locking") : t("workspace.today.prepPlan.lockPlan")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction("START_LIVE")}
                  disabled={updateBranchDayStatusMutation.isPending || !isPlanLocked}
                  className="inline-flex h-10 items-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-[#141416] transition-all duration-200 hover:bg-[#B8962E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updateBranchDayStatusMutation.isPending ? t("workspace.today.prepPlan.starting") : t("workspace.today.prepPlan.startService")}
                </button>
              </div>
            </div>
            {!isPlanLocked ? (
              <p className="mb-4 text-xs text-text-muted">{t("workspace.today.prepPlan.lockFirst")}</p>
            ) : branchDay?.plan_lock?.locked_at ? (
              <p className="mb-4 text-xs text-status-success">
                {t("workspace.today.prepPlan.lockedAt", {
                  time: new Date(branchDay.plan_lock.locked_at).toLocaleTimeString(t("common.language") === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" }),
                  user: branchDay.plan_lock.locked_by?.name || ""
                })}
              </p>
            ) : null}

            <div className="mt-2 lg:hidden space-y-3">
              {section2Rows.map(
                ({ item, riskScore, planned, variance, impact }) => {
                  const plannedQty = planned ?? item.suggested_quantity;
                  const financials = buildFinancialSnapshot({
                    plannedQty,
                    predictedQty:
                      item.forecast_context.predicted_quantity_needed,
                    unit: item.unit,
                    unitPrice: item.forecast_context.unit_price,
                    unitCost: item.forecast_context.unit_cost,
                    unitMargin: item.forecast_context.unit_margin,
                  });
                  const hasPricing =
                    item.forecast_context.unit_price != null ||
                    item.forecast_context.unit_cost != null ||
                    item.forecast_context.unit_margin != null;
                  return (
                    <article
                      key={`mobile-forecast-${item.id}`}
                      className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {item.product_image_url && (
                            <img
                              src={item.product_image_url}
                              alt={item.product_title}
                              className="h-12 w-12 rounded-lg object-cover border border-surface-4 shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-text-primary">
                              {item.product_title}
                            </p>
                            <p className="mt-1 text-xs text-text-muted">
                              {popularityLabel(
                                t,
                                forecastRankById[item.id] ?? 999,
                              )}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${riskTone(riskScore)}`}
                        >
                          {riskLabel(t, riskScore)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-3 py-2">
                          <p className="text-text-muted">{t("workspace.today.table.suggestedPrep")}</p>
                          <p className="mt-1 font-semibold text-text-primary">
                            {formatQuantity(item.suggested_quantity, item.unit)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-3 py-2">
                          <p className="text-text-muted">{t("workspace.today.table.expectedOrders")}</p>
                          <p className="mt-1 font-semibold text-text-primary">
                            {Math.round(item.forecast_context.predicted_orders)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-3 py-2">
                          <p className="text-text-muted">{t("workspace.today.table.confidence")}</p>
                          <p className="mt-1 font-semibold text-text-primary">
                            {percent(item.forecast_context.confidence_score)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-3 py-2">
                          <p className="text-text-muted">{t("workspace.today.table.yourPlan")}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <input
                              type="number"
                              step={isDiscreteUnit(item.unit) ? 1 : 0.01}
                              value={plannedQtyByItem[item.id] ?? ""}
                              onChange={(event) =>
                                onPlannedChange(
                                  item.id,
                                  event.target.value,
                                  item.unit,
                                )
                              }
                              disabled={isPlanLocked}
                              className="h-8 w-20 rounded-full border border-surface-4 bg-surface-3 px-3 text-xs text-text-primary transition-colors focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
                            />
                            <span className="text-[11px] text-text-muted">
                              {item.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-text-muted">
                        {variance == null || variance === 0
                          ? t("workspace.today.table.matchesSuggestion")
                          : variance > 0
                            ? t("workspace.today.table.aboveSuggestion", { quantity: signedQuantity(variance, item.unit) })
                            : t("workspace.today.table.belowSuggestion", { quantity: signedQuantity(variance, item.unit) })}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            acceptSuggestion(
                              item.id,
                              item.suggested_quantity,
                              item.unit,
                            )
                          }
                          disabled={isPlanLocked}
                          className="inline-flex h-8 items-center rounded-full border border-status-success/40 px-3 text-xs font-medium text-status-success transition-colors hover:bg-status-success/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success/30"
                        >
                          {t("workspace.today.table.useSuggestion")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            keepMyPlan(item.id, planned, item.unit)
                          }
                          disabled={isPlanLocked}
                          className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-3 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/20"
                        >
                          {t("workspace.today.table.keepMyNumber")}
                        </button>
                        <Link
                          href={`/workspace/today/item/${item.id}?branch=${safeBranchId}&date=${targetDate}&title=${encodeURIComponent(item.product_title)}&product_id=${item.product_id}&org=${user?.organization_id ?? ""}`}
                          className="inline-flex h-8 items-center rounded-full border border-brand-gold/45 px-3 text-xs font-medium text-brand-gold transition-colors hover:bg-brand-gold/10"
                        >
                          {t("workspace.today.table.deepDive")}
                        </Link>
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
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-semibold text-brand-gold">
                          {t("workspace.today.table.whyThisQuantity")}
                        </summary>
                        <div className="mt-2 space-y-2 text-[11px] text-text-secondary">
                          {/* Plain reasoning */}
                          <div className="space-y-0.5">
                            {item.forecast_context.reasoning.map((line) => (
                              <p key={`mobile-${item.id}-${line}`}>{line}</p>
                            ))}
                          </div>

                          {/* Signal breakdown — what influenced this forecast */}
                          {item.forecast_context.applied_signals ? (
                            <div className="pt-2 border-t border-surface-4/40">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-1.5">
                                {t("workspace.today.table.signalsTitle")}
                              </p>
                              <div className="space-y-1">
                                {Object.entries(item.forecast_context.applied_signals).map(([key, signal]: [string, any]) => {
                                  const modifier = signal?.modifier ?? 0;
                                  if (Math.abs(modifier) < 0.005) return null;
                                  const direction = modifier > 0 ? "↑" : "↓";
                                  const impact = `${direction} ${(Math.abs(modifier) * 100).toFixed(1)}%`;
                                  const tone = modifier > 0 ? "text-status-success" : "text-status-warning";
                                  const label = key === "reservation" ? t("workspace.today.deepDive.reservations") : key === "event" ? t("workspace.today.deepDive.event") : key === "weather" ? t("workspace.today.deepDive.weather") : key === "staffing" ? t("workspace.today.deepDive.staffing") : key === "kitchen_capacity" ? t("workspace.today.deepDive.kitchenCapacity") : key === "delivery_mix" ? t("workspace.today.deepDive.deliveryMix") : key === "traffic" ? t("workspace.today.deepDive.traffic") : key;
                                  return (
                                    <div key={key} className="flex items-center justify-between text-[11px]">
                                      <span className="text-text-secondary">{label}</span>
                                      <span className={`font-semibold ${tone}`}>{impact}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          {/* Financial impact */}
                          {impact ? (
                            <p className="pt-2 border-t border-surface-4/40">
                              {t("workspace.today.table.marginImpactEstimate", { amount: formatSignedCurrency(impact.margin_impact_estimate) })}
                            </p>
                          ) : null}
                          {hasPricing ? (
                            <div className="pt-2 border-t border-surface-4/40 space-y-0.5">
                              {financials.revenueIfSold != null ? (
                                <p>
                                  {t("workspace.today.table.ifSoldOut", {
                                    revenue: formatCurrency(financials.revenueIfSold),
                                    margin: financials.marginIfSold != null ? formatCurrency(financials.marginIfSold) : ""
                                  })}
                                </p>
                              ) : null}
                              {financials.wasteIfAll != null ? (
                                <p>
                                  {t("workspace.today.table.ifWasted", { cost: formatCurrency(financials.wasteIfAll) })}
                                </p>
                              ) : null}
                              {financials.lostMarginIfStockout != null &&
                              financials.shortfallQty > 0 ? (
                                <p>
                                  {t("workspace.today.table.stockoutWarning", {
                                    quantity: formatQuantity(financials.shortfallQty, financials.unit),
                                    margin: formatCurrency(financials.lostMarginIfStockout)
                                  })}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="pt-2 border-t border-surface-4/40">
                              {t("workspace.today.table.missingPricing")}
                            </p>
                          )}
                        </div>
                      </details>
                    </article>
                  );
                },
              )}
            </div>

            <div className="mt-5 hidden overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 lg:block">
              <table className="w-full min-w-[980px]">
                <thead className="border-b border-surface-4 bg-surface-3/35">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.today.table.item")}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.today.table.cookThisMuch")}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.today.table.expectedOrders")}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.today.table.howSure")}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.today.table.risk")}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.today.table.yourQuantity")}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.today.table.decision")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4/70">
                  {section2Rows.map(
                    ({ item, riskScore, planned, variance, impact }) => {
                      const plannedQty = planned ?? item.suggested_quantity;
                      const financials = buildFinancialSnapshot({
                        plannedQty,
                        predictedQty:
                          item.forecast_context.predicted_quantity_needed,
                        unit: item.unit,
                        unitPrice: item.forecast_context.unit_price,
                        unitCost: item.forecast_context.unit_cost,
                        unitMargin: item.forecast_context.unit_margin,
                      });
                      const hasPricing =
                        item.forecast_context.unit_price != null ||
                        item.forecast_context.unit_cost != null ||
                        item.forecast_context.unit_margin != null;
                      return (
                        <tr
                          key={`forecast-${item.id}`}
                          className="align-top hover:bg-surface-3/30"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {item.product_image_url && (
                                <img
                                  src={item.product_image_url}
                                  alt={item.product_title}
                                  className="h-10 w-10 rounded-lg object-cover border border-surface-4 shrink-0"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              )}
                              <div>
                                <p className="text-sm font-semibold text-text-primary">
                                  {item.product_title}
                                </p>
                                <p className="mt-1 text-xs text-text-muted">
                                  {popularityLabel(
                                    t,
                                    forecastRankById[item.id] ?? 999,
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-text-primary">
                            {formatQuantity(item.suggested_quantity, item.unit)}
                          </td>
                          <td className="px-4 py-4 text-sm text-text-secondary">
                            {Math.round(item.forecast_context.predicted_orders)}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold text-text-primary">
                              {percent(item.forecast_context.confidence_score)}
                            </p>
                            <p className="mt-1 text-xs text-text-muted">
                              {confidenceLabel(
                                item.forecast_context.confidence_score,
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${riskTone(riskScore)}`}
                            >
                              {riskLabel(t, riskScore)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                step={isDiscreteUnit(item.unit) ? 1 : 0.01}
                                value={plannedQtyByItem[item.id] ?? ""}
                                onChange={(event) =>
                                  onPlannedChange(
                                    item.id,
                                    event.target.value,
                                    item.unit,
                                  )
                                }
                                disabled={isPlanLocked}
                                className="h-8 w-28 rounded-full border border-surface-4 bg-surface-3 px-3 text-xs text-text-primary transition-colors focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
                              />
                              <span className="text-xs text-text-muted">
                                {item.unit}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-text-muted">
                              {variance == null || variance === 0
                                ? t("workspace.today.table.matchesSuggestion")
                                : variance > 0
                                  ? t("workspace.today.table.above", { quantity: signedQuantity(variance, item.unit) })
                                  : t("workspace.today.table.below", { quantity: signedQuantity(variance, item.unit) })}
                            </p>
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[11px] font-semibold text-brand-gold">
                                {t("workspace.today.table.whyThisQuantity")}
                              </summary>
                              <div className="mt-2 space-y-2 text-[11px] text-text-secondary">
                                {/* Plain reasoning */}
                                <div className="space-y-0.5">
                                  {item.forecast_context.reasoning.map((line) => (
                                    <p key={`${item.id}-${line}`}>{line}</p>
                                  ))}
                                </div>

                                {/* Signal breakdown — what influenced this forecast */}
                                {item.forecast_context.applied_signals ? (
                                  <div className="pt-2 border-t border-surface-4/40">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-1.5">
                                      {t("workspace.today.table.signalsTitle")}
                                    </p>
                                    <div className="space-y-1">
                                      {Object.entries(item.forecast_context.applied_signals).map(([key, signal]: [string, any]) => {
                                        const modifier = signal?.modifier ?? 0;
                                        if (Math.abs(modifier) < 0.005) return null;
                                        const direction = modifier > 0 ? "↑" : "↓";
                                        const impact = `${direction} ${(Math.abs(modifier) * 100).toFixed(1)}%`;
                                        const tone = modifier > 0 ? "text-status-success" : "text-status-warning";
                                        const label = key === "reservation" ? t("workspace.today.deepDive.reservations") : key === "event" ? t("workspace.today.deepDive.event") : key === "weather" ? t("workspace.today.deepDive.weather") : key === "staffing" ? t("workspace.today.deepDive.staffing") : key === "kitchen_capacity" ? t("workspace.today.deepDive.kitchenCapacity") : key === "delivery_mix" ? t("workspace.today.deepDive.deliveryMix") : key === "traffic" ? t("workspace.today.deepDive.traffic") : key;
                                        return (
                                          <div key={key} className="flex items-center justify-between text-[11px]">
                                            <span className="text-text-secondary">{label}</span>
                                            <span className={`font-semibold ${tone}`}>{impact}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}

                                {/* Financial impact */}
                                {impact ? (
                                  <p className="pt-2 border-t border-surface-4/40">
                                    {t("workspace.today.table.marginImpactEstimate", { amount: formatSignedCurrency(impact.margin_impact_estimate) })}
                                  </p>
                                ) : null}
                                {hasPricing ? (
                                  <div className="pt-2 border-t border-surface-4/40 space-y-0.5">
                                    {financials.revenueIfSold != null ? (
                                      <p>
                                        {t("workspace.today.table.ifSoldOut", {
                                          revenue: formatCurrency(financials.revenueIfSold),
                                          margin: financials.marginIfSold != null ? formatCurrency(financials.marginIfSold) : ""
                                        })}
                                      </p>
                                    ) : null}
                                    {financials.wasteIfAll != null ? (
                                      <p>
                                        {t("workspace.today.table.ifWasted", { cost: formatCurrency(financials.wasteIfAll) })}
                                      </p>
                                    ) : null}
                                    {financials.lostMarginIfStockout != null &&
                                    financials.shortfallQty > 0 ? (
                                      <p>
                                        {t("workspace.today.table.stockoutWarning", {
                                          quantity: formatQuantity(financials.shortfallQty, financials.unit),
                                          margin: formatCurrency(financials.lostMarginIfStockout)
                                        })}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="pt-2 border-t border-surface-4/40">
                                    {t("workspace.today.table.missingPricing")}
                                  </p>
                                )}
                              </div>
                            </details>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  acceptSuggestion(
                                    item.id,
                                    item.suggested_quantity,
                                    item.unit,
                                  )
                                }
                                disabled={isPlanLocked}
                                className="inline-flex h-7 items-center rounded-full border border-status-success/40 px-3 text-[11px] font-medium text-status-success transition-colors hover:bg-status-success/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success/30"
                              >
                                {t("workspace.today.table.useSuggestion")}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  keepMyPlan(item.id, planned, item.unit)
                                }
                                disabled={isPlanLocked}
                                className="inline-flex h-7 items-center rounded-full border border-surface-4 px-3 text-[11px] font-medium text-text-primary transition-colors hover:bg-surface-3 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/20"
                              >
                                {t("workspace.today.table.keepMine")}
                              </button>
                              <Link
                                href={`/workspace/today/item/${item.id}?branch=${safeBranchId}&date=${targetDate}&title=${encodeURIComponent(item.product_title)}&product_id=${item.product_id}&org=${user?.organization_id ?? ""}`}
                                className="inline-flex h-7 items-center rounded-full border border-brand-gold/45 px-3 text-[11px] font-medium text-brand-gold transition-colors hover:bg-brand-gold/10"
                              >
                                {t("workspace.today.table.deepDive")}
                              </Link>
                            </div>
                            {actionErrorByItem[item.id] ? (
                              <p className="mt-1 text-xs text-status-critical">
                                {actionErrorByItem[item.id]}
                              </p>
                            ) : backendDecisionFeedback(item) ? (
                              <p
                                className={`mt-1 text-xs ${
                                  backendDecisionFeedback(item)?.tone ===
                                  "success"
                                    ? "text-status-success"
                                    : backendDecisionFeedback(item)?.tone ===
                                        "warning"
                                      ? "text-status-warning"
                                      : "text-status-critical"
                                }`}
                              >
                                {backendDecisionFeedback(item)?.message}
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
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
              {t("workspace.today.context.moreContext")}
            </summary>

            <div className="mt-4 space-y-6">
              {/* Network intelligence */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
                  {t("workspace.today.context.networkTitle")}
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
                            {typeof learning.confidence === "number" ? ` ${t("workspace.today.context.reliability", { percent: percent(learning.confidence) })}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">{t("workspace.today.context.noNetworkData")}</p>
                )}
                {networkSuggestedAction ? (
                  <p className="mt-3 text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">{t("workspace.today.context.suggested")}</span>
                    {networkSuggestedAction}
                  </p>
                ) : null}
              </div>

              {/* Decision summary */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
                  {t("workspace.today.context.decisionsTitle")}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
                  <span>{t("workspace.today.context.reviewed", { count: decisionSummary.reviewed })}</span>
                  <span>{t("workspace.today.context.usedSuggestion", { count: decisionSummary.accepted })}</span>
                  <span>{t("workspace.today.context.yourOwnNumber", { count: decisionSummary.overridden })}</span>
                  <span>{t("workspace.today.context.wasteExposure", { percent: decisionSummary.projectedWaste.toFixed(1) })}</span>
                  <span>
                    {t("workspace.today.context.forecastImpact", { percent: `${decisionSummary.accuracyImpact >= 0 ? "+" : ""}${decisionSummary.accuracyImpact.toFixed(1)}` })}
                  </span>
                </div>
              </div>
            </div>
          </details>
        </>
      ) : null}

      {isLive && branchDay ? (
        <section className="mt-8">
          {/* Live header — title + secondary actions */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-status-success">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-status-success animate-pulse" />
                {t("workspace.today.status.live")}
              </p>
              <h3 className="mt-1 font-display text-2xl font-semibold text-text-primary">
                {t("workspace.today.live.monitor")}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setQuietMode((prev) => !prev)}
                className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary hover:border-brand-gold/50 hover:text-brand-gold"
              >
                {quietMode ? t("workspace.today.live.showAll") : t("workspace.today.live.criticalOnly")}
              </button>
              <button
                type="button"
                onClick={() => setCsvModalOpen(true)}
                className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary hover:border-brand-gold/50 hover:text-brand-gold"
              >
                {t("workspace.today.live.csvImport")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction("CLOSE_DAY")}
                disabled={updateBranchDayStatusMutation.isPending}
                className="inline-flex h-10 items-center justify-center rounded-full border border-surface-4 px-5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-status-critical/60 hover:text-status-critical active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateBranchDayStatusMutation.isPending ? t("workspace.today.live.closing") : t("workspace.today.live.closeDay")}
              </button>
            </div>
          </div>
          {showCsvImportBanner ? (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-status-success/35 bg-status-success/10 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-status-success">
                  {t("workspace.today.live.csvImportComplete")}
                </p>
                <p className="mt-1 text-sm text-text-primary">
                  {t("workspace.today.live.csvImportCompleteDesc")}
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
                {t("workspace.today.live.dismiss")}
              </button>
            </div>
          ) : null}
          <ModalShell
            open={csvModalOpen}
            onClose={() => {
              setCsvModalOpen(false);
              resetCsvUploadState();
            }}
            title={t("workspace.today.live.csvImportTitle")}
            description={t("workspace.today.live.csvImportDesc")}
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
                  {t("workspace.today.live.continueToMapping")}
                </button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("workspace.today.live.template")}
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  {t("workspace.today.live.templateDesc")}
                </p>
                <button
                  type="button"
                  onClick={handleCsvDownload}
                  className="mt-3 inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-semibold text-text-primary hover:bg-surface-3"
                >
                  {t("workspace.today.live.downloadTemplate")}
                </button>
              </div>

              <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("workspace.today.live.upload")}
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  {t("workspace.today.live.uploadDesc")}
                </p>
                <label className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-full border border-surface-4 bg-surface-2 px-4 py-2 text-sm text-text-secondary hover:border-brand-gold">
                  <span>
                    {csvUploadFile ? csvUploadFile.name : t("workspace.today.live.chooseCsv")}
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
                    {t("workspace.today.live.browse")}
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

          {liveSmartAlerts.length ? (
            <div className="mb-6 space-y-2">
              {liveSmartAlerts.map((alert) => (
                <article
                  key={alert.id}
                  className={`flex items-start justify-between gap-4 rounded-xl px-4 py-3 ${
                    alert.type === "SALES_SPIKE"
                      ? "border-brand-gold bg-brand-gold/8"
                      : "border-status-critical bg-status-critical/8"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${alert.type === "SALES_SPIKE" ? "text-brand-gold" : "text-status-critical"}`}>
                      {alert.product_title} · {alert.type === "SALES_SPIKE" ? t("workspace.today.live.demandSurge") : alert.type === "STOCKOUT_RISK" ? t("workspace.today.live.runningLow") : t("workspace.today.live.wasteRisk")}
                    </p>
                    <p className="mt-0.5 text-sm text-text-primary">{alert.message}</p>
                    {alert.type === "STOCKOUT_RISK" && typeof alert.details.runout_minutes === "number" ? (
                      <p className="mt-0.5 text-xs text-text-muted">
                        {t("workspace.today.live.runoutIn", { minutes: Math.round(Number(alert.details.runout_minutes)), prep: Number(alert.details.prep_time_minutes || 0).toFixed(0) })}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-text-secondary">{alert.suggested_action}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {alert.type === "STOCKOUT_RISK" ? (
                      <button
                        type="button"
                        onClick={() => handlePrepareMoreAlert(alert)}
                        className="inline-flex h-8 items-center rounded-full border border-status-success/40 bg-status-success/10 px-3 text-xs font-semibold text-status-success hover:bg-status-success/20"
                      >
                        {t("workspace.today.live.cookMore")}
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
                      className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted hover:bg-surface-3"
                    >
                      {t("workspace.today.live.dismiss")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-status-success/35 bg-status-success/10 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-status-success" />
              <p className="text-sm text-status-success">{t("workspace.today.live.allClear")}</p>
            </div>
          )}

          {/* ── Hero stats — large, scannable ── */}
          <div className="mb-8 grid grid-cols-3 gap-px bg-surface-4/40 rounded-xl overflow-hidden">
            <div className="bg-[#141416] px-6 py-6 text-center">
              <p className="font-display text-4xl font-semibold text-status-success">
                {Math.max(liveRows.length - stockoutWatchCount - overproductionWatchCount, 0)}
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-status-success/70">{t("workspace.today.live.onTrack")}</p>
            </div>
            <div className="bg-[#141416] px-6 py-6 text-center">
              <p className="font-display text-4xl font-semibold text-status-warning">
                {overproductionWatchCount}
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-status-warning/70">{t("workspace.today.live.keepEye")}</p>
            </div>
            <div className="bg-[#141416] px-6 py-6 text-center">
              <p className={`font-display text-4xl font-semibold ${stockoutWatchCount > 0 ? "text-status-critical" : "text-text-muted"}`}>
                {stockoutWatchCount}
              </p>
              <p className={`mt-2 text-xs font-medium uppercase tracking-[0.12em] ${stockoutWatchCount > 0 ? "text-status-critical/70" : "text-text-muted"}`}>{t("workspace.today.live.needsAction")}</p>
            </div>
          </div>

          <div className="space-y-3">
            {visibleLiveRows.map(
              ({ item, monitor, planned, additional, sold, remaining }) => {
                const stockoutRisk =
                  monitor?.risk_engine?.stockout_risk ?? "LOW";
                const wasteRisk = monitor?.risk_engine?.waste_risk ?? "LOW";
                const isRisk = stockoutRisk === "HIGH";
                const isWatch =
                  !isRisk &&
                  (stockoutRisk === "MEDIUM" ||
                    wasteRisk === "HIGH" ||
                    wasteRisk === "MEDIUM");
                const toneClass = isRisk
                  ? "border-status-critical/40 bg-status-critical/10 text-status-critical"
                  : isWatch
                    ? "border-status-warning/40 bg-status-warning/10 text-status-warning"
                    : "border-status-success/40 bg-status-success/10 text-status-success";
                const statusLabel = isRisk
                  ? t("workspace.today.live.needsAttention")
                  : isWatch
                    ? t("workspace.today.live.watch")
                    : t("workspace.today.live.onTrack");
                const runoutMin =
                  typeof monitor?.risk_engine?.runout_minutes === "number"
                    ? Math.round(monitor.risk_engine.runout_minutes)
                    : null;
                const prepTimeMin = Math.round(
                  monitor?.risk_engine?.prep_time_minutes ?? 0,
                );
                const startBatchNow = Boolean(
                  monitor?.risk_engine?.start_new_batch_now,
                );
                const suggestedAdditional = Math.max(
                  0,
                  Number(
                    monitor?.should_prepare_more_qty ??
                      monitor?.suggested_additional_qty ??
                      0,
                  ),
                );

                // Build micro-action sentence
                let microAction: string | null = null;
                if (isRisk && runoutMin !== null) {
                  microAction = startBatchNow
                    ? t("workspace.today.live.microActionStart", { runout: runoutMin, prep: prepTimeMin })
                    : t("workspace.today.live.microActionCook", { quantity: formatQuantity(Math.max(1, suggestedAdditional), item.unit), runout: runoutMin });
                } else if (isRisk) {
                  microAction = t("workspace.today.live.microActionOutpacing");
                } else if (isWatch && wasteRisk === "HIGH") {
                  microAction = t("workspace.today.live.microActionHold");
                } else if (isWatch && stockoutRisk === "MEDIUM") {
                  microAction = t("workspace.today.live.microActionWatch", { quantity: formatQuantity(Math.max(1, suggestedAdditional), item.unit) });
                }

                return (
                  <article
                    key={item.id}
                    className={`rounded-xl border px-5 py-5 ${isRisk ? "border-status-critical/40 bg-status-critical/5" : isWatch ? "border-status-warning/30 bg-surface-2" : "border-surface-4/60 bg-surface-2"}`}
                  >
                    {/* Urgency banner — only when critical */}
                    {isRisk ? (
                      <div className="mb-4 flex items-center gap-2 rounded-lg border border-status-critical/40 bg-status-critical/15 px-3 py-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-status-critical animate-pulse" />
                        <p className="text-sm font-semibold text-status-critical">
                          {runoutMin !== null
                            ? startBatchNow
                              ? t("workspace.today.live.startBatchNow", { runout: runoutMin, prep: prepTimeMin })
                              : t("workspace.today.live.mayRunOut", { minutes: runoutMin })
                            : t("workspace.today.live.demandOutpacing")}
                        </p>
                      </div>
                    ) : null}

                    <div className="flex items-start justify-between gap-4">
                      {/* Left: item name + secondary stats */}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-text-primary">{item.product_title}</p>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-muted">
                          <span>{t("workspace.today.closed.produced")}: {formatQuantity(planned + additional, item.unit)}</span>
                          <span>{t("workspace.today.closed.sold")}: {formatQuantity(sold, item.unit)}</span>
                          {runoutMin !== null && !isRisk ? (
                            <span>{t("workspace.today.live.mayRunOut", { minutes: runoutMin })}</span>
                          ) : null}
                        </div>
                      </div>

                      {/* Right: remaining quantity — the focal point */}
                      <div className="text-right shrink-0">
                        <p className={`font-display text-3xl font-semibold ${isRisk ? "text-status-critical" : isWatch ? "text-status-warning" : "text-text-primary"}`}>
                          {formatQuantity(remaining, item.unit)}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted">{t("workspace.today.live.remaining")}</p>
                        <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* Micro-action */}
                    {microAction ? (
                      <div className={`mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${isRisk ? "border-status-critical/30 bg-status-critical/10" : "border-status-warning/30 bg-status-warning/10"}`}>
                        <p className={`text-xs font-medium ${isRisk ? "text-status-critical" : "text-status-warning"}`}>
                          {microAction}
                        </p>
                        {isRisk && suggestedAdditional > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              logProduction(
                                item.id,
                                Math.max(1, isDiscreteUnit(item.unit) ? Math.round(suggestedAdditional) : suggestedAdditional),
                                "Demand spike",
                              )
                            }
                            className="shrink-0 inline-flex h-8 items-center rounded-full bg-status-success/15 border border-status-success/40 px-3 text-xs font-semibold text-status-success hover:bg-status-success/25 active:scale-[0.98]"
                          >
                            {t("workspace.today.live.prepareMore", { quantity: formatQuantity(Math.max(1, suggestedAdditional), item.unit) })}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              },
            )}
            {quietMode && !visibleLiveRows.length ? (
              <div className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4 text-sm text-text-muted">
                {t("workspace.today.live.quietModeActive")}
              </div>
            ) : null}
          </div>

          <details className="mt-4 rounded-xl border border-surface-4 bg-surface-2 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-text-primary">
              {t("workspace.today.live.fallbackActions")}
            </summary>
            <div className="mt-3 space-y-3">
              {liveRows.map(({ item }) => (
                <div
                  key={`fallback-${item.id}`}
                  className="flex flex-wrap items-center gap-2"
                >
                  <p className="min-w-[160px] text-xs font-medium text-text-primary">
                    {item.product_title}
                  </p>
                  <button
                    type="button"
                    onClick={() => logProduction(item.id, 1)}
                    className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-primary hover:bg-surface-3"
                  >
                    {t("workspace.today.live.addProduction")}
                  </button>
                  <button
                    type="button"
                    onClick={() => quickTapSale(item.id, item, 1)}
                    className="inline-flex h-8 items-center rounded-full border border-brand-gold/40 px-3 text-xs font-medium text-brand-gold hover:bg-brand-gold/10"
                  >
                    {t("workspace.today.live.sold1")}
                  </button>
                  <button
                    type="button"
                    onClick={() => quickTapSale(item.id, item, 5)}
                    className="inline-flex h-8 items-center rounded-full border border-brand-gold/40 px-3 text-xs font-medium text-brand-gold hover:bg-brand-gold/10"
                  >
                    {t("workspace.today.live.sold5")}
                  </button>
                </div>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      {isClosed && branchDay ? (
        <section className="mt-8">
          <div className="mb-8 border-b border-surface-4/60 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.closed.eyebrow")}</p>
            <h3 className="mt-1 font-display text-2xl font-semibold text-text-primary">
              {t("workspace.today.closed.title")}
            </h3>
          </div>

          {branchDay.review_phase ? (
            <div className="space-y-8">
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  {t("workspace.today.closed.dailyOutcome")}
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  {branchDay.review_phase.daily_outcome.title}
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.today.closed.forecastAccuracy")}
                    </p>
                    <p className="mt-2 font-display text-2xl text-status-success">
                      {branchDay.review_phase.daily_outcome.metrics.forecast_accuracy.value.toFixed(
                        1,
                      )}
                      %
                    </p>
                    {branchDay.review_phase.daily_outcome.metrics
                      .forecast_accuracy.comparison ? (
                      <p
                        className={`mt-2 text-xs ${comparisonTone(
                          branchDay.review_phase.daily_outcome.metrics
                            .forecast_accuracy.comparison.direction,
                          "up",
                        )}`}
                      >
                        {branchDay.review_phase.daily_outcome.metrics
                          .forecast_accuracy.comparison.direction === "up"
                          ? "↑"
                          : branchDay.review_phase.daily_outcome.metrics
                                .forecast_accuracy.comparison.direction ===
                              "down"
                            ? "↓"
                            : "→"}{" "}
                        {t("workspace.today.closed.vsLastWeekday", { delta: Math.abs(branchDay.review_phase.daily_outcome.metrics.forecast_accuracy.comparison.delta_pct).toFixed(1) })}
                      </p>
                    ) : null}
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.today.closed.wasteCost")}
                    </p>
                    <p className="mt-2 font-display text-2xl text-status-critical">
                      {formatCurrency(
                        branchDay.review_phase.daily_outcome.metrics.waste_cost
                          .value,
                      )}
                    </p>
                    {branchDay.review_phase.daily_outcome.metrics.waste_cost
                      .comparison ? (
                      <p
                        className={`mt-2 text-xs ${comparisonTone(
                          branchDay.review_phase.daily_outcome.metrics
                            .waste_cost.comparison.direction,
                          "down",
                        )}`}
                      >
                        {branchDay.review_phase.daily_outcome.metrics.waste_cost
                          .comparison.direction === "up"
                          ? "↑"
                          : branchDay.review_phase.daily_outcome.metrics
                                .waste_cost.comparison.direction === "down"
                            ? "↓"
                            : "→"}{" "}
                        {t("workspace.today.closed.vsLastWeekday", { delta: Math.abs(branchDay.review_phase.daily_outcome.metrics.waste_cost.comparison.delta_pct).toFixed(1) })}
                      </p>
                    ) : null}
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.today.closed.stockouts")}
                    </p>
                    <p className="mt-2 font-display text-2xl text-text-primary">
                      {t("workspace.today.closed.stockoutsCount", {
                        count: branchDay.review_phase.daily_outcome.metrics.stockouts.value
                      })}
                    </p>
                  </article>
                  <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.today.closed.revenueProtected")}
                    </p>
                    <p className="mt-2 font-display text-2xl text-status-success">
                      {formatCurrency(
                        branchDay.review_phase.daily_outcome.metrics
                          .revenue_protected.value,
                      )}
                    </p>
                  </article>
                </div>

                <div className="mt-5">
                  {/* Demand vs Production — compact grouped bars */}
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-text-primary">{t("workspace.today.closed.demandVsProduction")}</p>
                    <div className="flex items-center gap-3 text-[11px] text-text-muted">
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-brand-gold/60" />{t("workspace.today.closed.planned")}</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-status-warning/70" />{t("workspace.today.closed.produced")}</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-status-success/70" />{t("workspace.today.closed.sold")}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {branchDay.review_phase.daily_outcome.demand_vs_production
                      .slice(0, 6)
                      .map((row) => {
                        const maxValue = Math.max(row.planned_production, row.actual_production, row.actual_sales, 1);
                        const sellThrough = row.actual_production > 0 ? Math.round((row.actual_sales / row.actual_production) * 100) : 0;
                        const hasWaste = row.actual_production > row.actual_sales;
                        return (
                          <div key={row.item_id} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-medium text-text-primary">{row.item_title}</p>
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className={`font-semibold ${sellThrough >= 90 ? "text-status-success" : sellThrough >= 70 ? "text-status-warning" : "text-status-critical"}`}>
                                  {t("workspace.today.closed.soldPercent", { percent: sellThrough })}
                                </span>
                                {hasWaste ? (
                                  <span className="text-status-critical">
                                    {t("workspace.today.closed.wasteLabel", { quantity: formatQuantity(row.actual_production - row.actual_sales, row.unit) })}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {/* Stacked bar — all three on same track */}
                            <div className="relative h-5 rounded bg-surface-4 overflow-hidden">
                              {/* Planned */}
                              <div
                                className="absolute inset-y-0 left-0 rounded bg-brand-gold/25"
                                style={{ width: `${(row.planned_production / maxValue) * 100}%` }}
                              />
                              {/* Produced */}
                              <div
                                className="absolute inset-y-0 left-0 rounded bg-status-warning/50"
                                style={{ width: `${(row.actual_production / maxValue) * 100}%` }}
                              />
                              {/* Sold */}
                              <div
                                className="absolute inset-y-0 left-0 rounded bg-status-success/70"
                                style={{ width: `${(row.actual_sales / maxValue) * 100}%` }}
                              />
                              {/* Values overlay */}
                              <div className="absolute inset-0 flex items-center px-2 gap-3 text-[10px] font-medium text-white/80">
                                <span>{formatQuantity(row.planned_production, row.unit)}</span>
                                <span>→ {formatQuantity(row.actual_production, row.unit)}</span>
                                <span>→ {formatQuantity(row.actual_sales, row.unit)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.today.closed.wasteDistribution")}
                    </p>
                    <div className="mt-4 space-y-3">
                      {branchDay.review_phase.daily_outcome.waste_distribution
                        .length ? (
                        branchDay.review_phase.daily_outcome.waste_distribution
                          .slice(0, 6)
                          .map((row) => (
                            <div key={row.item_id}>
                              <div className="mb-1 flex justify-between text-xs text-text-muted">
                                <span>{row.item_title}</span>
                                <span>{row.share_pct.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 rounded bg-surface-4">
                                <div
                                  className="h-2 rounded bg-status-critical/75"
                                  style={{
                                    width: `${Math.max(2, row.share_pct)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-text-muted">
                          {t("workspace.today.closed.noWasteDistribution")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.today.closed.accuracyTrend")}
                    </p>
                    {branchDay.review_phase.daily_outcome
                      .forecast_accuracy_trend.length ? (
                      <div className="mt-4">
                        {(() => {
                          const trend =
                            branchDay.review_phase.daily_outcome
                              .forecast_accuracy_trend;
                          const width = 520;
                          const height = 180;
                          const maxAcc = Math.max(
                            ...trend.map((row) => row.accuracy),
                            100,
                          );
                          const minAcc = Math.min(
                            ...trend.map((row) => row.accuracy),
                            0,
                          );
                          const span = Math.max(1, maxAcc - minAcc);
                          const xStep =
                            trend.length > 1
                              ? width / (trend.length - 1)
                              : width;
                          const points = trend.map((row, index) => {
                            const x = index * xStep;
                            const y =
                              height -
                              ((row.accuracy - minAcc) / span) * (height - 20) -
                              10;
                            return `${x},${y}`;
                          });
                          return (
                            <>
                              <svg
                                viewBox={`0 0 ${width} ${height}`}
                                className="h-44 w-full"
                              >
                                <polyline
                                  points={points.join(" ")}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                  className="text-status-success"
                                />
                              </svg>
                              <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-text-muted">
                                {trend.map((row) => (
                                  <div key={row.date}>
                                    <p>{row.date.slice(5)}</p>
                                    <p className="font-semibold text-text-secondary">
                                      {row.accuracy.toFixed(1)}%
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-text-muted">
                        {t("workspace.today.closed.notEnoughHistory")}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("workspace.today.closed.keyInsights")}
                </p>
                <div className="mt-3 space-y-2">
                  {branchDay.review_phase.key_insights.insights.map(
                    (insight, index) => (
                      <p
                        key={`${index}-${insight}`}
                        className="text-sm text-text-secondary border-b border-surface-4/40 pb-2 last:border-0"
                      >
                        {index + 1}. {insight}
                      </p>
                    ),
                  )}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  {t("workspace.today.closed.itemPerformance")}
                </p>
                <div className="mt-3 overflow-x-auto border-y border-surface-4/70">
                  <table className="w-full min-w-[920px]">
                    <thead>
                      <tr className="border-b border-surface-4/70">
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                          {t("workspace.today.closed.itemHeader")}
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                          {t("workspace.today.closed.forecastHeader")}
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                          {t("workspace.today.closed.preparedHeader")}
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                          {t("workspace.today.closed.soldHeader")}
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                          {t("workspace.today.closed.wasteHeader")}
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                          {t("workspace.today.closed.stockoutHeader")}
                        </th>
                        <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                          {t("workspace.today.closed.impactHeader")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-4/55">
                      {branchDay.review_phase.item_performance.rows.map(
                        (row) => (
                          <tr key={row.item_id}>
                            <td className="px-3 py-3 text-sm font-medium text-text-primary">
                              {row.item_title}
                            </td>
                            <td className="px-3 py-3 text-sm text-text-secondary">
                              {formatQuantity(row.forecast, row.unit)}
                            </td>
                            <td className="px-3 py-3 text-sm text-text-secondary">
                              {formatQuantity(row.prepared, row.unit)}
                            </td>
                            <td className="px-3 py-3 text-sm text-text-secondary">
                              {formatQuantity(row.sold, row.unit)}
                            </td>
                            <td className="px-3 py-3 text-sm text-status-critical">
                              {formatQuantity(row.waste, row.unit)}
                            </td>
                            <td className="px-3 py-3 text-sm text-text-secondary">
                              {row.stockout ? t("workspace.today.closed.yes") : t("workspace.today.closed.no")}
                            </td>
                            <td
                              className={`px-3 py-3 text-sm ${row.impact >= 0 ? "text-status-success" : "text-status-critical"}`}
                            >
                              {formatSignedCurrency(row.impact)}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ── 4. Learning Signals — what today taught the system ── */}
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  {t("workspace.today.closed.learningSignals")}
                </p>

                {/* Block 1 — plain-English data counters */}
                <div className="mt-4 grid grid-cols-2 gap-0 sm:grid-cols-4 border-y border-surface-4/60">
                  {[
                    {
                      label: t("workspace.today.closed.dataPointsCollected"),
                      value: branchDay.review_phase.learning_signals.ml_learning_signals?.rows ?? 0,
                      sub: t("workspace.today.closed.itemsTrackedToday"),
                      color: "text-text-primary",
                    },
                    {
                      label: t("workspace.today.closed.yourOverrides"),
                      value: branchDay.review_phase.learning_signals.ml_learning_signals?.chef_override_rows ?? 0,
                      sub: t("workspace.today.closed.timesChangedPlan"),
                      color: "text-text-primary",
                    },
                    {
                      label: t("workspace.today.closed.wasteEvents"),
                      value: branchDay.review_phase.learning_signals.ml_learning_signals?.waste_rows ?? 0,
                      sub: t("workspace.today.closed.itemsWithLeftover"),
                      color: (branchDay.review_phase.learning_signals.ml_learning_signals?.waste_rows ?? 0) > 0 ? "text-status-critical" : "text-status-success",
                    },
                    {
                      label: t("workspace.today.closed.stockoutEvents"),
                      value: branchDay.review_phase.learning_signals.ml_learning_signals?.stockout_rows ?? 0,
                      sub: t("workspace.today.closed.itemsThatRan out"),
                      color: (branchDay.review_phase.learning_signals.ml_learning_signals?.stockout_rows ?? 0) > 0 ? "text-status-warning" : "text-status-success",
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="px-4 py-4 border-r border-surface-4/60 last:border-r-0">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{stat.label}</p>
                      <p className={`mt-1 font-display text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
                      <p className="mt-0.5 text-[11px] text-text-muted">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Block 2 — you vs the forecast */}
                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.closed.youVsForecast")}</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="border-b sm:border-b-0 sm:border-r border-surface-4/60 pb-3 sm:pb-0 sm:pr-4">
                      <p className="text-xs text-text-muted">{t("workspace.today.closed.howOftenAdjusted")}</p>
                      <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
                        {branchDay.review_phase.learning_signals.chef_behavior_learning.chef_adjustment_rate.toFixed(1)}%
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-muted">{t("workspace.today.closed.ofItemsChanged")}</p>
                    </div>
                    <div className="border-b sm:border-b-0 sm:border-r border-surface-4/60 pb-3 sm:pb-0 sm:pr-4">
                      <p className="text-xs text-text-muted">{t("workspace.today.closed.yourAccuracyLabel")}</p>
                      <p className={`mt-1 font-display text-2xl font-semibold ${branchDay.review_phase.learning_signals.chef_behavior_learning.chef_accuracy_score >= 75 ? "text-status-success" : branchDay.review_phase.learning_signals.chef_behavior_learning.chef_accuracy_score >= 55 ? "text-status-warning" : "text-status-critical"}`}>
                        {branchDay.review_phase.learning_signals.chef_behavior_learning.chef_accuracy_score.toFixed(1)}%
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-muted">{t("workspace.today.closed.closeToActual")}</p>
                    </div>
                    <div className="pb-3 sm:pb-0 sm:pl-0">
                      <p className="text-xs text-text-muted">{t("workspace.today.closed.whenYouBeatAi")}</p>
                      <p className="mt-1 font-display text-2xl font-semibold text-status-success">
                        {branchDay.review_phase.learning_signals.chef_behavior_learning.chef_adjustments_improved_outcome_rate.toFixed(1)}%
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-muted">{t("workspace.today.closed.ofOverridesImproved")}</p>
                    </div>
                  </div>

                  {/* Chef beats AI highlight */}
                  {(branchDay.review_phase.learning_signals.ml_learning_signals?.chef_outperformed_forecast_rows ?? 0) > 0 ? (
                    <p className="mt-3 text-sm text-status-success border-t border-surface-4/40 pt-3">
                      {t("workspace.today.closed.outperformedAi", {
                        count: branchDay.review_phase.learning_signals.ml_learning_signals?.chef_outperformed_forecast_rows,
                        item: (branchDay.review_phase.learning_signals.ml_learning_signals?.chef_outperformed_forecast_rows ?? 0) === 1 ? t("workspace.today.closed.item") : t("workspace.today.closed.items")
                      })}
                    </p>
                  ) : null}
                </div>

                {/* Block 3 — revenue lost to stockouts */}
                {branchDay.review_phase.learning_signals.revenue_loss_signals.length ? (
                  <div className="mt-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.closed.revenueLostStockouts")}</p>
                    <div className="mt-2 overflow-x-auto border-y border-surface-4/60">
                      <table className="w-full min-w-[560px]">
                        <thead>
                          <tr className="border-b border-surface-4/70">
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.closed.itemHeader")}</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.closed.ranOutAt")}</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.closed.paceHr")}</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.closed.estLostSales")}</th>
                            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.closed.estLostRevenue")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-4/55">
                          {branchDay.review_phase.learning_signals.revenue_loss_signals.map((row) => (
                            <tr key={`${row.item_id}-${row.stockout_time}`}>
                              <td className="px-3 py-2 text-sm text-text-primary">{row.item_title}</td>
                              <td className="px-3 py-2 text-sm text-text-secondary">
                                {new Date(row.stockout_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="px-3 py-2 text-sm text-text-secondary">{row.sales_velocity_per_hour.toFixed(1)}</td>
                              <td className="px-3 py-2 text-sm text-text-secondary">{row.estimated_lost_sales.toFixed(1)}</td>
                              <td className="px-3 py-2 text-sm font-semibold text-status-critical">{formatCurrency(row.estimated_lost_revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {/* Block 4 — raw training data, collapsed */}
                <details className="mt-4 group">
                  <summary className="cursor-pointer flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-text-secondary transition-colors">
                    <span className="group-open:hidden">▶</span>
                    <span className="hidden group-open:inline">▼</span>
                    {t("workspace.today.closed.rawTrainingData")}
                  </summary>
                  <div className="mt-3 overflow-x-auto border-t border-surface-4/60 pt-3">
                    <table className="w-full min-w-[1080px]">
                      <thead>
                        <tr className="border-b border-surface-4/70">
                          {[
                            t("workspace.today.closed.itemHeader"),
                            t("workspace.today.closed.forecastHeader"),
                            "Chef Plan",
                            "Additional",
                            "Actual Sales",
                            t("workspace.today.closed.wasteHeader"),
                            t("workspace.today.closed.stockoutHeader"),
                            "Forecast Error",
                            "Chef Adjustment",
                            "Outcome"
                          ].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{h}</th>
                          ))}
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
                            <td className="px-3 py-2 text-sm text-text-secondary">{row.stockouts ? t("workspace.today.closed.yes") : t("workspace.today.closed.no")}</td>
                            <td className="px-3 py-2 text-sm text-text-secondary">{formatQuantity(row.forecast_error, row.unit)}</td>
                            <td className="px-3 py-2 text-sm text-text-secondary">{signedQuantity(row.chef_adjustment, row.unit)}</td>
                            <td className={`px-3 py-2 text-sm ${row.service_outcome === "IMPROVED_BY_CHEF" ? "text-status-success" : "text-status-warning"}`}>
                              {row.service_outcome === "IMPROVED_BY_CHEF" ? t("workspace.today.closed.chefBetter") : t("workspace.today.closed.forecastBetter")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </section>

              {/* ── 5. What tomorrow looks like ── */}
              <section className="border-t border-surface-4/60 pt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  {t("workspace.today.closed.tomorrowLooksLike")}
                </p>

                {/* Tomorrow focus actions */}
                {branchDay.review_phase.learning_signals.tomorrow_actions.length ? (
                  <ul className="mt-4 space-y-2">
                    {branchDay.review_phase.learning_signals.tomorrow_actions.map((action) => (
                      <li key={action} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" />
                        {action}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {/* Tomorrow early signal */}
                <div className="mt-4 rounded-xl border border-brand-gold/30 bg-brand-gold/8 px-5 py-4">
                  <p className="text-sm font-semibold text-text-primary">
                    {branchDay.review_phase.tomorrow_early_signal.message}
                  </p>
                  <p className="mt-1.5 text-xs text-text-muted">
                    {branchDay.review_phase.tomorrow_early_signal.target_date}
                    {branchDay.review_phase.tomorrow_early_signal.weekday
                      ? ` · ${branchDay.review_phase.tomorrow_early_signal.weekday}`
                      : ""}
                    {" · "}
                    {t("workspace.today.closed.demandChange", {
                      percent: `${branchDay.review_phase.tomorrow_early_signal.expected_demand_change_pct >= 0 ? "+" : ""}${branchDay.review_phase.tomorrow_early_signal.expected_demand_change_pct.toFixed(1)}`
                    })}
                  </p>
                </div>
              </section>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/20 mb-3">
                <div className="h-5 w-5 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-text-muted">{t("workspace.today.closed.reviewSummaryPreparing")}</p>
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
            {t("workspace.today.empty.statusIs", { status: branchDay.status })}
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
            {t("workspace.today.empty.noActiveItems")}
          </p>
        </div>
      ) : null}

      <ConfirmActionModal
        open={confirmAction === "START_LIVE"}
        title={t("workspace.today.modals.startLiveTitle")}
        description={t("workspace.today.modals.startLiveDesc")}
        confirmLabel={t("workspace.today.modals.startLiveButton")}
        isConfirming={updateBranchDayStatusMutation.isPending}
        onClose={() => setConfirmAction(null)}
        onConfirm={startLiveService}
      />

      <ConfirmActionModal
        open={confirmAction === "CLOSE_DAY"}
        title={t("workspace.today.modals.closeDayTitle")}
        description={t("workspace.today.modals.closeDayDesc")}
        confirmLabel={t("workspace.today.modals.closeDayButton")}
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

export default function TodayWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <TodayWorkspacePageContent />
    </Suspense>
  );
}
