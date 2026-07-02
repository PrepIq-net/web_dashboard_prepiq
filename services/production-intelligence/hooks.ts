"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProductionLog,
  createSalesManualQuickEntry,
  getBranchDayToday,
  getBranchPaceSummary,
  getMorningBrief,
  getBranchCommandView,
  initializeBranchDay,
  ignoreBranchDayLiveAlert,
  lockBranchDayPlan,
  createPrepRecommendationDecision,
  evaluatePrepPlan,
  getExecutiveControlTower,
  getOwnerMarginProtectionReport,
  getOwnerNetworkIntelligenceInsights,
  createStaffStockoutEvent,
  getOwnerDailyPerformance,
  getProductionIntelligenceAccessScope,
  getSetupForecastWOW,
  getSalesDataValidation,
  importPOSCSV,
  getStaffShiftChecklist,
  getStaffStockoutEvents,
  previewPOSCSVImport,
  getTodayPrepRecommendations,
  getStaffPersonalDashboard,
  getStaffAccountability,
  getIntegrationsOverview,
  getOperationsProductionSnapshot,
  getRiskSnapshot,
  getOperationsHistorySnapshot,
  getSalesWasteReport,
  retryIntegrationsSync,
  startSquareOAuth,
  startToastOAuth,
  startLoyverseOAuth,
  startCloverOAuth,
  getAdvancedForecast,
  getForecastScenarios,
  getForecastConfidence,
  getForecastMetrics,
  getChefSkillScore,
  getDataQualityReport,
  updateRealTimeVelocity,
  updateBranchDayStatus,
  updatePrepPlanItem,
  updateBranchDayNotes,
  updateStaffShiftChecklist,
  type AccessScopeQuery,
  type BranchDayTodayQuery,
  type BranchCommandViewQuery,
  type ExecutiveControlTowerQuery,
  type OwnerMarginProtectionReportQuery,
  type OwnerNetworkIntelligenceInsightsQuery,
  type OwnerDailyPerformanceQuery,
  type SalesDataValidationQuery,
  type SetupForecastWOWQuery,
  type POSCSVImportPayload,
  type POSCSVPreviewPayload,
  type StaffShiftChecklistQuery,
  type StaffStockoutEventsQuery,
  type TodayPrepRecommendationsQuery,
  type StaffPersonalDashboardQuery,
  type StaffAccountabilityQuery,
  type IntegrationsOverviewQuery,
  type OperationsProductionQuery,
  type RiskSnapshotQuery,
  type OperationsHistoryQuery,
  type SalesWasteReportQuery,
  type ItemHistoryQuery,
  getItemHistory,
  type AdvancedForecastPayload,
  type ForecastScenariosQuery,
  type ForecastConfidenceQuery,
  type ForecastMetricsQuery,
  type ChefSkillScoreQuery,
  type DataQualityReportQuery,
  type VelocityUpdatePayload,
} from "@/services/production-intelligence/service";
import type {
  BranchDayInitializePayload,
  BranchDayPlanLockPayload,
  BranchDayLiveAlertIgnorePayload,
  BranchDayStatusUpdatePayload,
  CreateProductionLogPayload,
  CreatePrepRecommendationDecisionPayload,
  CreateStaffStockoutEventPayload,
  PrepPlanEvaluatePayload,
  SquareOAuthStartPayload,
  ToastOAuthStartPayload,
  LoyverseOAuthStartPayload,
  CloverOAuthStartPayload,
  SalesManualQuickEntryPayload,
  UpdatePrepPlanItemPayload,
  UpdateStaffShiftChecklistPayload,
  IntegrationsSyncRetryQuery,
} from "@/services/production-intelligence/types";

