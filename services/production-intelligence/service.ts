import { z } from "zod";
import { apiClientWithSchema } from "@/lib/api/client";
import { productionIntelligenceEndpoints } from "@/services/production-intelligence/endpoints";
import {
  branchCommandViewSchema,
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
  type CreatePrepRecommendationDecisionPayload,
  type CreateStaffStockoutEventPayload,
  type SquareOAuthStartPayload,
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

export async function getTodayPrepRecommendations(
  params?: TodayPrepRecommendationsQuery,
) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.todayRecommendations(), params),
    z.array(dailyPrepRecommendationSchema),
    { method: "GET" },
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
