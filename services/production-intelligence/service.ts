import { z } from "zod";
import { apiClientWithSchema } from "@/lib/api/client";
import { productionIntelligenceEndpoints } from "@/services/production-intelligence/endpoints";
import {
  branchDayInitializePayloadSchema,
  branchDayPlanLockPayloadSchema,
  branchDayLiveAlertIgnorePayloadSchema,
  branchDayLiveAlertIgnoreResponseSchema,
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
  ownerNetworkIntelligenceInsightsSchema,
  ownerDailyPerformanceSchema,
  setupForecastWOWSchema,
  productionIntelligenceAccessScopeSchema,
  prepRecommendationDecisionSchema,
  salesDataValidationSchema,
  staffShiftChecklistSchema,
  staffStockoutEventsResponseSchema,
  squareOAuthStartPayloadSchema,
  squareOAuthStartResponseSchema,
  toastOAuthStartPayloadSchema,
  toastOAuthStartResponseSchema,
  posCSVPreviewResponseSchema,
  posCSVImportResponseSchema,
  updateStaffShiftChecklistSchema,
  salesManualQuickEntryPayloadSchema,
  salesManualQuickEntryResponseSchema,
  updatePrepPlanItemPayloadSchema,
  staffAccountabilityOverviewSchema,
  staffPersonalDashboardSchema,
  integrationsOverviewSchema,
  operationsProductionSnapshotSchema,
  type CreatePrepRecommendationDecisionPayload,
  type CreateProductionLogPayload,
  type BranchDayInitializePayload,
  type BranchDayPlanLockPayload,
  type BranchDayLiveAlertIgnorePayload,
  type BranchDayStatusUpdatePayload,
  type CreateStaffStockoutEventPayload,
  type PrepPlanEvaluatePayload,
  type SquareOAuthStartPayload,
  type ToastOAuthStartPayload,
  type POSCSVPreviewResponse,
  type POSCSVImportResponse,
  type UpdatePrepPlanItemPayload,
  type UpdateStaffShiftChecklistPayload,
  type SalesManualQuickEntryPayload,
} from "@/services/production-intelligence/types";

export type StaffPersonalDashboardQuery = {
  branch_id?: string;
  staff_user_id?: string;
  target_date?: string;
};

export async function getStaffPersonalDashboard(
  params: StaffPersonalDashboardQuery,
) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.staffPersonalDashboard(), params),
    staffPersonalDashboardSchema,
    { method: "GET" },
  );
}

export type StaffAccountabilityQuery = {
  branch_id: string;
  target_date?: string;
};

export async function getStaffAccountability(params: StaffAccountabilityQuery) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.staffAccountability(), params),
    staffAccountabilityOverviewSchema,
    { method: "GET" },
  );
}

export type IntegrationsOverviewQuery = {
  organization_id: string;
};

export async function getIntegrationsOverview(
  params: IntegrationsOverviewQuery,
) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.integrationsOverview(), params),
    integrationsOverviewSchema,
    { method: "GET" },
  );
}

export type OperationsProductionQuery = {
  branch_id?: string;
  target_date?: string;
};

export async function getOperationsProductionSnapshot(
  params: OperationsProductionQuery,
) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.operationsProduction(), params),
    operationsProductionSnapshotSchema,
    { method: "GET" },
  );
}

export async function retryIntegrationsSync() {
  return apiClientWithSchema(
    productionIntelligenceEndpoints.integrationsSyncRetry(),
    z.object({ status: z.string() }),
    { method: "POST" },
  );
}

type QueryValue = string | number | boolean | null | undefined;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeBranchId(branchId?: string) {
  if (!branchId) return undefined;
  return UUID_PATTERN.test(branchId) ? branchId : undefined;
}

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
  const safeBranchId = normalizeBranchId(params?.branch_id);
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.branchDayToday(), {
      ...params,
      branch_id: safeBranchId,
    }),
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