export const productionIntelligenceQueryKeys = {
  root: ["production-intelligence"] as const,
  accessScope: (organizationId?: string) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "access-scope",
      organizationId ?? "",
    ] as const,
  todayRecommendations: (params?: TodayPrepRecommendationsQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "today-recommendations",
      params?.branch_id ?? "",
      params?.target_date ?? "",
      params?.include_history ?? false,
    ] as const,
  branchDayToday: (params?: BranchDayTodayQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "branch-day-today",
      params?.branch_id ?? "",
      params?.date ?? "",
    ] as const,
  morningBrief: (params?: { branch_id?: string; date?: string }) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "morning-brief",
      params?.branch_id ?? "",
      params?.date ?? "",
    ] as const,
  branchPaceSummary: (params?: { branch_id?: string; date?: string }) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "branch-pace-summary",
      params?.branch_id ?? "",
      params?.date ?? "",
    ] as const,
  branchCommandView: (params: BranchCommandViewQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "branch-command-view",
      params.branch_id,
      params.target_date ?? "",
    ] as const,
  ownerDailyPerformance: (params: OwnerDailyPerformanceQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "owner-daily-performance",
      params.branch_id,
      params.target_date ?? "",
    ] as const,
  executiveControlTower: (params?: ExecutiveControlTowerQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "executive-control-tower",
      params?.branch_id ?? "",
      params?.target_date ?? "",
    ] as const,
  ownerMarginProtectionReport: (params?: OwnerMarginProtectionReportQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "owner-margin-protection-report",
      params?.branch_id ?? "",
      params?.target_date ?? "",
    ] as const,
  ownerNetworkIntelligenceInsights: (
    params?: OwnerNetworkIntelligenceInsightsQuery,
  ) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "owner-network-intelligence-insights",
      params?.organization_id ?? "",
      params?.target_date ?? "",
      params?.lookback_days ?? 30,
    ] as const,
  salesDataValidation: (params: SalesDataValidationQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "sales-data-validation",
      params.branch_id,
      params.target_date ?? "",
    ] as const,
  setupForecastWOW: (params?: SetupForecastWOWQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "setup-forecast-wow",
      params?.branch_id ?? "",
      params?.target_date ?? "",
      params?.horizon_weeks ?? 3,
    ] as const,
  staffShiftChecklist: (params: StaffShiftChecklistQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "staff-shift-checklist",
      params.branch_id,
      params.target_date ?? "",
    ] as const,
  staffStockoutEvents: (params: StaffStockoutEventsQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "staff-stockout-events",
      params.branch_id,
      params.target_date ?? "",
    ] as const,
  staffPersonalDashboard: (params: StaffPersonalDashboardQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "staff-personal-dashboard",
      params.staff_user_id ?? "",
      params.branch_id ?? "",
      params.target_date ?? "",
    ] as const,
  staffAccountability: (params: StaffAccountabilityQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "staff-accountability",
      params.branch_id,
      params.target_date ?? "",
    ] as const,
  integrationsOverview: (params: IntegrationsOverviewQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "integrations-overview",
      params.organization_id,
    ] as const,
  integrationsSyncRetry: (params: IntegrationsSyncRetryQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "integrations-sync-retry",
      params.branch_id,
      params.connection_id,
      params.provider_code,
    ] as const,
  operationsProduction: (params: OperationsProductionQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "operations-production",
      params.branch_id ?? "",
      params.target_date ?? "",
    ] as const,
  operationsRisk: (params: RiskSnapshotQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "operations-risk",
      params.branch_id ?? "",
      params.target_date ?? "",
    ] as const,
  operationsHistory: (params: OperationsHistoryQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "operations-history",
      params.branch_id ?? "",
      params.target_date ?? "",
      params.window_days ?? "",
    ] as const,
  itemHistory: (itemId: string, params: ItemHistoryQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "item-history",
      itemId,
      params.branch_id ?? "",
      params.days ?? "",
    ] as const,
  salesWasteReport: (params: SalesWasteReportQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "sales-waste-report",
      params.branch_id ?? "",
      params.period ?? "",
      params.target_date ?? "",
      params.item_id ?? "",
    ] as const,
  advancedForecast: (params?: AdvancedForecastPayload) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "advanced-forecast",
      params?.branch_id ?? "",
      params?.item_id ?? "",
      params?.target_date ?? "",
    ] as const,
  forecastScenarios: (params?: ForecastScenariosQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "forecast-scenarios",
      params?.branch_id ?? "",
      params?.item_id ?? "",
      params?.target_date ?? "",
    ] as const,
  forecastConfidence: (params?: ForecastConfidenceQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "forecast-confidence",
      params?.branch_id ?? "",
      params?.item_id ?? "",
      params?.target_date ?? "",
    ] as const,
  forecastMetrics: (params?: ForecastMetricsQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "forecast-metrics",
      params?.branch_id ?? "",
      params?.item_id ?? "",
      params?.lookback_days ?? "",
    ] as const,
  chefSkillScore: (params?: ChefSkillScoreQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "chef-skill-score",
      params?.user_id ?? "",
      params?.branch_id ?? "",
      params?.days_window ?? "",
    ] as const,
  dataQualityReport: (params?: DataQualityReportQuery) =>
    [
      ...productionIntelligenceQueryKeys.root,
      "data-quality-report",
      params?.branch_id ?? "",
      params?.days_window ?? "",
    ] as const,
};

