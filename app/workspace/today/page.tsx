"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { Shop, Calendar } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { UUID_PATTERN } from "@/lib/constants";
import { resolvePermissions } from "@/lib/permissions";
import { useAccessGate } from "@/lib/hooks/use-access-gate";
import { PERMISSIONS } from "@/services/organizations/types";
import { isDiscreteUnit, todayIso } from "@/lib/format";
import { BranchCurrencyProvider } from "@/lib/branch-currency";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { OperationalCalendar } from "@/components/ui/operational-calendar";
import { ConfirmActionModal } from "@/components/dashboard/today/confirm-action-modal";
import { LogWasteModal } from "@/components/dashboard/today/log-waste-modal";
import { RecordProductionModal } from "@/components/dashboard/today/record-production-modal";
import { IngredientRequirements } from "@/components/dashboard/today/ingredient-requirements";
import { TasksStrip } from "@/components/dashboard/today/tasks-strip";
import {
  useBranchDayToday,
  useBranchDayLiveVersion,
  useMorningBrief,
  useBranchPaceSummary,
  useIntradayTimeline,
  useCreateProductionLog,
  useEvaluatePrepPlan,
  useInitializeBranchDay,
  useLockBranchDayPlan,
  useUpdateBranchDayStatus,
  useUpdatePrepPlanItem,
  productionIntelligenceQueryKeys,
} from "@/services/production-intelligence/hooks";
import { useGenerateTasks } from "@/services";
import { useTaskBoardRealtime } from "@/services/execution/use-task-board-realtime";
import { useMenuItemRealtime } from "@/services/inventory/use-menu-item-realtime";
import { useBranchStore } from "@/services/context/branch-store";
import { useBranchOptions } from "@/services/context/use-branch-options";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { MarkUnavailableModal } from "@/components/dashboard/today/mark-unavailable-modal";
import { inventoryQueryKeys } from "@/services/inventory/hooks";
import { AssistantLauncher } from "@/components/assistant/assistant-launcher";
import { TodaysBriefDrawer } from "@/components/dashboard/today/todays-brief-drawer";
import { TodaysBriefTrigger } from "@/components/dashboard/today/todays-brief-trigger";
import { useMorningBriefVoice } from "@/services/assistant/hooks";
import { InitializationWalkthrough } from "@/components/dashboard/today/initialization-walkthrough";
import { MorningBriefStrip } from "@/components/dashboard/today/morning-brief-strip";
import {
  PlanProvenanceDrawer,
  derivePipelineProvenance,
} from "@/components/dashboard/today/plan-provenance-drawer";
import { DayPhaseStepper } from "@/components/dashboard/today/day-phase-stepper";
import {
  RefreshingBar,
  TodaySkeleton,
} from "@/components/dashboard/today/today-skeleton";
import { DemandSignalsBanner } from "@/components/dashboard/today/demand-signals-banner";
import { MyTasksCard } from "@/components/dashboard/today/my-tasks-card";
import { IntelligenceJourneyBanner } from "@/components/dashboard/today/intelligence-journey-banner";
import { MorningOutlook } from "@/components/dashboard/today/morning-outlook";
import { MorningRiskAlerts } from "@/components/dashboard/today/morning-risk-alerts";
import { InventoryRiskBanner } from "@/components/dashboard/today/inventory-risk-banner";
import { PrepPlanSection } from "@/components/dashboard/today/prep-plan-section";
import { LiveMonitorSection } from "@/components/dashboard/today/live-monitor-section";
import { ClosedDayReview } from "@/components/dashboard/today/closed-day-review";
import {
  buildMorningRiskAlerts,
  computePlanRiskScore,
  deriveDecisionSummary,
  deriveLiveRows,
  netSuggestedQty,
  splitByPreparation,
  tierLiveRows,
  type ImpactPreview,
  type MorningRiskAlert,
} from "@/components/dashboard/today/today-helpers";
import type { PendingAction } from "@/services/assistant/types";
import type { UpdatePrepPlanItemPayload } from "@/services/production-intelligence/types";
import { intelligenceJourneySummarySchema } from "@/services/production-intelligence/types";

function TodayWorkspacePageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // ── Context: user, branches, date ─────────────────────────────────────────
  const { user, branchOptions, defaultBranch, isLoading, isError } = useBranchOptions();
  const canAccess = Boolean(user?.has_organization);

  // Mirror of the backend gate on branch-day mutations (status, lock, plan
  // edits, production logs): either code passes. Users with neither get the
  // page as a live status board — actions are hidden, data stays visible.
  const permissions = useMemo(() => resolvePermissions(user), [user]);
  const canOperateToday =
    permissions.has(PERMISSIONS.VIEW_INVENTORY) ||
    permissions.has(PERMISSIONS.OVERRIDE_PREP_PLANS);

  const [targetDate, setTargetDate] = useState(todayIso());
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

  useAccessGate({ canAccess, isPending: isLoading, isError });

  const safeBranchId = UUID_PATTERN.test(branchId) ? branchId : "";
  const {
    tier: subscriptionTier,
    isLoading: subLoading,
    shouldBlockAccess,
    gateVariant,
    canManageBilling,
    billingContacts,
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
  const updatePrepPlanMutation = useUpdatePrepPlanItem();
  const generateTasksMutation = useGenerateTasks();

  // ── AI task suggestions: persistent, clickable notice ─────────────────────
  // Shown when PrepIQ drafts tasks for this day — either from this manager's
  // "start service", or out-of-band (Celery after a plan lock, another admin).
  const showAiTasksToast = useCallback(() => {
    if (!safeBranchId) return;
    toast(
      (activeToast) => (
        <button
          type="button"
          className="text-left"
          onClick={() => {
            toast.dismiss(activeToast.id);
            router.push(`/workspace/tasks?branch=${safeBranchId}&highlight=ai`);
          }}
        >
          <span className="block text-sm font-semibold">
            {t("today.aiTasksToast.title")}
          </span>
          <span className="mt-0.5 block text-xs opacity-75">
            {t("today.aiTasksToast.subtitle")}
          </span>
        </button>
      ),
      { id: "ai-tasks-suggested", icon: "✨", duration: Infinity },
    );
  }, [router, safeBranchId, t]);

  useTaskBoardRealtime(safeBranchId || undefined, targetDate, showAiTasksToast);
  // A recipe image/ingredients edited on the Inventory page, via the AI
  // assistant, or via the recipe-review panel reaches this open Today tab
  // immediately — the item's photo/name on today's cards can otherwise go
  // stale for the rest of the shift.
  useMenuItemRealtime(safeBranchId || undefined, () => {
    queryClient.invalidateQueries({
      queryKey: [...productionIntelligenceQueryKeys.root, "branch-day-today", safeBranchId],
    });
  });

  const branchDay = todayQuery.data;
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
  const [recordItem, setRecordItem] = useState<null | {
    id: string;
    title: string;
    unit: string;
  }>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const briefVoice = useMorningBriefVoice();
  const [explainRequest, setExplainRequest] = useState<{
    topic: string;
    nonce: number;
  } | null>(null);
  const [assistantOpenRequest, setAssistantOpenRequest] = useState<{
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
  // Per-dish intraday curves for the live timeline (same 3-minute cadence).
  const timelineQuery = useIntradayTimeline(
    { branch_id: safeBranchId, date: targetDate },
    canFetchData && branchDay?.status === "LIVE",
  );
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

  // Open the drawer first, then fetch: the surface owns the preparing state,
  // and a cold brief takes several seconds to synthesize. Opening on success
  // would leave the button looking inert for the whole wait. Reading never
  // triggers synthesis — only the gold trigger and the drawer's Listen button
  // ask for the spoken brief.
  const openBriefAudio = () => {
    if (!safeBranchId || briefVoice.isPending) return;
    setBriefOpen(true);
    briefVoice.mutate({ branch_id: safeBranchId, date: targetDate });
  };

  const openBriefForReading = () => {
    if (!safeBranchId) return;
    setBriefOpen(true);
  };

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
  // "Your Plan" pre-fills with the AI's suggested (net-of-carry-over)
  // quantity so the chef reviews a number rather than a blank box — the
  // field itself marks it as unconfirmed (see PlannedInput's isSuggested
  // styling) until they either edit it or press Accept/Keep to record a
  // decision. A previously saved plan always wins over the suggestion.
  useEffect(() => {
    if (!branchDay) return;
    const initialPlans: Record<string, number | ""> = {};
    for (const item of branchDay.prep_plan_items) {
      const savedPlan = item.planned_quantity;
      const seed = savedPlan ?? netSuggestedQty(item);
      initialPlans[item.id] =
        seed == null
          ? ""
          : isDiscreteUnit(item.unit)
            ? Math.round(seed)
            : seed;
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
      // Compared against the net (carry-over-adjusted) suggestion — the same
      // number the input pre-fills with and Accept commits — so an untouched
      // or just-accepted row never shows a spurious "below suggestion" line.
      const variance = planned == null ? null : planned - netSuggestedQty(item);
      const impact = impactByItem[item.id];
      // Risk responds to the entered quantity: covering the suggestion lowers
      // it, deviating raises the relevant side (see computePlanRiskScore).
      const riskScore = computePlanRiskScore(item, planned, impact);
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

  // Bottled drinks and packaged goods need a stock level, not a production
  // decision, so they get their own section rather than competing for the top
  // of the prep list — which they always won, being the highest sellers by
  // order count in most kitchens.
  const { prepRows, stockRows } = useMemo(
    () => splitByPreparation(forecastRowsByDemand),
    [forecastRowsByDemand],
  );

  // Ranked within the prep list only, so "#1 most popular" answers "of the
  // things you have to cook" rather than being permanently claimed by a Coke.
  const forecastRankById = useMemo(() => {
    const rankMap: Record<string, number> = {};
    prepRows.forEach((row, index) => {
      rankMap[row.item.id] = index + 1;
    });
    stockRows.forEach((row, index) => {
      rankMap[row.item.id] = index + 1;
    });
    return rankMap;
  }, [prepRows, stockRows]);

  // Scoped to the prep list: "12 of 14 reviewed" must count the decisions the
  // lock button actually gates on, not bottled drinks that need no decision.
  const decisionSummary = useMemo(
    () => deriveDecisionSummary(prepRows),
    [prepRows],
  );
  const morningRiskAlerts = useMemo(
    () => buildMorningRiskAlerts(t, rows, branchDay?.currency || "USD"),
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

  const setOverrideReason = (prepPlanItemId: string, reason: string) => {
    const planned = plannedQtyByItem[prepPlanItemId];
    if (planned === "" || planned == null) return;
    updatePrepPlanMutation.mutate(
      {
        prepPlanItemId,
        payload: {
          planned_quantity: Number(planned),
          accepted_suggestion: false,
          override_reason:
            reason as UpdatePrepPlanItemPayload["override_reason"],
        },
      },
      {
        onSuccess: () => clearActionError(prepPlanItemId),
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
    if (!branchDay?.id || !isPlanLocked || !canOperateToday) return;
    setConfirmAction(null);
    updateBranchDayStatusMutation.mutate(
      { branchDayId: branchDay.id, payload: { status: "LIVE" } },
      {
        onSuccess: () => {
          // Service is starting: have PrepIQ (re)draft task suggestions from
          // the locked plan, then point the manager at the review tray. The
          // WebSocket broadcast raises the same toast for other admins.
          if (!safeBranchId) return;
          generateTasksMutation.mutate(
            { branchId: safeBranchId, date: targetDate },
            {
              onSuccess: (data) => {
                if (data.tasks.length > 0) showAiTasksToast();
              },
            },
          );
        },
      },
    );
  };

  const lockPlan = () => {
    if (!branchDay?.id || isPlanLocked || !canOperateToday) return;
    lockPlanMutation.mutate({ branchDayId: branchDay.id, payload: {} });
  };

  const closeServiceDay = () => {
    if (!branchDay?.id || !canOperateToday) return;
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

  // Slow safety refetch behind the version cursor: catches anything the
  // version signal misses (e.g. Redis down) without hammering the API.
  useEffect(() => {
    if (!isLive || !branchDay?.id) return;
    if (createProductionLogMutation.isPending) {
      return;
    }
    const interval = window.setInterval(() => {
      todayQuery.refetch();
    }, 120_000);
    return () => window.clearInterval(interval);
  }, [isLive, branchDay?.id, todayQuery, createProductionLogMutation.isPending]);

  // ── Status line ───────────────────────────────────────────────────────────
  const loading = isLoading || todayQuery.isLoading || initializeMutation.isPending;
  const noBranchContext = !loading && !branchOptions.length;

  // Remember the phase across a branch/date switch so the skeleton can be
  // shaped like the view that's arriving rather than defaulting to the
  // morning plan — switching branches mid-service used to blank the page.
  const lastPhaseRef = useRef<"MORNING" | "LIVE" | "CLOSED" | "UNKNOWN">(
    "UNKNOWN",
  );
  if (branchDay?.status && branchDay.status !== lastPhaseRef.current) {
    if (
      branchDay.status === "MORNING" ||
      branchDay.status === "LIVE" ||
      branchDay.status === "CLOSED"
    ) {
      lastPhaseRef.current = branchDay.status;
    }
  }
  // A refetch with data already on screen keeps the content and shows a
  // liveness cue; only a cold load replaces the view with a skeleton.
  const showSkeleton = loading && !branchDay && !walkthroughActive;
  const isBackgroundRefreshing =
    Boolean(branchDay) && todayQuery.isFetching && !todayQuery.isLoading;
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

  /**
   * The journey summary rides along on the 404 body, so a kitchen that has
   * never initialized a day still sees where it stands — that is the screen a
   * customer looks at on the day they sign up. Parsed leniently because the
   * error envelope nests differently depending on which layer produced it.
   */
  const preInitJourney = useMemo(() => {
    if (!todayQuery.isError) return null;
    const err = todayQuery.error as { details?: unknown } | null;
    const details = err && typeof err === "object" ? (err.details as any) : null;
    const raw =
      details?.intelligence_journey ??
      details?.error?.details?.intelligence_journey ??
      null;
    if (!raw) return null;
    const parsed = intelligenceJourneySummarySchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
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
    <BranchCurrencyProvider currency={branchDay?.currency}>
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
            {safeBranchId && canUseAssistant ? (
              <TodaysBriefTrigger
                label={t("today.briefAudio.trigger")}
                hint={t("today.briefAudio.triggerHint")}
                loading={briefVoice.isPending}
                onClick={openBriefAudio}
              />
            ) : null}
            {!canOperateToday && !loading ? (
              <span
                className="inline-flex h-7 items-center rounded-full border border-surface-4 bg-surface-3/60 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted"
                title={t("today.viewOnly.hint")}
              >
                {t("today.viewOnly.badge")}
              </span>
            ) : null}
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
          <SubscriptionRequiredState
            variant={gateVariant}
            canManageBilling={canManageBilling}
            billingContacts={billingContacts}
            branchId={safeBranchId}
            compact
          />
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

            {/* Day zero: no plan yet, but the journey can still answer "what do
                you actually know about us?" — which is the question a new
                customer is really asking. */}
            {!walkthroughActive && !branchDay && preInitJourney ? (
              <IntelligenceJourneyBanner summary={preInitJourney} />
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

            <RefreshingBar active={isBackgroundRefreshing} />

            {showSkeleton ? <TodaySkeleton phase={lastPhaseRef.current} /> : null}

            {/* ── Work assigned to this person today. Renders nothing if none. ── */}
            {!walkthroughActive && branchDay ? (
              <MyTasksCard date={branchDay.date} />
            ) : null}

            {/* ── Persistent Demand Signals banner — all three phases ── */}
            {!walkthroughActive && branchDay ? (
              <DemandSignalsBanner branchDay={branchDay} />
            ) : null}

            {/* ── MORNING: review and lock the prep plan ── */}
            {!walkthroughActive && isMorning && branchDay ? (
              <>
                <MorningBriefStrip
                  loading={morningBriefQuery.isLoading}
                  brief={morningBrief}
                  userName={user?.first_name || "Chef"}
                  onOpenBrief={() => setBriefOpen(true)}
                />

                <MorningOutlook
                  branchDay={branchDay}
                  rows={rows}
                  rowsByDemand={forecastRowsByDemand}
                  onExplainReliability={
                    canUseAssistant
                      ? () =>
                          setExplainRequest({
                            topic: "what the plan reliability score means for today and whether my inventory buffer is safe",
                            nonce: Date.now(),
                          })
                      : undefined
                  }
                />

                <InventoryRiskBanner
                  requirement={branchDay?.ingredient_requirement}
                />

                <MorningRiskAlerts
                  alerts={morningRiskAlerts}
                  isPlanLocked={isPlanLocked || !canOperateToday}
                  canUseAssistant={canUseAssistant}
                  onExplain={(topic) =>
                    setExplainRequest({ topic, nonce: Date.now() })
                  }
                  onApplyFix={applyRiskAlertFix}
                />

                <PrepPlanSection
                  branchDay={branchDay}
                  rows={prepRows}
                  stockRows={stockRows}
                  totalRowCount={prepRows.length}
                  forecastRankById={forecastRankById}
                  decisionSummary={decisionSummary}
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
                  onOverrideReason={setOverrideReason}
                  actionErrorByItem={actionErrorByItem}
                  expandedItemIds={expandedItemIds}
                  onToggleExpand={toggleItemExpand}
                  onMarkUnavailable={setMarkUnavailableItem}
                  branchId={safeBranchId}
                  targetDate={targetDate}
                  orgId={user?.organization_id ?? ""}
                  readOnly={!canOperateToday}
                />

                {/* Single ingredient view: store-room requirement + BOM prep
                    sheet merged, styled per the Ingredient requirements layout. */}
                <section id="ingredient-requirements" className="mt-8 mb-4 scroll-mt-6">
                  <IngredientRequirements
                    branchId={safeBranchId}
                    targetDate={targetDate}
                    orgId={user?.organization_id ?? ""}
                    requirement={branchDay?.ingredient_requirement}
                    prepSheet={morningBrief?.prep_sheet}
                    isPlanLocked={isPlanLocked}
                  />
                </section>

                <TasksStrip
                  branchId={safeBranchId}
                  targetDate={targetDate}
                  enabled={canFetchData && isPlanLocked}
                />
              </>
            ) : null}

            {/* ── LIVE: tiered stock monitor ── */}
            {!walkthroughActive && isLive && branchDay ? (
              <>
              <TasksStrip
                branchId={safeBranchId}
                targetDate={targetDate}
                enabled={canFetchData}
              />
              {/* LiveMonitorSection renders this same system_health note
                  itself, right above the grid it's actually about — a
                  second copy up here just duplicated it. */}
              <LiveMonitorSection
                branchDay={branchDay}
                criticalRows={criticalRows}
                watchRows={watchRows}
                okRows={okRows}
                paceSummary={paceSummary}
                paceAlertByProductId={paceAlertByProductId}
                timeline={timelineQuery.data}
                showCsvImportBanner={showCsvImportBanner}
                onDismissCsvBanner={dismissCsvBanner}
                closePending={updateBranchDayStatusMutation.isPending}
                onCloseDay={() => setConfirmAction("CLOSE_DAY")}
                onRecordProduction={setRecordItem}
                onLogWaste={setWasteItem}
                branchId={safeBranchId}
                targetDate={targetDate}
                orgId={user?.organization_id ?? ""}
                readOnly={!canOperateToday}
              />
              </>
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

            {/* ── How much PrepIQ actually knows about this kitchen yet ──
                Last on the page by design: everything above is what that
                knowledge produced today (plan, signals, live status), so
                the "how sure should you be" framing reads better as a
                closing note than as the first thing a chef sees. */}
            {!walkthroughActive && branchDay?.intelligence_journey ? (
              <IntelligenceJourneyBanner
                summary={branchDay.intelligence_journey}
              />
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

            <RecordProductionModal
              open={Boolean(recordItem)}
              itemTitle={recordItem?.title ?? ""}
              unit={recordItem?.unit ?? ""}
              isSubmitting={createProductionLogMutation.isPending}
              onClose={() => setRecordItem(null)}
              onSubmit={(quantityProduced) => {
                if (!recordItem) return;
                logProduction(
                  recordItem.id,
                  quantityProduced,
                  t("today.reason.recordedManually"),
                );
                setRecordItem(null);
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

        <TodaysBriefDrawer
          open={briefOpen}
          onClose={() => setBriefOpen(false)}
          onOpen={() => setBriefOpen(true)}
          voiceLoading={briefVoice.isPending}
          brief={briefVoice.data ?? null}
          voiceError={briefVoice.isError ? t("today.briefAudio.error") : null}
          onListen={openBriefAudio}
          readBrief={morningBrief}
          canAsk={canUseAssistant}
          branchId={safeBranchId}
          date={targetDate}
          onOpenAssistant={() =>
            setAssistantOpenRequest({ nonce: Date.now() })
          }
          onOpenProvenance={() => setProvenanceOpen(true)}
        />

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
            openRequest={assistantOpenRequest}
            autoOpen={autoOpenAssistant}
          />
        ) : null}
      </WorkspaceShell>
    </BranchCurrencyProvider>
  );
}

export default function TodayWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <TodayWorkspacePageContent />
    </Suspense>
  );
}
