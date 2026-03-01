import { z } from "zod";
import { apiClientWithSchema } from "@/lib/api/client";
import { productionIntelligenceEndpoints } from "@/services/production-intelligence/endpoints";
import {
  branchDayInitializePayloadSchema,
  branchDayStatusUpdatePayloadSchema,
  branchDayTodaySchema,
  createProductionLogPayloadSchema,
  prepPlanEvaluatePayloadSchema,
  prepPlanEvaluateResponseSchema,
  branchCommandViewSchema,
  productionLogSchema,
  createPrepRecommendationDecisionSchema,
  createStaffStockoutEventResponseSchema,
  createStaffStockoutEventSchema,
  dailyPrepRecommendationSchema,
  executiveControlTowerSnapshotSchema,
  ownerMarginProtectionReportSchema,
  ownerDailyPerformanceSchema,
  productionIntelligenceAccessScopeSchema,
  prepRecommendationDecisionSchema,
  salesDataValidationSchema,
  staffShiftChecklistSchema,
  staffStockoutEventsResponseSchema,
  squareOAuthStartPayloadSchema,
  squareOAuthStartResponseSchema,
  updateStaffShiftChecklistSchema,
  updatePrepPlanItemPayloadSchema,
  type CreatePrepRecommendationDecisionPayload,
  type CreateProductionLogPayload,
  type BranchDayInitializePayload,
  type BranchDayStatusUpdatePayload,
  type CreateStaffStockoutEventPayload,
  type PrepPlanEvaluatePayload,
  type SquareOAuthStartPayload,
  type UpdatePrepPlanItemPayload,
  type UpdateStaffShiftChecklistPayload,
} from "@/services/production-intelligence/types";

type QueryValue = string | number | boolean | null | undefined;

function withQuery(
  endpoint: string,
  params?: Record<string, QueryValue>,
): string {
  if (!params) return endpoint;

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `${endpoint}?${query}` : endpoint;
}

export type AccessScopeQuery = {
  organization_id?: string;
};

export async function getProductionIntelligenceAccessScope(
  params?: AccessScopeQuery,
) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.accessScope(), params),
    productionIntelligenceAccessScopeSchema,
    { method: "GET" },
  );
}

export type TodayPrepRecommendationsQuery = {
  branch_id?: string;
  target_date?: string;
  include_history?: boolean;
};

export type BranchDayTodayQuery = {
  branch_id?: string;
  date?: string;
};

export async function getTodayPrepRecommendations(
  params?: TodayPrepRecommendationsQuery,
) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.todayRecommendations(), params),
    z.array(dailyPrepRecommendationSchema),
    { method: "GET" },
  );
}

export async function initializeBranchDay(payload: BranchDayInitializePayload) {
  const body = branchDayInitializePayloadSchema.parse(payload);
  return apiClientWithSchema(
    productionIntelligenceEndpoints.branchDayInitialize(),
    branchDayTodaySchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function getBranchDayToday(params?: BranchDayTodayQuery) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.branchDayToday(), params),
    branchDayTodaySchema,
    { method: "GET" },
  );
}

export async function updateBranchDayStatus(
  branchDayId: string,
  payload: BranchDayStatusUpdatePayload,
) {
  const body = branchDayStatusUpdatePayloadSchema.parse(payload);
  return apiClientWithSchema(
    productionIntelligenceEndpoints.branchDayStatus(branchDayId),
    branchDayTodaySchema,
    {
      method: "PATCH",
      body,
    },
  );
}

