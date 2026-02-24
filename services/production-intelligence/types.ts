import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Prep Recommendation Decision
// ─────────────────────────────────────────────────────────────────────────────
export const prepRecommendationDecisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["ACCEPT", "OVERRIDE", "STOCKOUT_PROTECT"]),
  override_quantity: z.number().nullable(),
  override_reason: z.string(),
  decided_by: z.string().uuid(),
  decided_at: z.string(),
});
export type PrepRecommendationDecision = z.infer<
  typeof prepRecommendationDecisionSchema
>;

export const createPrepRecommendationDecisionSchema = z.object({
  decision: z.enum(["ACCEPT", "OVERRIDE", "STOCKOUT_PROTECT"]),
  override_quantity: z.number().optional(),
  override_reason: z.string().optional(),
});
export type CreatePrepRecommendationDecisionPayload = z.infer<
  typeof createPrepRecommendationDecisionSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Daily Prep Recommendation
// ─────────────────────────────────────────────────────────────────────────────
export const dataSufficiencySchema = z.object({
  level: z.enum(["SUFFICIENT", "LIMITED", "INSUFFICIENT"]),
  indicator: z.enum(["GREEN", "YELLOW", "RED"]),
  min_history_days: z.number(),
  sales_days: z.number(),
  waste_days: z.number(),
  prep_days: z.number(),
  confidence_tier: z.string(),
  notes: z.string(),
});
export type DataSufficiency = z.infer<typeof dataSufficiencySchema>;

export const dailyPrepRecommendationSchema = z.object({
  id: z.string().uuid(),
  target_date: z.string(),
  version: z.number(),
  is_current: z.boolean(),
  replaced_at: z.string().nullable(),
  branch: z.string().uuid(),
  item: z.string().uuid(),
  item_title: z.string(),
  recommended_quantity: z.number(),
  buffer_percentage: z.number(),
  buffer_quantity: z.number(),
  cost_per_unit: z.number().nullable(),
  last_7_day_avg_prep: z.number(),
  cost_impact_ugx: z.number().nullable(),
  cost_impact_message: z.string(),
  baseline_forecast: z.number(),
  model_type: z.string(),
  unit: z.string(),
  confidence_score: z.number(),
  data_sufficiency: dataSufficiencySchema,
  waste_risk_score: z.number(),
  stockout_risk_score: z.number(),
  rationale: z.string(),
  feature_flags: z.record(z.string(), z.unknown()).optional(),
  decision: prepRecommendationDecisionSchema.nullable(),
  generated_at: z.string(),
});
export type DailyPrepRecommendation = z.infer<
  typeof dailyPrepRecommendationSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Daily Prep Performance
// ─────────────────────────────────────────────────────────────────────────────
export const dailyPrepPerformanceSchema = z.object({
  id: z.string().uuid(),
  branch: z.string().uuid(),
  metric_date: z.string(),
  compliance_rate: z.number(),
  override_rate: z.number(),
  forecast_accuracy: z.number(),
  variance_reduction: z.number(),
  stockout_events: z.number(),
  stockout_log: z.array(z.unknown()),
  waste_avoided_qty: z.number(),
  waste_avoided_cost: z.number(),
  compliance_cost_impact: z.number(),
  override_cost_impact: z.number(),
  potential_cost_impact: z.number(),
  updated_at: z.string(),
});
export type DailyPrepPerformance = z.infer<typeof dailyPrepPerformanceSchema>;

