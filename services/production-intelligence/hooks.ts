"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProductionLog,
  getBranchDayToday,
  getBranchCommandView,
  initializeBranchDay,
  lockBranchDayPlan,
  createPrepRecommendationDecision,
  evaluatePrepPlan,
  getExecutiveControlTower,
  getOwnerMarginProtectionReport,
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
  startSquareOAuth,
  updateBranchDayStatus,
  updatePrepPlanItem,
  updateStaffShiftChecklist,
  type AccessScopeQuery,
  type BranchDayTodayQuery,
  type BranchCommandViewQuery,
  type ExecutiveControlTowerQuery,
  type OwnerMarginProtectionReportQuery,
  type OwnerDailyPerformanceQuery,
  type SalesDataValidationQuery,
  type SetupForecastWOWQuery,
  type POSCSVImportPayload,
  type POSCSVPreviewPayload,
  type StaffShiftChecklistQuery,
  type StaffStockoutEventsQuery,
  type TodayPrepRecommendationsQuery,
} from "@/services/production-intelligence/service";
import type {
  BranchDayInitializePayload,
  BranchDayPlanLockPayload,
  BranchDayStatusUpdatePayload,
  CreateProductionLogPayload,
  CreatePrepRecommendationDecisionPayload,
  CreateStaffStockoutEventPayload,
  PrepPlanEvaluatePayload,
  SquareOAuthStartPayload,
  UpdatePrepPlanItemPayload,
  UpdateStaffShiftChecklistPayload,
} from "@/services/production-intelligence/types";

export const productionIntelligenceQueryKeys = {
  root: ["production-intelligence"] as const,
  accessScope: (organizationId?: string) =>
    [...productionIntelligenceQueryKeys.root, "access-scope", organizationId ?? ""] as const,
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
};

export function useProductionIntelligenceAccessScope(params?: AccessScopeQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.accessScope(params?.organization_id),
    queryFn: () => getProductionIntelligenceAccessScope(params),
  });
}

export function useTodayPrepRecommendations(params?: TodayPrepRecommendationsQuery) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.todayRecommendations(params),
    queryFn: () => getTodayPrepRecommendations(params),
  });
}

export function useBranchDayToday(params?: BranchDayTodayQuery, enabled = true) {
  return useQuery({
    queryKey: productionIntelligenceQueryKeys.branchDayToday(params),
    queryFn: () => getBranchDayToday(params),
    enabled: enabled && Boolean(params?.branch_id),
  });
}

export function useInitializeBranchDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BranchDayInitializePayload) => initializeBranchDay(payload),
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

export function useCreateProductionLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProductionLogPayload) => createProductionLog(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...productionIntelligenceQueryKeys.root, "branch-day-today"],
      });
    },
  });
}

export function useBranchCommandView(params: BranchCommandViewQuery, enabled = true) {
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
        queryKey: [...productionIntelligenceQueryKeys.root, "owner-daily-performance"],
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
    queryKey: productionIntelligenceQueryKeys.ownerMarginProtectionReport(params),
    queryFn: () => getOwnerMarginProtectionReport(params),
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

export function useSetupForecastWOW(params?: SetupForecastWOWQuery, enabled = true) {
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

export function useStartSquareOAuth() {
  return useMutation({
    mutationFn: (payload: SquareOAuthStartPayload) => startSquareOAuth(payload),
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