export function useProductionIntelligenceAccessScope(
  params?: AccessScopeQuery,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.accessScope(
      params?.organization_id,
    ),
    queryFn: () => getProductionIntelligenceAccessScope(params),
  });
}

export function useTodayPrepRecommendations(
  params?: TodayPrepRecommendationsQuery,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.todayRecommendations(params),
    queryFn: () => getTodayPrepRecommendations(params),
  });
}

export function useBranchDayToday(
  params?: BranchDayTodayQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.branchDayToday(params),
    queryFn: () => getBranchDayToday(params),
    enabled: enabled && Boolean(params?.branch_id),
  });
}

export function useMorningBrief(
  params?: { branch_id?: string; date?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.morningBrief(params),
    queryFn: () => getMorningBrief(params ?? {}),
    enabled: enabled && Boolean(params?.branch_id),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useBranchPaceSummary(
  params?: { branch_id?: string; date?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.branchPaceSummary(params),
    queryFn: () =>
      getBranchPaceSummary({
        branch_id: params?.branch_id ?? "",
        date: params?.date,
      }),
    enabled: enabled && Boolean(params?.branch_id),
    refetchInterval: 180_000,
    retry: false,
  });
}

export function useInitializeBranchDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BranchDayInitializePayload) =>
      initializeBranchDay(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.branchDayToday({
          branch_id: data.branch_id,
          date: data.date,
        }),
      });
    },
  });
}

export function useEvaluatePrepPlan() {
  return useMutation({
    mutationFn: (payload: PrepPlanEvaluatePayload) => evaluatePrepPlan(payload),
  });
}

export function useUpdateBranchDayStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      branchDayId,
      payload,
    }: {
      branchDayId: string;
      payload: BranchDayStatusUpdatePayload;
    }) => updateBranchDayStatus(branchDayId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.branchDayToday({
          branch_id: data.branch_id,
          date: data.date,
        }),
      });
    },
  });
}

export function useUpdateBranchDayNotes() {
  return useMutation({
    mutationFn: ({
      branchDayId,
      ...payload
    }: { branchDayId: string; notes?: string; reaction?: string }) =>
      updateBranchDayNotes(branchDayId, payload),
  });
}

export function useLockBranchDayPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      branchDayId,
      payload,
    }: {
      branchDayId: string;
      payload?: BranchDayPlanLockPayload;
    }) => lockBranchDayPlan(branchDayId, payload ?? {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.branchDayToday({
          branch_id: data.branch_id,
          date: data.date,
        }),
      });
    },
  });
}

export function useIgnoreBranchDayLiveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      branchDayId,
      payload,
    }: {
      branchDayId: string;
      payload: BranchDayLiveAlertIgnorePayload;
    }) => ignoreBranchDayLiveAlert(branchDayId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...productionIntelligenceQueryKeys.root, "branch-day-today"],
      });
    },
  });
}

export function useUpdatePrepPlanItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      prepPlanItemId,
      payload,
    }: {
      prepPlanItemId: string;
      payload: UpdatePrepPlanItemPayload;
    }) => updatePrepPlanItem(prepPlanItemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...productionIntelligenceQueryKeys.root, "branch-day-today"],
      });
    },
  });
}

export function useCreateProductionLog(options?: { skipInvalidate?: boolean }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProductionLogPayload) =>
      createProductionLog(payload),
    onSuccess: () => {
      if (options?.skipInvalidate) return;
      queryClient.invalidateQueries({
        queryKey: [...productionIntelligenceQueryKeys.root, "branch-day-today"],
      });
    },
  });
}

