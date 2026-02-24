"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBranchCommandView,
  createPrepRecommendationDecision,
  getExecutiveControlTower,
  getOwnerMarginProtectionReport,
  createStaffStockoutEvent,
  getOwnerDailyPerformance,
  getProductionIntelligenceAccessScope,
  getSalesDataValidation,
  getStaffShiftChecklist,
  getStaffStockoutEvents,
  getTodayPrepRecommendations,
  startSquareOAuth,
  updateStaffShiftChecklist,
  type AccessScopeQuery,
  type BranchCommandViewQuery,
  type ExecutiveControlTowerQuery,
  type OwnerMarginProtectionReportQuery,
  type OwnerDailyPerformanceQuery,
  type SalesDataValidationQuery,
  type StaffShiftChecklistQuery,
  type StaffStockoutEventsQuery,
  type TodayPrepRecommendationsQuery,
} from "@/services/production-intelligence/service";
import type {
  CreatePrepRecommendationDecisionPayload,
  CreateStaffStockoutEventPayload,
  SquareOAuthStartPayload,
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