export const ownerDailyPerformanceSchema = dailyPrepPerformanceSchema.extend({
  recommendation_count: z.number().optional(),
  override_count: z.number().optional(),
});
export type OwnerDailyPerformance = z.infer<typeof ownerDailyPerformanceSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Staff Daily Accountability
// ─────────────────────────────────────────────────────────────────────────────
export const staffDailyAccountabilitySchema = z.object({
  id: z.string().uuid(),
  branch: z.string().uuid(),
  staff_user: z.string().uuid(),
  staff_user_email: z.string().email(),
  staff_user_name: z.string(),
  metric_date: z.string(),
  total_batches_prepared: z.number(),
  decisions_total: z.number(),
  surplus_approved_count: z.number(),
  surplus_overridden_count: z.number(),
  forecast_adherence_score: z.number(),
  decision_quality_score: z.number(),
  override_accuracy_score: z.number(),
  consistency_score: z.number(),
  waste_cost_generated: z.number(),
  waste_prevented_if_followed_cost: z.number(),
  waste_cost_ratio_score: z.number(),
  service_level_score: z.number(),
  stockout_events_count: z.number(),
  estimated_unmet_demand_qty: z.number(),
  lost_margin_attributed: z.number(),
  chef_profit_score: z.number(),
  details: z.record(z.string(), z.unknown()).optional(),
  updated_at: z.string(),
});
export type StaffDailyAccountability = z.infer<
  typeof staffDailyAccountabilitySchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Control Tower Snapshot
// ─────────────────────────────────────────────────────────────────────────────
export const controlTowerSnapshotSchema = z.object({
  branches_healthy: z.number(),
  branches_at_risk: z.number(),
  total_prep_items: z.number(),
  stockout_alerts: z.number(),
  waste_alerts: z.number(),
  compliance_rate: z.number(),
  top_stockout_items: z.array(
    z.object({
      item_id: z.string().uuid(),
      item_title: z.string(),
      stockout_count: z.number(),
    }),
  ),
  top_waste_items: z.array(
    z.object({
      item_id: z.string().uuid(),
      item_title: z.string(),
      waste_cost: z.number(),
      waste_qty: z.number(),
    }),
  ),
  trend: z.object({
    compliance_7d: z.number(),
    waste_cost_7d: z.number(),
    forecast_accuracy_7d: z.number(),
  }),
  generated_at: z.string(),
});
export type ControlTowerSnapshot = z.infer<typeof controlTowerSnapshotSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Operations Production Snapshot
// ─────────────────────────────────────────────────────────────────────────────
export const operationsProductionSnapshotSchema = z.object({
  target_date: z.string(),
  branches_count: z.number(),
  total_prep_items: z.number(),
  ready_items: z.number(),
  pending_items: z.number(),
  override_items: z.number(),
  critical_decisions_pending: z.number(),
  items_by_status: z.record(z.string(), z.number()),
  recommendations_accepted: z.number(),
  recommendations_overridden: z.number(),
  override_rate: z.number(),
  total_cost_impact: z.number(),
  branches: z.array(
    z.object({
      branch_id: z.string().uuid(),
      branch_name: z.string(),
      item_count: z.number(),
      override_count: z.number(),
      decision_pending: z.boolean(),
    }),
  ),
  generated_at: z.string(),
});
export type OperationsProductionSnapshot = z.infer<
  typeof operationsProductionSnapshotSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Staff Personal Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const staffPersonalDashboardSchema = z.object({
  staff_user: z.string().uuid(),
  staff_user_name: z.string(),
  metric_date: z.string(),
  batches_prepped_today: z.number(),
  decisions_made: z.number(),
  decision_accuracy: z.number(),
  waste_cost_today: z.number(),
  waste_prevented_cost: z.number(),
  current_actions: z.array(
    z.object({
      action_id: z.string().uuid(),
      item_id: z.string().uuid(),
      item_title: z.string(),
      action_type: z.string(),
      status: z.string(),
    }),
  ),
  today_recommendations: z.array(
    z.object({
      recommendation_id: z.string().uuid(),
      item_title: z.string(),
      quantity: z.number(),
      decision: z.enum(["PENDING", "ACCEPTED", "OVERRIDDEN"]),
    }),
  ),
  performance_trend: z.object({
    decision_quality_7d: z.number(),
    waste_cost_7d: z.number(),
    batches_7d: z.number(),
  }),
  generated_at: z.string(),
});
export type StaffPersonalDashboard = z.infer<
  typeof staffPersonalDashboardSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Staff Shift Checklist
// ─────────────────────────────────────────────────────────────────────────────
export const staffShiftChecklistSchema = z.object({
  id: z.string().uuid(),
  checklist_date: z.string(),
  items: z.record(z.string(), z.boolean()),
  completed_count: z.number(),
  total_count: z.number(),
  updated_at: z.string().nullable(),
});
export type StaffShiftChecklist = z.infer<typeof staffShiftChecklistSchema>;