export async function lockBranchDayPlan(
  branchDayId: string,
  payload: BranchDayPlanLockPayload = {},
) {
  const body = branchDayPlanLockPayloadSchema.parse(payload);
  return apiClientWithSchema(
    productionIntelligenceEndpoints.branchDayLockPlan(branchDayId),
    branchDayTodaySchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function ignoreBranchDayLiveAlert(
  branchDayId: string,
  payload: BranchDayLiveAlertIgnorePayload,
) {
  const body = branchDayLiveAlertIgnorePayloadSchema.parse(payload);
  return apiClientWithSchema(
    productionIntelligenceEndpoints.branchDayAlertIgnore(branchDayId),
    branchDayLiveAlertIgnoreResponseSchema,
    {
      method: "POST",
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

export async function createSalesManualQuickEntry(
  payload: SalesManualQuickEntryPayload,
) {
  const body = salesManualQuickEntryPayloadSchema.parse(payload);
  return apiClientWithSchema(
    productionIntelligenceEndpoints.salesManualQuickEntry(),
    salesManualQuickEntryResponseSchema,
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

export type OwnerNetworkIntelligenceInsightsQuery = {
  organization_id?: string;
  target_date?: string;
  lookback_days?: number;
};

export async function getOwnerMarginProtectionReport(
  params?: OwnerMarginProtectionReportQuery,
) {
  return apiClientWithSchema(
    withQuery(
      productionIntelligenceEndpoints.ownerDailyMarginProtection(),
      params,
    ),
    ownerMarginProtectionReportSchema,
    { method: "GET" },
  );
}

export async function getOwnerNetworkIntelligenceInsights(
  params?: OwnerNetworkIntelligenceInsightsQuery,
) {
  return apiClientWithSchema(
    withQuery(
      productionIntelligenceEndpoints.ownerNetworkIntelligenceInsights(),
      params,
    ),
    ownerNetworkIntelligenceInsightsSchema,
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

export type SetupForecastWOWQuery = {
  branch_id?: string;
  target_date?: string;
  horizon_weeks?: number;
};

export async function getSetupForecastWOW(params?: SetupForecastWOWQuery) {
  return apiClientWithSchema(
    withQuery(productionIntelligenceEndpoints.setupForecastWOW(), params),
    setupForecastWOWSchema,
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

export async function startToastOAuth(payload: ToastOAuthStartPayload) {
  const body = toastOAuthStartPayloadSchema.parse(payload);

  return apiClientWithSchema(
    productionIntelligenceEndpoints.toastOAuthStart(),
    toastOAuthStartResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export type POSCSVImportPayload = {
  branch_id: string;
  file: File;
  auto_create_items?: boolean;
  column_mapping?: Record<string, string>;
  provider_code?: string;
  use_saved_mapping_profile?: boolean;
  save_mapping_profile?: boolean;
};

export type POSCSVPreviewPayload = POSCSVImportPayload & {
  preview_limit?: number;
};

function buildPOSCSVFormData(
  payload: POSCSVImportPayload | POSCSVPreviewPayload,
  dryRun: boolean,
): FormData {
  const form = new FormData();
  form.append("branch_id", payload.branch_id);
  form.append("file", payload.file);
  form.append(
    "auto_create_items",
    payload.auto_create_items ? "true" : "false",
  );
  if (payload.provider_code) {
    form.append("provider_code", payload.provider_code);
  }
  if (typeof payload.use_saved_mapping_profile === "boolean") {
    form.append(
      "use_saved_mapping_profile",
      payload.use_saved_mapping_profile ? "true" : "false",
    );
  }
  if (typeof payload.save_mapping_profile === "boolean") {
    form.append(
      "save_mapping_profile",
      payload.save_mapping_profile ? "true" : "false",
    );
  }
  if (payload.column_mapping && Object.keys(payload.column_mapping).length) {
    form.append("column_mapping", JSON.stringify(payload.column_mapping));
  }
  if (dryRun) {
    form.append("dry_run", "true");
    const previewPayload = payload as POSCSVPreviewPayload;
    form.append("preview_limit", String(previewPayload.preview_limit ?? 50));
  }
  return form;
}

export async function previewPOSCSVImport(
  payload: POSCSVPreviewPayload,
): Promise<POSCSVPreviewResponse> {
  return apiClientWithSchema(
    productionIntelligenceEndpoints.posCSVImport(),
    posCSVPreviewResponseSchema,
    {
      method: "POST",
      body: buildPOSCSVFormData(payload, true),
    },
  );
}

export async function importPOSCSV(
  payload: POSCSVImportPayload,
): Promise<POSCSVImportResponse> {
  return apiClientWithSchema(
    productionIntelligenceEndpoints.posCSVImport(),
    posCSVImportResponseSchema,
    {
      method: "POST",
      body: buildPOSCSVFormData(payload, false),
    },
  );
}