export async function evaluatePrepPlan(payload: PrepPlanEvaluatePayload) {
  const body = prepPlanEvaluatePayloadSchema.parse(payload);
  return apiClientWithSchema(
    productionIntelligenceEndpoints.prepPlanEvaluate(),
    prepPlanEvaluateResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function updatePrepPlanItem(
  prepPlanItemId: string,
  payload: UpdatePrepPlanItemPayload,
) {
  const body = updatePrepPlanItemPayloadSchema.parse(payload);
  return apiClientWithSchema(
    productionIntelligenceEndpoints.prepPlanDetail(prepPlanItemId),
    z.object({
      id: z.string().uuid(),
      product_id: z.string().uuid(),
      product_title: z.string(),
      suggested_quantity: z.number(),
      planned_quantity: z.number().nullable(),
      final_quantity: z.number(),
      unit: z.string(),
      suggestion_reason_json: z.record(z.string(), z.unknown()),
      accepted_suggestion: z.boolean(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
    {
      method: "PATCH",
      body,
    },
  );
}

export async function createProductionLog(payload: CreateProductionLogPayload) {
  const body = createProductionLogPayloadSchema.parse(payload);
  return apiClientWithSchema(
    productionIntelligenceEndpoints.productionLogCreate(),
    productionLogSchema,
    {
      method: "POST",
      body,
    },
  );
}

export type BranchCommandViewQuery = {
  branch_id: string;
  target_date?: string;
};

export async function getBranchCommandView(params: BranchCommandViewQuery) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.branchCommand(), params),
    branchCommandViewSchema,
    { method: "GET" },
  );
}

export async function createPrepRecommendationDecision(
  recommendationId: string,
  payload: CreatePrepRecommendationDecisionPayload,
) {
  const body = createPrepRecommendationDecisionSchema.parse(payload);

  return apiClientWithSchema(
    productionIntelligenceEndpoints.recommendationDecision(recommendationId),
    prepRecommendationDecisionSchema,
    {
      method: "POST",
      body,
    },
  );
}

export type OwnerDailyPerformanceQuery = {
  branch_id: string;
  target_date?: string;
};

export async function getOwnerDailyPerformance(
  params: OwnerDailyPerformanceQuery,
) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.ownerDailyPerformance(), params),
    ownerDailyPerformanceSchema,
    { method: "GET" },
  );
}

export type ExecutiveControlTowerQuery = {
  branch_id?: string;
  target_date?: string;
};

export async function getExecutiveControlTower(
  params?: ExecutiveControlTowerQuery,
) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.controlTower(), params),
    executiveControlTowerSnapshotSchema,
    { method: "GET" },
  );
}

export type OwnerMarginProtectionReportQuery = {
  branch_id?: string;
  target_date?: string;
};

export async function getOwnerMarginProtectionReport(
  params?: OwnerMarginProtectionReportQuery,
) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.ownerDailyMarginProtection(), params),
    ownerMarginProtectionReportSchema,
    { method: "GET" },
  );
}

export type SalesDataValidationQuery = {
  branch_id: string;
  target_date?: string;
};

export async function getSalesDataValidation(params: SalesDataValidationQuery) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.salesDataValidation(), params),
    salesDataValidationSchema,
    { method: "GET" },
  );
}

export type StaffShiftChecklistQuery = {
  branch_id: string;
  target_date?: string;
};

export async function getStaffShiftChecklist(params: StaffShiftChecklistQuery) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.staffShiftChecklist(), params),
    staffShiftChecklistSchema,
    { method: "GET" },
  );
}

export async function updateStaffShiftChecklist(
  payload: UpdateStaffShiftChecklistPayload,
) {
  const body = updateStaffShiftChecklistSchema.parse(payload);

  return apiClientWithSchema(
    productionIntelligenceEndpoints.staffShiftChecklist(),
    staffShiftChecklistSchema,
    {
      method: "PUT",
      body,
    },
  );
}

export type StaffStockoutEventsQuery = {
  branch_id: string;
  target_date?: string;
};

export async function getStaffStockoutEvents(params: StaffStockoutEventsQuery) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.staffStockoutEvents(), params),
    staffStockoutEventsResponseSchema,
    { method: "GET" },
  );
}

export async function createStaffStockoutEvent(
  payload: CreateStaffStockoutEventPayload,
) {
  const body = createStaffStockoutEventSchema.parse(payload);

  return apiClientWithSchema(
    productionIntelligenceEndpoints.staffStockoutEvents(),
    createStaffStockoutEventResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function startSquareOAuth(payload: SquareOAuthStartPayload) {
  const body = squareOAuthStartPayloadSchema.parse(payload);

  return apiClientWithSchema(
    productionIntelligenceEndpoints.squareOAuthStart(),
    squareOAuthStartResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}