export const updateStaffShiftChecklistSchema = z.object({
  branch_id: z.string().uuid(),
  target_date: z.string().optional(),
  items: z.record(z.string(), z.boolean()),
});
export type UpdateStaffShiftChecklistPayload = z.infer<
  typeof updateStaffShiftChecklistSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Staff Stockout Event
// ─────────────────────────────────────────────────────────────────────────────
export const staffStockoutEventSchema = z.object({
  id: z.string().uuid(),
  item_id: z.string().uuid(),
  item_title: z.string(),
  staff_user_id: z.string().uuid(),
  sold_out_at: z.string().nullable(),
  estimated_unmet_demand: z.number(),
  unit_margin: z.string(),
  lost_margin: z.string().optional(),
  notes: z.string(),
});
export type StaffStockoutEvent = z.infer<typeof staffStockoutEventSchema>;

export const createStaffStockoutEventSchema = z.object({
  branch_id: z.string().uuid(),
  item_id: z.string().uuid(),
  sold_out_at: z.string().optional(),
  estimated_unmet_demand: z.number().optional(),
  notes: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type CreateStaffStockoutEventPayload = z.infer<
  typeof createStaffStockoutEventSchema
>;

export const createStaffStockoutEventResponseSchema = z.object({
  created: z.boolean(),
  id: z.string().uuid(),
  branch_id: z.string().uuid(),
  item_id: z.string().uuid(),
  event_date: z.string(),
  estimated_unmet_demand: z.number(),
  unit_margin: z.string(),
  lost_margin: z.string().optional(),
});
export type CreateStaffStockoutEventResponse = z.infer<
  typeof createStaffStockoutEventResponseSchema
>;

export const staffStockoutEventsResponseSchema = z.object({
  branch_id: z.string().uuid(),
  target_date: z.string(),
  count: z.number(),
  results: z.array(staffStockoutEventSchema),
});
export type StaffStockoutEventsResponse = z.infer<
  typeof staffStockoutEventsResponseSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Sales Data Validation
// ─────────────────────────────────────────────────────────────────────────────
export const salesDataValidationSchema = z.object({
  branch_id: z.string().uuid(),
  target_date: z.string(),
  has_sales_data: z.boolean(),
  missing_sales_detected: z.boolean(),
  missing_items_count: z.number(),
  missing_items: z.array(
    z.object({
      item_id: z.string().uuid(),
      item_title: z.string(),
    }),
  ),
  quick_entry_endpoint: z.string(),
  fallback_priority: z.array(z.string()),
  report_forward_address: z.string(),
  can_continue_without_sales: z.boolean(),
  margin_protection: z.record(z.string(), z.unknown()),
});
export type SalesDataValidation = z.infer<typeof salesDataValidationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Access Scope
// ─────────────────────────────────────────────────────────────────────────────
export const productionIntelligenceAccessScopeSchema = z.object({
  organization_id: z.string().uuid(),
  organization_name: z.string(),
  role: z.string(),
  can_view_all_branches: z.boolean(),
  accessible_branches: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      is_primary: z.boolean(),
      can_manage_branch_data: z.boolean(),
    }),
  ),
  default_branch_id: z.string().uuid().nullable(),
});
export type ProductionIntelligenceAccessScope = z.infer<
  typeof productionIntelligenceAccessScopeSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Square OAuth
// ─────────────────────────────────────────────────────────────────────────────
export const squareOAuthStartPayloadSchema = z.object({
  branch_id: z.string().uuid(),
  square_location_id: z.string().optional(),
  post_connect_redirect: z.string().url().optional(),
});
export type SquareOAuthStartPayload = z.infer<
  typeof squareOAuthStartPayloadSchema
>;

export const squareOAuthStartResponseSchema = z.object({
  authorize_url: z.string().url(),
  state_expires_in_seconds: z.number(),
});
export type SquareOAuthStartResponse = z.infer<
  typeof squareOAuthStartResponseSchema
>;