export function useSalesManualQuickEntry(options?: {
  skipInvalidate?: boolean;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SalesManualQuickEntryPayload) =>
      createSalesManualQuickEntry(payload),
    onSuccess: (_data, variables) => {
      if (options?.skipInvalidate) return;
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.branchDayToday({
          branch_id: variables.branch_id,
          date: variables.target_date ?? "",
        }),
      });
    },
  });
}

export function useBranchCommandView(
  params: BranchCommandViewQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.branchCommandView(params),
    queryFn: () => getBranchCommandView(params),
    enabled: enabled && Boolean(params.branch_id),
  });
}

export function useCreatePrepRecommendationDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recommendationId,
      payload,
    }: {
      recommendationId: string;
      payload: CreatePrepRecommendationDecisionPayload;
    }) => createPrepRecommendationDecision(recommendationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.todayRecommendations(),
      });
      queryClient.invalidateQueries({
        queryKey: [
          ...productionIntelligenceQueryKeys.root,
          "owner-daily-performance",
        ],
      });
    },
  });
}

export function useOwnerDailyPerformance(params: OwnerDailyPerformanceQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.ownerDailyPerformance(params),
    queryFn: () => getOwnerDailyPerformance(params),
    enabled: Boolean(params.branch_id),
  });
}

export function useExecutiveControlTower(
  params?: ExecutiveControlTowerQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.executiveControlTower(params),
    queryFn: () => getExecutiveControlTower(params),
    enabled,
  });
}

export function useOwnerMarginProtectionReport(
  params?: OwnerMarginProtectionReportQuery,
  enabled = true,
) {
  return useQuery({
    queryKey:
      productionIntelligenceQueryKeys.ownerMarginProtectionReport(params),
    queryFn: () => getOwnerMarginProtectionReport(params),
    enabled,
  });
}

export function useOwnerNetworkIntelligenceInsights(
  params?: OwnerNetworkIntelligenceInsightsQuery,
  enabled = true,
) {
  return useQuery({
    queryKey:
      productionIntelligenceQueryKeys.ownerNetworkIntelligenceInsights(params),
    queryFn: () => getOwnerNetworkIntelligenceInsights(params),
    enabled,
  });
}

export function useSalesDataValidation(params: SalesDataValidationQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.salesDataValidation(params),
    queryFn: () => getSalesDataValidation(params),
    enabled: Boolean(params.branch_id),
  });
}

export function useSetupForecastWOW(
  params?: SetupForecastWOWQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.setupForecastWOW(params),
    queryFn: () => getSetupForecastWOW(params),
    enabled,
  });
}

export function useStaffShiftChecklist(params: StaffShiftChecklistQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.staffShiftChecklist(params),
    queryFn: () => getStaffShiftChecklist(params),
    enabled: Boolean(params.branch_id),
  });
}

export function useUpdateStaffShiftChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateStaffShiftChecklistPayload) =>
      updateStaffShiftChecklist(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.staffShiftChecklist({
          branch_id: variables.branch_id,
          target_date: variables.target_date,
        }),
      });
    },
  });
}

export function useStaffStockoutEvents(params: StaffStockoutEventsQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.staffStockoutEvents(params),
    queryFn: () => getStaffStockoutEvents(params),
    enabled: Boolean(params.branch_id),
  });
}

export function useCreateStaffStockoutEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateStaffStockoutEventPayload) =>
      createStaffStockoutEvent(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.staffStockoutEvents({
          branch_id: variables.branch_id,
        }),
      });
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.salesDataValidation({
          branch_id: variables.branch_id,
        }),
      });
    },
  });
}

export function useStaffPersonalDashboard(params: StaffPersonalDashboardQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.staffPersonalDashboard(params),
    queryFn: () => getStaffPersonalDashboard(params),
    enabled: Boolean(params.staff_user_id),
  });
}

export function useStaffAccountability(params: StaffAccountabilityQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.staffAccountability(params),
    queryFn: () => getStaffAccountability(params),
    enabled: Boolean(params.branch_id),
  });
}

export function useOperationsProduction(params: OperationsProductionQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.operationsProduction(params),
    queryFn: () => getOperationsProductionSnapshot(params),
    enabled: Boolean(params.branch_id || params.target_date),
  });
}

