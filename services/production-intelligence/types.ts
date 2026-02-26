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
// Branch Day / Morning Mode
// ─────────────────────────────────────────────────────────────────────────────
export const branchDayInitializePayloadSchema = z.object({
  branch_id: z.string().uuid().optional(),
  date: z.string().optional(),
  expected_demand_index: z.number().optional(),
  event_modifier_percentage: z.number().optional(),
  weather_modifier_percentage: z.number().nullable().optional(),
  reservation_modifier: z.number().optional(),
});
export type BranchDayInitializePayload = z.infer<typeof branchDayInitializePayloadSchema>;

export const prepPlanItemSchema = z.object({
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
});
export type PrepPlanItem = z.infer<typeof prepPlanItemSchema>;

export const branchDayTodaySchema = z.object({
  id: z.string().uuid(),
  branch_id: z.string().uuid(),
  branch_name: z.string(),
  date: z.string(),
  status: z.enum(["MORNING", "LIVE", "CLOSED"]),
  expected_demand_index: z.number(),
  forecast_confidence: z.number(),
  event_modifier_percentage: z.number(),
  weather_modifier_percentage: z.number().nullable(),
  demand_signal: z.object({
    expected_demand_index: z.number(),
    forecast_confidence: z.number(),
    event_modifier_percentage: z.number(),
    weather_modifier_percentage: z.number().nullable(),
  }),
  prep_plan_items: z.array(prepPlanItemSchema),
  created_at: z.string(),
  meta: z
    .object({
      created_branch_day: z.boolean(),
      created_prep_plan_items: z.number(),
    })
    .optional(),
});
export type BranchDayToday = z.infer<typeof branchDayTodaySchema>;

export const prepPlanEvaluatePayloadSchema = z.object({
  prep_plan_item_id: z.string().uuid(),
  planned_quantity: z.number().min(0),
});
export type PrepPlanEvaluatePayload = z.infer<typeof prepPlanEvaluatePayloadSchema>;

export const prepPlanEvaluateResponseSchema = z.object({
  waste_risk_increase: z.number(),
  marginal_cost_risk: z.number(),
  stockout_risk_change: z.number(),
});
export type PrepPlanEvaluateResponse = z.infer<typeof prepPlanEvaluateResponseSchema>;

export const updatePrepPlanItemPayloadSchema = z.object({
  planned_quantity: z.number().min(0).optional(),
  accepted_suggestion: z.boolean().optional(),
});
export type UpdatePrepPlanItemPayload = z.infer<typeof updatePrepPlanItemPayloadSchema>;

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

export const executiveControlTowerAlertSchema = z.object({
  id: z.string(),
  branch_id: z.string().uuid(),
  branch_name: z.string(),
  type: z.string().nullable().optional(),
  severity: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  context: z.string().nullable().optional(),
  root_cause: z.string().nullable().optional(),
  suggested_action: z.string().nullable().optional(),
  actions: z.array(z.string()).optional(),
});

export const executiveControlTowerBranchSchema = z.object({
  branch_id: z.string().uuid(),
  branch_name: z.string(),
  revenue: z.number().optional(),
  prepared: z.number().optional(),
  sold: z.number().optional(),
  remaining: z.number().optional(),
  waste_pct: z.number().optional(),
  surplus_pct: z.number().optional(),
  staff_activity_status: z.string().optional(),
  compliance_badge: z.string().optional(),
});

export const executiveControlTowerSnapshotSchema = z.object({
  target_date: z.string(),
  scope_type: z.string().optional(),
  summary: z.object({
    total_revenue: z.number().optional(),
    total_prepared: z.number().optional(),
    total_sold: z.number().optional(),
    predicted_surplus: z.number().optional(),
    waste_risk_pct: z.number().optional(),
    forecast_accuracy_rolling_7d: z.number().optional(),
    cost_saved_today: z.number().optional(),
  }),
  alerts: z.array(executiveControlTowerAlertSchema),
  branch_grid: z.array(executiveControlTowerBranchSchema),
  branch_count: z.number(),
});
export type ExecutiveControlTowerSnapshot = z.infer<
  typeof executiveControlTowerSnapshotSchema
>;

export const ownerMarginProtectionBranchSchema = z.object({
  branch_id: z.string().uuid(),
  branch_name: z.string(),
  margin_signal_status: z.string().optional(),
  margin_deviation_pct: z.number().optional(),
  total_waste_cost: z.string(),
  money_protected_vs_baseline: z.string().optional(),
  forecast_accuracy_summary: z.number().optional(),
});

export const ownerMarginProtectionReportSchema = z.object({
  target_date: z.string(),
  branch_count: z.number(),
  summary: z.object({
    total_waste_cost: z.string(),
    total_money_protected_vs_baseline: z.string(),
    forecast_accuracy_avg_pct: z.number().optional(),
    margin_reliability: z
      .object({
        is_reliable: z.boolean(),
        unreliable_items_count: z.number().optional(),
        warning: z.string().optional(),
      })
      .optional(),
  }),
  branches: z.array(ownerMarginProtectionBranchSchema),
  snapshot: z
    .object({
      id: z.string().uuid().optional(),
      key: z.string().optional(),
      immutable: z.boolean().optional(),
      generated_at: z.string().optional(),
    })
    .optional(),
});
export type OwnerMarginProtectionReport = z.infer<
  typeof ownerMarginProtectionReportSchema
>;

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

export const branchCommandRecommendationSchema = z.object({
  id: z.string().uuid(),
  item_id: z.string().uuid(),
  item_title: z.string(),
  recommended_quantity: z.number(),
  unit: z.string(),
  baseline_forecast: z.number().nullable().optional(),
});

export const branchCommandViewSchema = z.object({
  branch_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  branch_name: z.string(),
  target_date: z.string(),
  margin_protection: z
    .object({
      at_risk_ugx: z.string().optional(),
      saved_ugx: z.string().optional(),
      status: z.string().optional(),
    })
    .partial()
    .optional(),
  panels: z.object({
    real_time: z.object({
      prepared_total: z.number(),
      sold_total: z.number(),
      remaining_total: z.number(),
      at_risk_count: z.number(),
      unit: z.string().optional(),
    }),
    forecast: z.object({
      recommendation_count: z.number(),
      recommendations: z.array(branchCommandRecommendationSchema),
    }),
  }),
  viewer: z
    .object({
      role: z.string(),
      can_view_financials: z.boolean().optional(),
    })
    .partial()
    .optional(),
});
export type BranchCommandView = z.infer<typeof branchCommandViewSchema>;

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
