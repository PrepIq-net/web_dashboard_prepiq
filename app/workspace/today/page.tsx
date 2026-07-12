"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Shop, Calendar } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { UUID_PATTERN } from "@/lib/constants";
import { isDiscreteUnit } from "@/lib/format";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { OperationalCalendar } from "@/components/ui/operational-calendar";
import { ConfirmActionModal } from "@/components/dashboard/today/confirm-action-modal";
import { LogWasteModal } from "@/components/dashboard/today/log-waste-modal";
import { IngredientRequirements } from "@/components/dashboard/today/ingredient-requirements";
import {
  useBranchDayToday,
  useBranchDayLiveVersion,
  useMorningBrief,
  useBranchPaceSummary,
  useCreateProductionLog,
  useEvaluatePrepPlan,
  useInitializeBranchDay,
  useLockBranchDayPlan,
  useSalesManualQuickEntry,
  useUpdateBranchDayStatus,
  useUpdatePrepPlanItem,
  productionIntelligenceQueryKeys,
} from "@/services/production-intelligence/hooks";
import { useBranchStore } from "@/services/context/branch-store";
import { useBranchOptions } from "@/services/context/use-branch-options";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { MarkUnavailableModal } from "@/components/dashboard/today/mark-unavailable-modal";
import { inventoryQueryKeys } from "@/services/inventory/hooks";
import { AssistantLauncher } from "@/components/assistant/assistant-launcher";
import { InitializationWalkthrough } from "@/components/dashboard/today/initialization-walkthrough";
import { MorningBriefPanel } from "@/components/dashboard/today/morning-brief-panel";
import {
  PlanProvenanceDrawer,
  derivePipelineProvenance,
} from "@/components/dashboard/today/plan-provenance-drawer";
import { PrepSheetSection } from "@/components/dashboard/today/prep-sheet-section";
import { DayPhaseStepper } from "@/components/dashboard/today/day-phase-stepper";
import { MorningOutlook } from "@/components/dashboard/today/morning-outlook";
import { MorningRiskAlerts } from "@/components/dashboard/today/morning-risk-alerts";
import { PrepPlanSection } from "@/components/dashboard/today/prep-plan-section";
import { MorningContextFooter } from "@/components/dashboard/today/morning-context-footer";
import { LiveMonitorSection } from "@/components/dashboard/today/live-monitor-section";
import { ClosedDayReview } from "@/components/dashboard/today/closed-day-review";
import {
  buildMorningRiskAlerts,
  deriveDecisionSummary,
  deriveLiveRows,
  tierLiveRows,
  type ImpactPreview,
  type MorningRiskAlert,
} from "@/components/dashboard/today/today-helpers";
import type { PendingAction } from "@/services/assistant/types";

function TodayWorkspacePageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // ── Context: user, branches, date ─────────────────────────────────────────
  const { user, branchOptions, defaultBranch, isLoading } = useBranchOptions();
  const canAccess = Boolean(user?.has_organization);

  const [targetDate, setTargetDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  // Branch selection lives in the shared store so it persists across
  // navigation and reloads. URL params seed it once per param change so a
  // manual branch switch afterwards isn't overridden.
  const branchId = useBranchStore((s) => s.branchId);
  const setBranchId = useBranchStore((s) => s.setBranchId);

  const [showCsvImportBanner, setShowCsvImportBanner] = useState(false);
  const [autoOpenAssistant, setAutoOpenAssistant] = useState(false);

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
    setAutoOpenAssistant(searchParams.get("assistant") === "open");
  }, [searchParams, setBranchId]);

  // Resolve the shared selection against THIS user's branches: keep it if it's
  // still a valid option, otherwise fall back to the page default. This also
  // corrects a branch persisted from a different org after switching.
  useEffect(() => {
    if (!defaultBranch?.id) return; // branch options not loaded yet
    if (branchId && branchOptions.some((b) => b.id === branchId)) return;
    setBranchId(defaultBranch.id);
  }, [branchId, branchOptions, defaultBranch?.id, setBranchId]);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, canAccess]);

  const safeBranchId = UUID_PATTERN.test(branchId) ? branchId : "";
  const {
    tier: subscriptionTier,
    isLoading: subLoading,
    shouldBlockAccess,
    gateVariant,
  } = useSubscriptionTier(safeBranchId || undefined);
  // Any active subscription (Core and up) includes the assistant.
  const canUseAssistant =
    !subLoading && !shouldBlockAccess && subscriptionTier >= 1;
  const canFetchData = Boolean(safeBranchId) && !subLoading && !shouldBlockAccess;

  // ── Queries & mutations ───────────────────────────────────────────────────
  const todayQuery = useBranchDayToday(
    { branch_id: safeBranchId, date: targetDate },
    canFetchData,
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
  const updatePrepPlanMutation = useUpdatePrepPlanItem();

  const branchDay = initializeMutation.data ?? todayQuery.data;
  const pipelineStats = initializeMutation.data?.meta?.pipeline_stats ?? null;

  const isMorning = branchDay?.status === "MORNING";
  const isLive = branchDay?.status === "LIVE";
  const isClosed = branchDay?.status === "CLOSED";
  const isPlanLocked = Boolean(branchDay?.plan_lock?.is_locked);

  // ── Editing state ─────────────────────────────────────────────────────────
  const [plannedQtyByItem, setPlannedQtyByItem] = useState<
    Record<string, number | "">
  >({});
  const [impactByItem, setImpactByItem] = useState<Record<string, ImpactPreview>>(
    {},
  );
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
  const [explainRequest, setExplainRequest] = useState<{
    topic: string;
    nonce: number;
  } | null>(null);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [markUnavailableItem, setMarkUnavailableItem] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const toggleItemExpand = (id: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const evaluateDebounce = useRef<Record<string, number>>({});
  const initializeAttemptedByKey = useRef<Record<string, boolean>>({});

  // The initialization walkthrough replaces the spinner while the pipeline
  // runs, and holds briefly for a truthful recap once it resolves.
  const [walkthroughDismissed, setWalkthroughDismissed] = useState(true);
  useEffect(() => {
    if (initializeMutation.isPending) setWalkthroughDismissed(false);
  }, [initializeMutation.isPending]);
  const walkthroughActive =
    !walkthroughDismissed &&
    (initializeMutation.isPending ||
      initializeMutation.isSuccess ||
      initializeMutation.isError);

  // Morning brief + plan provenance ("How this plan was made").
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const morningBriefQuery = useMorningBrief(
    { branch_id: safeBranchId, date: targetDate },
    canFetchData && branchDay?.status === "MORNING",
  );
  const morningBrief = morningBriefQuery.data ?? null;
  const provenanceStats = useMemo(
    () => pipelineStats ?? derivePipelineProvenance(branchDay?.prep_plan_items),
    [pipelineStats, branchDay?.prep_plan_items],
  );

  // Live "pace vs plan": batch cumulative-position summary, refreshed on its
  // own 3-minute interval (decoupled from the branch-day poll).
  const paceQuery = useBranchPaceSummary(
    { branch_id: safeBranchId, date: targetDate },
    canFetchData && branchDay?.status === "LIVE",
  );
  // Version-cursor realtime: a 5s poll of a tiny Redis-backed counter; the
  // heavy branch-day/pace queries refetch only when the counter moves
  // (connector sales, co-worker quick-taps, production logs).
  useBranchDayLiveVersion(
    safeBranchId,
    canFetchData && branchDay?.status === "LIVE",
  );
  const paceSummary = paceQuery.data ?? null;
  const paceAlertByProductId = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<typeof paceSummary>["items"][number]
    >();
    for (const paceItem of paceSummary?.items ?? []) {
      if (paceItem.should_alert && paceItem.cumulative_position) {
        map.set(paceItem.item_id, paceItem);
      }
    }
    return map;
  }, [paceSummary]);

  // Assistant actions are executed server-side on confirm — just refresh the
  // data the action may have changed.
  const handleAssistantActionApplied = (_action: PendingAction) => {
    todayQuery.refetch();
    morningBriefQuery.refetch();
    paceQuery.refetch();
  };

  useEffect(() => {
    if (showCsvImportBanner) {
      todayQuery.refetch();
    }
  }, [showCsvImportBanner, todayQuery]);

  // ── Day auto-initialization ───────────────────────────────────────────────
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
      err?.status === 404 || Boolean(errDetails?.error?.details?.can_initialize);
    if (!canInitialize || !safeBranchId || !initKey || initializeMutation.isPending)
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

  // Seed the editable quantities whenever a new branch day arrives.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchDay?.id]);

  // ── Derived rows ──────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    if (!branchDay) return [];
    const preparedRows = branchDay.prep_plan_items.map((item) => {
      const planned =
        plannedQtyByItem[item.id] === ""
          ? null
          : Number(plannedQtyByItem[item.id]);
      const variance = planned == null ? null : planned - item.suggested_quantity;
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
    const topDemand = forecastRowsByDemand.slice(0, 5).map((row) => row.item.id);
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

  const decisionSummary = useMemo(() => deriveDecisionSummary(rows), [rows]);
  const morningRiskAlerts = useMemo(
    () => buildMorningRiskAlerts(t, rows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows],
  );

  const liveRows = useMemo(
    () => deriveLiveRows(branchDay?.prep_plan_items),
    [branchDay?.prep_plan_items],
  );
  const { criticalRows, watchRows, okRows } = useMemo(
    () => tierLiveRows(liveRows),
    [liveRows],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const evaluateImpact = (prepPlanItemId: string, plannedQuantity: number) => {
    evaluateMutation.mutate(
      { prep_plan_item_id: prepPlanItemId, planned_quantity: plannedQuantity },
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

  const clearActionError = (prepPlanItemId: string) => {
    setActionErrorByItem((prev) => {
      if (!prev[prepPlanItemId]) return prev;
      const next = { ...prev };
      delete next[prepPlanItemId];
      return next;
    });
  };

  const onPlannedChange = (
    prepPlanItemId: string,
    value: string,
    unit: string,
  ) => {
    const parsed =
      value === "" ? "" : normalizePlannedQuantity(Number(value), unit);
    setPlannedQtyByItem((prev) => ({ ...prev, [prepPlanItemId]: parsed }));
    clearActionError(prepPlanItemId);

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
          setPlannedQtyByItem((prev) => ({
            ...prev,
            [prepPlanItemId]: normalizedQuantity,
          }));
          clearActionError(prepPlanItemId);
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
          clearActionError(prepPlanItemId);
        },
        onError: () =>
          setActionErrorByItem((prev) => ({
            ...prev,
            [prepPlanItemId]: t("today.error.keepPlan"),
          })),
      },
    );
  };

  const applyRiskAlertFix = (alert: MorningRiskAlert) => {
    onPlannedChange(alert.id, String(alert.suggestedFixQty), alert.unit);
    acceptSuggestion(alert.id, alert.suggestedFixQty, alert.unit);
  };

  const startLiveService = () => {
    if (!branchDay?.id || !isPlanLocked) return;
    setConfirmAction(null);
    updateBranchDayStatusMutation.mutate(
      { branchDayId: branchDay.id, payload: { status: "LIVE" } },
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
      { branchDayId: branchDay.id, payload: { status: "CLOSED" } },
      {},
    );
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
        live?.planned_qty ?? row.planned_quantity ?? row.suggested_quantity ?? 0;
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
          ? { ...live.risk_engine, remaining_stock: remaining }
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
      { onSuccess: () => setWasteItem(null) },
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
                  liveMap[row.id] ? { ...row, live_monitor: liveMap[row.id] } : row,
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

  // Slow safety refetch behind the version cursor: catches anything the
  // version signal misses (e.g. Redis down) without hammering the API.
  useEffect(() => {
    if (!isLive || !branchDay?.id) return;
    if (createProductionLogMutation.isPending || salesQuickEntryMutation.isPending) {
      return;
    }
    const interval = window.setInterval(() => {
      todayQuery.refetch();
    }, 120_000);
    return () => window.clearInterval(interval);
  }, [
    isLive,
    branchDay?.id,
    todayQuery,
    createProductionLogMutation.isPending,
    salesQuickEntryMutation.isPending,
  ]);

  // ── Status line ───────────────────────────────────────────────────────────
  const loading = isLoading || todayQuery.isLoading || initializeMutation.isPending;
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
    if (typeof err.message === "string" && err.message.length) return err.message;
    const details = (err as any)?.details;
    if (typeof details?.message === "string") return details.message;
    if (typeof details?.detail === "string") return details.detail;
    if (typeof details?.error === "string") return details.error;
    return t("today.error.loadDayData");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayQuery.isError, todayQuery.error]);

  const canInitializeDay = useMemo(() => {
    if (!todayQuery.isError) return false;
    const err = todayQuery.error as { status?: number; details?: unknown } | null;
    const details = err && typeof err === "object" ? (err.details as any) : null;
    return err?.status === 404 || Boolean(details?.error?.details?.can_initialize);
  }, [todayQuery.isError, todayQuery.error]);

  const dismissCsvBanner = () => {
    setShowCsvImportBanner(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("csv_import");
    const next = params.toString();
    router.replace(next ? `/workspace/today?${next}` : "/workspace/today");
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
              noBranchContext
                ? t("today.branch.noBranches")
                : t("today.branch.selectBranch")
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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pb-1">
          {branchDay && !loading ? (
            <DayPhaseStepper status={branchDay.status as "MORNING" | "LIVE" | "CLOSED"} />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  loading
                    ? "bg-text-muted animate-pulse"
                    : noBranchContext
                      ? "bg-status-critical"
                      : "bg-status-warning"
                }`}
              />
              <p className="text-sm text-text-muted">{statusLabel}</p>
            </div>
          )}
        </div>
      </div>

      {safeBranchId && !subLoading && shouldBlockAccess ? (
        <SubscriptionRequiredState variant={gateVariant} compact />
      ) : (
        <>
          {walkthroughActive ? (
            <InitializationWalkthrough
              isPending={initializeMutation.isPending}
              isError={initializeMutation.isError}
              errorMessage={todayQueryErrorMessage}
              stats={pipelineStats}
              onRetry={
                safeBranchId
                  ? () =>
                      initializeMutation.mutate({
                        branch_id: safeBranchId,
                        date: targetDate,
                      })
                  : undefined
              }
              onDone={() => setWalkthroughDismissed(true)}
            />
          ) : todayQuery.isError && !initializeMutation.isSuccess ? (
            <div className="mb-6 rounded-r-lg border-l-4 border-l-status-warning bg-status-warning/8 px-4 py-3 text-xs text-status-warning">
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

          {/* ── MORNING: review and lock the prep plan ── */}
          {!walkthroughActive && isMorning && branchDay ? (
            <>
              {morningBrief ? (
                <MorningBriefPanel
                  brief={morningBrief}
                  onOpenProvenance={() => setProvenanceOpen(true)}
                />
              ) : null}

              <MorningOutlook
                branchDay={branchDay}
                rows={rows}
                rowsByDemand={forecastRowsByDemand}
                hideSignals={Boolean(morningBrief)}
              />

              <MorningRiskAlerts
                alerts={morningRiskAlerts}
                isPlanLocked={isPlanLocked}
                canUseAssistant={canUseAssistant}
                onExplain={(topic) =>
                  setExplainRequest({ topic, nonce: Date.now() })
                }
                onApplyFix={applyRiskAlertFix}
              />

              <PrepPlanSection
                branchDay={branchDay}
                rows={section2Rows}
                totalRowCount={forecastRowsByDemand.length}
                forecastRankById={forecastRankById}
                decisionSummary={decisionSummary}
                importantItemsOnly={importantItemsOnly}
                onToggleImportantOnly={() => setImportantItemsOnly((p) => !p)}
                isPlanLocked={isPlanLocked}
                isMorning={isMorning}
                lockPending={lockPlanMutation.isPending}
                startPending={updateBranchDayStatusMutation.isPending}
                onLockPlan={lockPlan}
                onStartService={() => setConfirmAction("START_LIVE")}
                plannedQtyByItem={plannedQtyByItem}
                onPlannedChange={onPlannedChange}
                onAcceptSuggestion={acceptSuggestion}
                onKeepMyPlan={keepMyPlan}
                actionErrorByItem={actionErrorByItem}
                expandedItemIds={expandedItemIds}
                onToggleExpand={toggleItemExpand}
                onMarkUnavailable={setMarkUnavailableItem}
                branchId={safeBranchId}
                targetDate={targetDate}
                orgId={user?.organization_id ?? ""}
              />

              {morningBrief?.prep_sheet?.length ? (
                <PrepSheetSection prepSheet={morningBrief.prep_sheet} />
              ) : null}

              <section className="mt-8 mb-4">
                <IngredientRequirements
                  branchId={safeBranchId}
                  targetDate={targetDate}
                  orgId={user?.organization_id ?? ""}
                />
              </section>

              <MorningContextFooter
                branchDay={branchDay}
                decisionSummary={decisionSummary}
              />
            </>
          ) : null}

          {/* ── LIVE: tiered stock monitor ── */}
          {!walkthroughActive && isLive && branchDay ? (
            <LiveMonitorSection
              branchDay={branchDay}
              criticalRows={criticalRows}
              watchRows={watchRows}
              okRows={okRows}
              paceSummary={paceSummary}
              paceAlertByProductId={paceAlertByProductId}
              showCsvImportBanner={showCsvImportBanner}
              onDismissCsvBanner={dismissCsvBanner}
              closePending={updateBranchDayStatusMutation.isPending}
              onCloseDay={() => setConfirmAction("CLOSE_DAY")}
              onLogProduction={logProduction}
              onQuickSale={quickTapSale}
              onLogWaste={setWasteItem}
              branchId={safeBranchId}
              targetDate={targetDate}
            />
          ) : null}

          {/* ── CLOSED: day review ── */}
          {!walkthroughActive && isClosed && branchDay ? (
            <ClosedDayReview
              branchDay={branchDay}
              branchId={safeBranchId}
              provenanceStats={provenanceStats}
            />
          ) : null}

          {branchDay &&
          branchDay.status !== "MORNING" &&
          branchDay.status !== "LIVE" &&
          branchDay.status !== "CLOSED" ? (
            <div className="mt-8 py-12 text-center">
              <Calendar className="mx-auto h-8 w-8 text-text-muted mb-3" />
              <p className="text-sm text-text-secondary">
                {t("today.statusIs")}{" "}
                <span className="font-semibold text-text-primary">
                  {branchDay.status}
                </span>
                .
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
                queryKey: productionIntelligenceQueryKeys.branchDayToday({
                  branch_id: safeBranchId,
                  date: targetDate,
                }),
              });
              queryClient.invalidateQueries({
                queryKey: inventoryQueryKeys.availabilityOverrides(safeBranchId),
              });
            }}
          />
        </>
      )}

      <PlanProvenanceDrawer
        open={provenanceOpen}
        onClose={() => setProvenanceOpen(false)}
        stats={provenanceStats}
        activeSignals={morningBrief?.drivers?.active_signals ?? []}
        learnedPatterns={morningBrief?.drivers?.learned_patterns ?? []}
        canAskAssistant={canUseAssistant}
        onAskAssistant={() =>
          setExplainRequest({
            topic: "how today's prep plan was made",
            nonce: Date.now(),
          })
        }
      />

      {safeBranchId && canUseAssistant ? (
        <AssistantLauncher
          branchId={safeBranchId}
          date={targetDate}
          onActionApplied={handleAssistantActionApplied}
          explainRequest={explainRequest}
          autoOpen={autoOpenAssistant}
        />
      ) : null}
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