export function useRiskSnapshot(params: RiskSnapshotQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.operationsRisk(params),
    queryFn: () => getRiskSnapshot(params),
    enabled: Boolean(params.branch_id),
  });
}

export function useOperationsHistorySnapshot(params: OperationsHistoryQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.operationsHistory(params),
    queryFn: () => getOperationsHistorySnapshot(params),
    enabled: Boolean(params.branch_id),
  });
}

export function useItemHistory(itemId: string, params: ItemHistoryQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.itemHistory(itemId, params),
    queryFn: () => getItemHistory(itemId, params),
    enabled: Boolean(itemId && params.branch_id),
  });
}

export function useSalesWasteReport(params: SalesWasteReportQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.salesWasteReport(params),
    queryFn: () => getSalesWasteReport(params),
    enabled: Boolean(params.branch_id),
  });
}

export function useAdvancedForecast(
  params?: AdvancedForecastPayload,
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.advancedForecast(params),
    queryFn: () => getAdvancedForecast(params as AdvancedForecastPayload),
    enabled: Boolean(enabled && params?.branch_id && params?.item_id),
  });
}

export function useForecastScenarios(
  params?: ForecastScenariosQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.forecastScenarios(params),
    queryFn: () => getForecastScenarios(params as ForecastScenariosQuery),
    enabled: Boolean(enabled && params?.branch_id && params?.item_id),
  });
}

export function useForecastConfidence(
  params?: ForecastConfidenceQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.forecastConfidence(params),
    queryFn: () => getForecastConfidence(params as ForecastConfidenceQuery),
    enabled: Boolean(enabled && params?.branch_id && params?.item_id),
  });
}

export function useForecastMetrics(
  params?: ForecastMetricsQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.forecastMetrics(params),
    queryFn: () => getForecastMetrics(params as ForecastMetricsQuery),
    enabled: Boolean(enabled && params?.branch_id),
  });
}

export function useChefSkillScore(
  params?: ChefSkillScoreQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.chefSkillScore(params),
    queryFn: () => getChefSkillScore(params as ChefSkillScoreQuery),
    enabled: Boolean(enabled && params?.user_id && params?.branch_id),
  });
}

export function useDataQualityReport(
  params?: DataQualityReportQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.dataQualityReport(params),
    queryFn: () => getDataQualityReport(params as DataQualityReportQuery),
    enabled: Boolean(enabled && params?.branch_id),
  });
}

export function useRealTimeVelocity() {
  return useMutation({
    mutationFn: (payload: VelocityUpdatePayload) =>
      updateRealTimeVelocity(payload),
  });
}

export function useIntegrationsOverview(params: IntegrationsOverviewQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.integrationsOverview(params),
    queryFn: () => getIntegrationsOverview(params),
    enabled: !!params.organization_id,
  });
}

export function useIntegrationsSyncRetry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      branch_id: string;
      connection_id?: string;
      provider_code?: string;
    }) => retryIntegrationsSync(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.root,
      });
    },
  });
}

export function useSquareOAuthStart() {
  return useMutation({
    mutationFn: (payload: SquareOAuthStartPayload) => startSquareOAuth(payload),
  });
}

export function useToastOAuthStart() {
  return useMutation({
    mutationFn: (payload: ToastOAuthStartPayload) => startToastOAuth(payload),
  });
}

export function useLoyverseOAuthStart() {
  return useMutation({
    mutationFn: (payload: LoyverseOAuthStartPayload) =>
      startLoyverseOAuth(payload),
  });
}

export function useCloverOAuthStart() {
  return useMutation({
    mutationFn: (payload: CloverOAuthStartPayload) => startCloverOAuth(payload),
  });
}

export function useRetryIntegrationsSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      branch_id: string;
      connection_id?: string;
      provider_code?: string;
    }) => retryIntegrationsSync(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.root,
      });
    },
  });
}

export function usePreviewPOSCSVImport() {
  return useMutation({
    mutationFn: (payload: POSCSVPreviewPayload) => previewPOSCSVImport(payload),
  });
}

export function useImportPOSCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: POSCSVImportPayload) => importPOSCSV(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: productionIntelligenceQueryKeys.salesDataValidation({
          branch_id: variables.branch_id,
        }),
      });
    },
  });
}
