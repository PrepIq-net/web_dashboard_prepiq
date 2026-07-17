import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Learned demand signals (per-branch "what this branch taught us")
// ─────────────────────────────────────────────────────────────────────────────
// A signal's learned response: what it has historically meant for THIS branch,
// with how many days back that up and how confident the model is.
export const learnedResponseSchema = z.object({
  delta_pct: z.number().nullable(),
  confidence: z.number(),
  confidence_label: z.string(),
  sample_count: z.number(),
});
export type LearnedResponse = z.infer<typeof learnedResponseSchema>;

export const learnedPatternSchema = learnedResponseSchema.extend({
  signal_type: z.string(),
  label: z.string(),
  avg_demand_delta: z.number().nullable(),
});
export type LearnedPattern = z.infer<typeof learnedPatternSchema>;

// A signal that actually fired on a given day, enriched with its learned
// response when the branch has one.
export const activeSignalSchema = z.object({
  signal_type: z.string(),
  label: z.string(),
  name: z.string(),
  active: z.boolean(),
  learned: learnedResponseSchema.nullish(),
});
export type ActiveSignal = z.infer<typeof activeSignalSchema>;

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
export type BranchDayInitializePayload = z.infer<
  typeof branchDayInitializePayloadSchema
>;

export const prepPlanItemSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  product_title: z.string(),
  product_image_url: z.string().nullable().optional(),
  suggested_quantity: z.number(),
  forecast_qty: z.number().optional(),
  forecast_confidence: z.number().optional(),
  planned_quantity: z.number().nullable(),
  chef_planned_qty: z.number().nullable().optional(),
  ai_suggested_qty: z.number().nullable().optional(),
  chef_final_qty: z.number().nullable().optional(),
  variance: z.number().optional(),
  decision: z.enum(["ACCEPTED_AI", "CHEF_OVERRIDE"]).nullable().optional(),
  override_reason: z.string().optional(),
  override_reason_note: z.string().optional(),
  carry_over_qty: z.number().optional(),
  net_suggested_quantity: z.number().optional(),
  final_quantity: z.number(),
  unit: z.string(),
  suggestion_reason_json: z.record(z.string(), z.unknown()),
  accepted_suggestion: z.boolean(),
  forecast_context: z.object({
    predicted_orders: z.number(),
    predicted_quantity_needed: z.number(),
    confidence_score: z.number(),
    demand_trend: z.enum(["up", "down", "neutral"]).optional(),
    risk: z.string().optional(),
    lower_bound: z.number(),
    upper_bound: z.number(),
    risk_of_stockout: z.number(),
    risk_of_waste: z.number(),
    projected_margin: z.number(),
    unit_price: z.number().nullable().optional(),
    unit_cost: z.number().nullable().optional(),
    unit_margin: z.number().nullable().optional(),
    price_source: z.string().optional(),
    cost_source: z.string().optional(),
    pricing_reliable: z.boolean().optional(),
    forecast_engine_input: z.record(z.string(), z.unknown()).optional(),
    forecast_engine_output: z.record(z.string(), z.unknown()).optional(),
    reasoning: z.array(z.string()),
    applied_signals: z
      .record(
        z.string(),
        z.object({
          modifier: z.number(),
          source: z.string().optional(),
          special_event_flag: z.boolean().optional(),
          condition: z.string().optional(),
          temp_bucket: z.string().optional(),
          is_rain: z.boolean().optional(),
          estimated_staff_count: z.number().nullable().optional(),
          capacity_pct: z.number().nullable().optional(),
          delivery_ratio: z.number().nullable().optional(),
          multiplier: z.number().optional(),
        }),
      )
      .optional(),
  }),
  live_monitor: z
    .object({
      planned_qty: z.number().optional(),
      additional_qty: z.number().optional(),
      total_prepared_qty: z.number().optional(),
      sold_today: z.number(),
      remaining_qty: z.number().optional(),
      trend_vs_forecast_pct: z.number(),
      sell_through_probability: z.number(),
      stockout_risk_score: z.number().optional(),
      overproduction_risk_score: z.number().optional(),
      suggested_additional_qty: z.number(),
      should_prepare_more_qty: z.number().optional(),
      risk_engine: z
        .object({
          remaining_stock: z.number(),
          avg_demand_last_hour: z.number(),
          hours_until_closing: z.number(),
          forecast_demand_remaining: z.number(),
          runout_minutes: z.number().nullable().optional(),
          prep_time_minutes: z.number().optional(),
          start_new_batch_now: z.boolean().optional(),
          stockout_risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
          waste_risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
        })
        .optional(),
      sales_intake_mode: z
        .enum(["pos_or_import", "manual_quick_tap", "semi_blind"])
        .optional(),
      signal: z.string().nullable(),
      alert: z
        .object({
          severity: z.enum(["MEDIUM", "HIGH", "CRITICAL"]),
          type: z.enum(["STOCKOUT_RISK", "OVERPRODUCTION_RISK", "PREP_NOW"]),
          message: z.string(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PrepPlanItem = z.infer<typeof prepPlanItemSchema>;

export const liveMonitorSchema = prepPlanItemSchema.shape.live_monitor;

// Honest summary of what the forecasting pipeline did during day
// initialization — powers the walkthrough recap and provenance drawer.
export const pipelineStatsSchema = z.object({
  history_days_loaded: z.number().nullable().optional(),
  excluded_days_max: z.number().nullable().optional(),
  items_with_exclusions: z.number().nullable().optional(),
  models_used: z.array(z.string()).nullable().optional(),
  service_level_avg: z.number().nullable().optional(),
  weather_event_signals: z
    .object({
      is_rain: z.boolean().optional(),
      special_event: z.boolean().optional(),
      public_holiday: z.boolean().optional(),
      temperature_bucket: z.string().optional(),
    })
    .nullable()
    .optional(),
  item_count: z.number().nullable().optional(),
  generated_at: z.string().nullable().optional(),
});
export type PipelineStats = z.infer<typeof pipelineStatsSchema>;

/** One ingredient the day's plan needs, measured against what's in the store room. */
export const ingredientRequirementLineSchema = z.object({
  ingredient_id: z.string(),
  ingredient_name: z.string(),
  unit: z.string(),
  needed: z.number(),
  on_hand: z.number(),
  net_need: z.number(),
  purchase_qty: z.number().nullable().optional(),
  estimated_cost: z.number().nullable().optional(),
  supplier_name: z.string().optional(),
  /** False when no stock count exists — `net_need` is then the full requirement,
   *  not a shortfall, and must not be shown as one. */
  stock_known: z.boolean(),
});
export type IngredientRequirementLine = z.infer<
  typeof ingredientRequirementLineSchema
>;

export const ingredientRequirementSchema = z.object({
  date: z.string(),
  status: z.enum(["OK", "SHORT", "NO_RECIPES", "NO_DATA"]),
  source: z.enum(["PLAN_LOCK", "MANUAL"]),
  ingredient_count: z.number(),
  shortfall_count: z.number(),
  coverage_pct: z.number().nullable(),
  total_estimated_cost: z.number().nullable(),
  items_with_no_recipe: z.array(z.string()),
  lines: z.array(ingredientRequirementLineSchema),
  computed_at: z.string().nullable(),
});
export type IngredientRequirement = z.infer<typeof ingredientRequirementSchema>;

// ── Production outcomes (the EOD "what happened to the remaining N?" flow) ──
// Waste is only ever an attributed discard; everything else the chef reports
// (stored / frozen / converted / staff meal / discounted) is an outcome, and
// what nobody explains stays "unaccounted".
export const outcomeStateSchema = z.enum([
  "DISCARDED",
  "REFRIGERATED",
  "FROZEN",
  "CONVERTED",
  "STAFF_MEAL",
  "DISCOUNTED",
  "UNKNOWN",
]);
export type OutcomeState = z.infer<typeof outcomeStateSchema>;

export const discardReasonSchema = z.enum([
  "SPOILED",
  "QUALITY_ISSUE",
  "DEMAND_DROPPED",
  "LATE_PREP",
  "OTHER",
]);
export type DiscardReason = z.infer<typeof discardReasonSchema>;

export const outcomeAttributionRowSchema = z.object({
  prep_plan_item_id: z.string().uuid(),
  item_id: z.string().uuid(),
  item_title: z.string(),
  unit: z.string(),
  prepared: z.number(),
  prepared_basis: z.enum(["LOGGED", "PLANNED", "NONE"]),
  sold: z.number(),
  remaining: z.number(),
  attributed: z.record(z.string(), z.number()),
  attributed_total: z.number(),
  discarded: z.number(),
  unaccounted: z.number(),
  carry_over_out: z.number(),
  complete: z.boolean(),
  cost_impact: z.number(),
  minor: z.boolean().optional(),
});
export type OutcomeAttributionRow = z.infer<typeof outcomeAttributionRowSchema>;

export const expiredCarryOverRowSchema = z.object({
  outcome_id: z.string().uuid(),
  item_id: z.string().uuid(),
  item_title: z.string(),
  state: z.string(),
  quantity: z.number(),
  unit: z.string(),
  stored_on: z.string(),
  expired_at: z.string().nullable(),
});
export type ExpiredCarryOverRow = z.infer<typeof expiredCarryOverRowSchema>;

export const branchDayOutcomesResponseSchema = z.object({
  items: z.array(outcomeAttributionRowSchema.omit({ minor: true })),
  expired_carry_over: z.array(expiredCarryOverRowSchema),
});
export type BranchDayOutcomesResponse = z.infer<
  typeof branchDayOutcomesResponseSchema
>;

export const attributeOutcomesPayloadSchema = z.object({
  item_id: z.string().uuid().optional(),
  entries: z
    .array(
      z.object({
        state: outcomeStateSchema,
        quantity: z.number(),
        discard_reason: discardReasonSchema.optional(),
        note: z.string().optional(),
        converted_to_item_id: z.string().uuid().optional(),
      }),
    )
    .optional(),
  stockout_confirmed: z.boolean().optional(),
  expired_resolution: z
    .object({
      outcome_id: z.string().uuid(),
      resolution: z.enum(["DISCARD", "USED", "STILL_GOOD"]),
    })
    .optional(),
});
export type AttributeOutcomesPayload = z.infer<
  typeof attributeOutcomesPayloadSchema
>;

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
    confidence_label: z.enum(["High", "Medium", "Low"]).optional(),
    expected_demand_delta_pct: z.number().optional(),
    typical_day_label: z.string().optional(),
    event_modifier_percentage: z.number(),
    weather_modifier_percentage: z.number().nullable(),
    signals: z
      .array(
        z.object({
          key: z.string(),
          label: z.string(),
          value_pct: z.number(),
          direction: z.enum(["up", "down", "neutral"]),
          explanation: z.string(),
          // Present when this signal maps to a learned per-branch pattern.
          learned: learnedResponseSchema.nullish(),
        }),
      )
      .optional(),
    // The branch's whole learned signal profile ("what this branch taught us").
    learned_patterns: z.array(learnedPatternSchema).optional(),
    high_risk_items: z.number().optional(),
    tracked_items: z.number().optional(),
    confidence_breakdown: z
      .object({
        data_coverage: z.number(),
        recent_accuracy: z.number(),
        demand_stability: z.number(),
        model_agreement: z.number(),
        limiting_factor: z.string(),
      })
      .optional(),
  }),
  morning_overview: z
    .object({
      tracked_items: z.number(),
      high_risk_items: z.number(),
      total_suggested_qty: z.number(),
      estimated_total_prep_cost: z.number(),
      projected_margin_total: z.number(),
      important_items_count: z.number().optional(),
      chef_accuracy_score: z
        .object({
          window_days: z.number(),
          chef_forecast_accuracy_pct: z.number(),
          better_than_ai_pct: z.number(),
          available: z.boolean(),
        })
        .optional(),
    })
    .optional(),
  kitchen_intelligence_network: z
    .object({
      organization_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      target_date: z.string(),
      lookback_days: z.number(),
      dataset_contract: z.object({
        required_fields: z.array(z.string()),
        derived_signals: z.array(z.string()),
      }),
      local_learning: z.object({
        location_id: z.string().uuid(),
        location_name: z.string(),
        rows: z.number(),
        sell_through_pct: z.number(),
        waste_ratio_pct: z.number(),
      }),
      network_aggregation: z.object({
        active_locations: z.number(),
        rows: z.number(),
        sell_through_pct: z.number(),
        waste_ratio_pct: z.number(),
        pattern_quality_threshold: z.number().optional(),
        validated_pattern_count: z.number().optional(),
        deployed_pattern_count: z.number().optional(),
        candidate_pattern_count: z.number().optional(),
        similarity_threshold: z.number().optional(),
        transfer_confidence_threshold: z.number().optional(),
        kitchen_similarity: z
          .array(
            z.object({
              location_id: z.string().uuid(),
              location_name: z.string(),
              similarity_score: z.number(),
              location_type: z.string(),
              components: z.object({
                menu_similarity: z.number(),
                climate_similarity: z.number(),
                location_type_similarity: z.number(),
                customer_volume_similarity: z.number(),
              }),
            }),
          )
          .optional(),
        detected_patterns: z
          .array(
            z.object({
              item_id: z.string().uuid(),
              item_name: z.string(),
              trigger_factor: z.string(),
              effect_pct: z.number(),
              local_effect_pct: z.number().nullable().optional(),
              confidence: z.number(),
              sample_size: z.number(),
              importance_score: z.number(),
              correlation: z.number(),
              quality_score: z.number(),
              is_validated: z.boolean(),
            }),
          )
          .optional(),
        cross_location_patterns: z.array(
          z.object({
            item_id: z.string().uuid(),
            item_name: z.string(),
            pattern_type: z.string(),
            confidence: z.number(),
            spread_pct: z.number(),
            best_location: z.object({
              location_id: z.string().uuid(),
              location_name: z.string(),
              waste_ratio_pct: z.number(),
              sell_through_pct: z.number(),
              sample_days: z.number(),
            }),
            worst_location: z.object({
              location_id: z.string().uuid(),
              location_name: z.string(),
              waste_ratio_pct: z.number(),
              sell_through_pct: z.number(),
              sample_days: z.number(),
            }),
          }),
        ),
      }),
      network_knowledge_graph: z
        .object({
          nodes: z.object({
            total: z.number(),
            kitchens: z.number(),
            menu_items: z.number(),
            patterns: z.number(),
            environment_factors: z.number(),
          }),
          edges: z.object({
            total: z.number(),
            sells: z.number(),
            affects: z.number(),
            triggered_by: z.number(),
            validated_in: z.number(),
          }),
        })
        .optional(),
      feedback_loop: z
        .object({
          patterns_total: z.number(),
          patterns_validated: z.number(),
          patterns_deployed: z.number().optional(),
          patterns_candidate: z.number().optional(),
          patterns_probation: z.number(),
          patterns_invalid: z.number(),
          average_freshness_score: z.number().optional(),
        })
        .optional(),
      knowledge_transfer: z.array(
        z.object({
          item_id: z.string().uuid(),
          item_name: z.string(),
          from_location: z.string(),
          suggested_action: z.string(),
          expected_waste_reduction_pct: z.number(),
          trigger_factor: z.string().optional(),
          pattern_quality_score: z.number().optional(),
          network_confidence: z.number().optional(),
          supporting_kitchens_count: z.number().optional(),
          supporting_kitchens: z
            .array(
              z.object({
                location_id: z.string().uuid(),
                location_name: z.string(),
                similarity_score: z.number(),
                effect_pct: z.number(),
                confidence: z.number(),
                sample_size: z.number(),
              }),
            )
            .optional(),
        }),
      ),
      event_rows_preview: z.array(
        z.object({
          location_id: z.string().uuid(),
          location_name: z.string(),
          timestamp: z.string(),
          menu_item_id: z.string().uuid(),
          menu_item_name: z.string(),
          quantity_sold: z.number(),
          quantity_prepped: z.number(),
          waste_quantity: z.number(),
          weather: z.string(),
          day_of_week: z.string(),
          special_event: z.boolean(),
          rain: z.boolean(),
          temperature: z.number().nullable(),
          holiday: z.boolean(),
          hour_of_day: z.number().nullable(),
        }),
      ),
    })
    .nullable()
    .optional(),
  prep_plan_items: z.array(prepPlanItemSchema),
  review_summary: z
    .object({
      total_revenue: z.string(),
      total_waste_cost: z.string(),
      stockout_count: z.number(),
      lost_revenue_estimate: z.string(),
      forecast_accuracy_percentage: z.number(),
      created_at: z.string(),
      updated_at: z.string(),
    })
    .nullable()
    .optional(),
  review_insights: z.array(z.string()).optional(),
  close_review: z
    .object({
      forecast_accuracy_report: z.object({
        ai_forecast_accuracy_percentage: z.number(),
        chef_plan_accuracy_percentage: z.number(),
        items_within_forecast_band: z.number(),
        items_over_forecast: z.number(),
        items_under_forecast: z.number(),
      }),
      chef_adjustment_intelligence: z.object({
        adjustments_made: z.number(),
        adjustments_supported_by_demand: z.number(),
        support_rate_percentage: z.number(),
        pattern_hint: z.string(),
        weekly_behavior_model: z
          .object({
            weekday: z.string(),
            bias_quantity: z.number(),
            unit: z.string(),
            direction: z.enum(["up", "down"]),
            support_rate_percentage: z.number(),
            sample_size: z.number(),
            hint: z.string(),
          })
          .nullable()
          .optional(),
      }),
      margin_protection_insight: z.object({
        headline: z.string(),
        waste_cost_saved_estimate: z.number(),
        loss_exposure_estimate: z.number(),
      }),
      learning_examples: z.array(
        z.object({
          item_title: z.string(),
          suggested_quantity: z.number(),
          planned_quantity: z.number(),
          actual_sold_quantity: z.number(),
          unit: z.string(),
        }),
      ),
      ml_learning_signals: z
        .object({
          rows: z.number(),
          chef_override_rows: z.number(),
          waste_rows: z.number(),
          stockout_rows: z.number(),
          chef_outperformed_forecast_rows: z.number(),
          training_dataset: z.array(
            z.object({
              item_id: z.string().uuid(),
              forecast_qty: z.number(),
              chef_plan_qty: z.number(),
              actual_sales_qty: z.number(),
              waste_qty: z.number(),
              stockout_flag: z.boolean(),
            }),
          ),
        })
        .optional(),
    })
    .nullable()
    .optional(),
  review_truth: z
    .object({
      snapshot: z.object({
        id: z.string().uuid(),
        branch_day: z.string().uuid(),
        date: z.string(),
        forecast_accuracy: z.number(),
        total_sales: z.string(),
        total_waste_cost: z.string(),
        stockout_count: z.number(),
        lost_revenue_estimate: z.string(),
        decision_support_rate: z.number(),
        estimated_net_impact: z.string(),
        tomorrow_playbook: z.array(z.string()),
        item_count: z.number(),
        created_at: z.string(),
      }),
      did_we_make_the_right_prep_decisions: z.object({
        answer: z.enum(["YES", "MIXED", "NO"]),
        message: z.string(),
        decision_support_rate_percentage: z.number(),
        forecast_accuracy_percentage: z.number(),
      }),
      how_much_money_did_we_lose_or_save: z.object({
        answer: z.enum(["SAVED", "LOST"]),
        message: z.string(),
        estimated_net_impact: z.number(),
        total_sales: z.number(),
        total_waste_cost: z.number(),
        lost_revenue_estimate: z.number(),
      }),
      what_should_we_do_differently_tomorrow: z.object({
        actions: z.array(z.string()),
      }),
    })
    .nullable()
    .optional(),
  review_item_snapshot: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        item_title: z.string(),
        planned_qty: z.number(),
        additional_qty: z.number(),
        actual_sales: z.number(),
        waste_qty: z.number(),
        stockout_flag: z.boolean(),
        forecast_qty: z.number(),
        forecast_error: z.number(),
        revenue: z.string(),
        waste_cost: z.string(),
        lost_revenue_estimate: z.string(),
        unit: z.string(),
        decision: z.string(),
      }),
    )
    .optional(),
  review_phase: z
    .object({
      daily_outcome: z.object({
        title: z.string(),
        date: z.string(),
        metrics: z.object({
          forecast_accuracy: z.object({
            value: z.number(),
            unit: z.enum(["PERCENT"]),
            comparison: z
              .object({
                delta: z.number(),
                delta_pct: z.number(),
                direction: z.enum(["up", "down", "flat"]),
              })
              .nullable(),
          }),
          waste_cost: z.object({
            value: z.number(),
            unit: z.enum(["CURRENCY"]),
            comparison: z
              .object({
                delta: z.number(),
                delta_pct: z.number(),
                direction: z.enum(["up", "down", "flat"]),
              })
              .nullable(),
          }),
          stockouts: z.object({
            value: z.number(),
            unit: z.enum(["COUNT"]),
            comparison: z
              .object({
                delta: z.number(),
                delta_pct: z.number(),
                direction: z.enum(["up", "down", "flat"]),
              })
              .nullable(),
          }),
          revenue_protected: z.object({
            value: z.number(),
            unit: z.enum(["CURRENCY"]),
            comparison: z.unknown().nullable().optional(),
          }),
          unaccounted: z
            .object({
              value: z.number(),
              unit: z.enum(["COUNT"]),
              comparison: z.unknown().nullable().optional(),
            })
            .optional(),
        }),
        demand_vs_production: z.array(
          z.object({
            item_id: z.string().uuid(),
            item_title: z.string(),
            unit: z.string(),
            planned_production: z.number(),
            actual_production: z.number(),
            actual_sales: z.number(),
            waste_qty: z.number(),
          }),
        ),
        waste_distribution: z.array(
          z.object({
            item_id: z.string().uuid(),
            item_title: z.string(),
            share_pct: z.number(),
            waste_qty: z.number(),
            waste_cost: z.number(),
          }),
        ),
        forecast_accuracy_trend: z.array(
          z.object({
            date: z.string(),
            accuracy: z.number(),
          }),
        ),
      }),
      key_insights: z.object({
        insights: z.array(z.string()),
      }),
      item_performance: z.object({
        rows: z.array(
          z.object({
            item_id: z.string().uuid(),
            item_title: z.string(),
            unit: z.string(),
            forecast: z.number(),
            prepared: z.number(),
            sold: z.number(),
            // waste = attributed discards only; the unsold remainder is
            // split into unaccounted / discarded / stored.
            waste: z.number(),
            remaining: z.number().optional(),
            unaccounted: z.number().optional(),
            discarded: z.number().optional(),
            stored: z.number().optional(),
            stockout: z.boolean(),
            impact: z.number(),
            lost_revenue_estimate: z.number(),
            decision: z.string(),
          }),
        ),
      }),
      learning_signals: z.object({
        ml_learning_signals: z
          .object({
            rows: z.number().optional(),
            chef_override_rows: z.number().optional(),
            waste_rows: z.number().optional(),
            stockout_rows: z.number().optional(),
            chef_outperformed_forecast_rows: z.number().optional(),
            training_dataset: z
              .array(
                z.object({
                  item_id: z.string().uuid(),
                  forecast_qty: z.number(),
                  chef_plan_qty: z.number(),
                  actual_sales_qty: z.number(),
                  waste_qty: z.number(),
                  stockout_flag: z.boolean(),
                }),
              )
              .optional(),
          })
          .optional(),
        training_rows: z.array(
          z.object({
            item_id: z.string().uuid(),
            item_title: z.string(),
            unit: z.string(),
            forecast_qty: z.number(),
            chef_planned_qty: z.number(),
            additional_qty: z.number(),
            actual_sales: z.number(),
            waste: z.number(),
            stockouts: z.boolean(),
            forecast_error: z.number(),
            chef_adjustment: z.number(),
            service_outcome: z.enum([
              "IMPROVED_BY_CHEF",
              "WORSE_THAN_FORECAST",
            ]),
          }),
        ),
        chef_behavior_learning: z.object({
          chef_adjustment_rate: z.number(),
          chef_accuracy_score: z.number(),
          chef_adjustments_improved_outcome_rate: z.number(),
        }),
        revenue_loss_signals: z.array(
          z.object({
            item_id: z.string().uuid(),
            item_title: z.string(),
            stockout_time: z.string(),
            sales_velocity_per_hour: z.number(),
            remaining_service_time_hours: z.number(),
            estimated_lost_sales: z.number(),
            estimated_lost_revenue: z.number(),
          }),
        ),
        tomorrow_actions: z.array(z.string()),
      }),
      tomorrow_early_signal: z.object({
        target_date: z.string(),
        expected_demand_change_pct: z.number(),
        pattern_detected: z.boolean(),
        message: z.string(),
        weekday: z.string().optional(),
        sample_size: z.number().optional(),
      }),
      // exceeds_threshold is decided server-side; the client never re-derives it.
      variance_review: z
        .object({
          forecast_total: z.number(),
          actual_total: z.number(),
          variance_ratio: z.number().nullable(),
          exceeds_threshold: z.boolean(),
          threshold: z.number(),
          cause: z.string(),
          cause_note: z.string(),
          cause_recorded_at: z.string().nullable(),
          suggested_cause: z
            .object({
              cause: z.string(),
              reason: z.string(),
            })
            .nullable()
            .optional(),
        })
        .optional(),
      outcome_attribution: z
        .object({
          rows: z.array(outcomeAttributionRowSchema),
          summary: z.object({
            items_with_remaining: z.number(),
            total_remaining: z.number(),
            attributed_remaining: z.number(),
            complete: z.boolean(),
          }),
        })
        .optional(),
      stockout_questions: z
        .array(
          z.object({
            item_id: z.string().uuid(),
            item_title: z.string(),
            unit: z.string(),
            prepared: z.number(),
            sold: z.number(),
          }),
        )
        .optional(),
      expired_carry_over: z.array(expiredCarryOverRowSchema).optional(),
    })
    .nullable()
    .optional(),
  plan_lock: z
    .object({
      is_locked: z.boolean(),
      locked_at: z.string().nullable(),
      locked_by: z
        .object({
          id: z.string().uuid().nullable().optional(),
          name: z.string().nullable().optional(),
        })
        .nullable(),
    })
    .optional(),
  live_alerts: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["STOCKOUT_RISK", "WASTE_RISK", "SALES_SPIKE"]),
        severity: z.enum(["MEDIUM", "HIGH", "CRITICAL"]),
        title: z.string(),
        product_title: z.string(),
        prep_plan_item_id: z.string().uuid(),
        message: z.string(),
        details: z.record(
          z.string(),
          z.union([z.string(), z.number(), z.boolean(), z.null()]),
        ),
        suggested_action: z.string(),
        suggested_prepare_qty: z.number(),
        advisory_kind: z
          .enum(["PREPARE_SOON", "SLOW_DOWN", "INFO"])
          .optional(),
        confidence: z.number().nullable().optional(),
        window_minutes: z.number().nullable().optional(),
      }),
    )
    .optional(),
  system_health: z
    .object({
      pos_connected: z.boolean(),
      last_sync_minutes_ago: z.number().nullable(),
      data_gap_active: z.boolean(),
      data_gap_minutes: z.number().nullable(),
      readiness: z.enum(["GREEN", "YELLOW", "RED"]),
      note: z.string(),
    })
    .optional(),
  ingredient_requirement: ingredientRequirementSchema.nullable().optional(),
  session_notes: z.string().optional(),
  day_reaction: z.enum(["FIRED_UP", "GOOD", "MEH", "ROUGH", ""]).optional(),
  created_at: z.string(),
  meta: z
    .object({
      created_branch_day: z.boolean(),
      created_prep_plan_items: z.number(),
      pipeline_stats: pipelineStatsSchema.nullable().optional(),
    })
    .optional(),
});
export type BranchDayToday = z.infer<typeof branchDayTodaySchema>;

export const branchDayStatusUpdatePayloadSchema = z.object({
  status: z.enum(["MORNING", "LIVE", "CLOSED"]),
});
export type BranchDayStatusUpdatePayload = z.infer<
  typeof branchDayStatusUpdatePayloadSchema
>;

export const branchDayPlanLockPayloadSchema = z.object({});
export type BranchDayPlanLockPayload = z.infer<
  typeof branchDayPlanLockPayloadSchema
>;

export const branchDayLiveAlertIgnorePayloadSchema = z.object({
  prep_plan_item_id: z.string().uuid(),
  alert_type: z.enum(["STOCKOUT_RISK", "WASTE_RISK", "SALES_SPIKE"]),
  cooldown_minutes: z.number().min(5).max(180).optional(),
});
export type BranchDayLiveAlertIgnorePayload = z.infer<
  typeof branchDayLiveAlertIgnorePayloadSchema
>;

export const branchDayLiveAlertIgnoreResponseSchema = z.object({
  updated: z.boolean(),
  risk_event_id: z.string().uuid().optional(),
  ignored_until: z.string().optional(),
  detail: z.string().optional(),
});
export type BranchDayLiveAlertIgnoreResponse = z.infer<
  typeof branchDayLiveAlertIgnoreResponseSchema
>;

export const prepPlanEvaluatePayloadSchema = z.object({
  prep_plan_item_id: z.string().uuid(),
  planned_quantity: z.number().min(0),
});
export type PrepPlanEvaluatePayload = z.infer<
  typeof prepPlanEvaluatePayloadSchema
>;

export const prepPlanEvaluateResponseSchema = z.object({
  delta_quantity: z.number(),
  waste_risk_increase: z.number(),
  marginal_cost_risk: z.number(),
  stockout_risk_change: z.number(),
  sell_through_probability: z.number(),
  estimated_extra_margin_if_sold: z.number(),
  potential_unsold_loss: z.number(),
  margin_impact_estimate: z.number(),
  deviation: z.number(),
  deviation_threshold: z.number(),
  impact_simulation_triggered: z.boolean(),
  impact_simulation: z.object({
    suggested_qty: z.number(),
    waste_probability_change: z.number(),
    stockout_probability_change: z.number(),
    margin_savings: z.number(),
  }),
});
export type PrepPlanEvaluateResponse = z.infer<
  typeof prepPlanEvaluateResponseSchema
>;

export const overrideReasonSchema = z.enum([
  "LARGE_BOOKING",
  "EVENT",
  "WEATHER",
  "EXPERIENCE",
  "HOLIDAY",
  "OTHER",
]);
export type OverrideReason = z.infer<typeof overrideReasonSchema>;

export const updatePrepPlanItemPayloadSchema = z.object({
  planned_quantity: z.number().min(0).optional(),
  accepted_suggestion: z.boolean().optional(),
  override_reason: z.union([overrideReasonSchema, z.literal("")]).optional(),
  override_reason_note: z.string().optional(),
});
export type UpdatePrepPlanItemPayload = z.infer<
  typeof updatePrepPlanItemPayloadSchema
>;

export const createProductionLogPayloadSchema = z.object({
  prep_plan_item_id: z.string().uuid(),
  quantity_produced: z.number().min(0).optional(),
  waste_quantity: z.number().min(0).optional(),
  event_type: z.enum(["planned", "additional"]).optional(),
  waste_reason: z
    .enum([
      "OVER_PREP",
      "DEMAND_FLUCTUATION",
      "CHEF_OVERRIDE",
      "INVENTORY_EXPIRY",
      "OTHER",
      "UNSPECIFIED",
    ])
    .optional(),
  reason: z.string().max(120).optional(),
});
export type CreateProductionLogPayload = z.infer<
  typeof createProductionLogPayloadSchema
>;

export const salesManualQuickEntryPayloadSchema = z.object({
  branch_id: z.string().uuid(),
  target_date: z.string().optional(),
  items: z.array(
    z.object({
      item_id: z.string().uuid(),
      quantity_sold: z.number(),
      unit: z.string().optional(),
      gross_revenue: z.number().optional(),
      notes: z.string().optional(),
    }),
  ),
});
export type SalesManualQuickEntryPayload = z.infer<
  typeof salesManualQuickEntryPayloadSchema
>;

export const salesManualQuickEntryResponseSchema = z.object({
  created: z.number(),
  updated: z.number(),
  failed: z.number(),
  errors: z.array(z.string()),
  target_date: z.string(),
  branch_id: z.string().uuid(),
  live_monitor_by_item: z.record(z.string(), liveMonitorSchema).optional(),
});
export type SalesManualQuickEntryResponse = z.infer<
  typeof salesManualQuickEntryResponseSchema
>;

export const productionLogSchema = z.object({
  id: z.string().uuid(),
  prep_plan_item_id: z.string().uuid(),
  quantity_produced: z.number(),
  waste_quantity: z.number(),
  created_by: z.union([z.string().uuid(), z.null()]),
  created_at: z.string(),
  live_monitor: liveMonitorSchema.optional(),
});
export type ProductionLog = z.infer<typeof productionLogSchema>;

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

export const currencyAmountSchema = z.object({
  currency: z.string(),
  amount: z.number(),
  amount_usd: z.number().optional(),
});

export const executiveControlTowerBranchSchema = z.object({
  branch_id: z.string().uuid(),
  branch_name: z.string(),
  currency: z.string().optional(),
  revenue: z.number().optional(),
  revenue_usd: z.number().optional(),
  prepared: z.number().optional(),
  sold: z.number().optional(),
  remaining: z.number().optional(),
  waste_pct: z.number().optional(),
  surplus_pct: z.number().optional(),
  staff_activity_status: z.string().optional(),
  compliance_badge: z.string().optional(),
  day_status: z.string().nullable().optional(),
  plan_locked: z.boolean().default(false).optional(),
  forecast_confidence: z.number().nullable().optional(),
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
    // Summary currency: the shared branch currency, or USD when the fleet is
    // multi-currency (money is converted before summing).
    currency: z.string().optional(),
    is_multi_currency: z.boolean().optional(),
    revenue_by_currency: z.array(currencyAmountSchema).optional(),
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
  currency: z.string().optional(),
  margin_signal_status: z.string().optional(),
  margin_deviation_pct: z.number().optional(),
  total_waste_cost: z.string(),
  total_waste_cost_usd: z.string().optional(),
  money_protected_vs_baseline: z.string().optional(),
  forecast_accuracy_summary: z.number().optional(),
});

export const ownerMarginProtectionReportSchema = z.object({
  target_date: z.string(),
  branch_count: z.number(),
  summary: z.object({
    total_waste_cost: z.string(),
    total_money_protected_vs_baseline: z.string(),
    currency: z.string().optional(),
    is_multi_currency: z.boolean().optional(),
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

export const ownerNetworkIntelligenceInsightSchema = z.object({
  insight_key: z.string(),
  title: z.string(),
  observed_in_kitchens: z.number(),
  confidence: z.number(),
  effect_pct: z.number(),
  lifecycle_state: z.enum(["CANDIDATE", "VALIDATED", "DEPLOYED"]),
  suggested_action: z.string(),
});

export const ownerNetworkIntelligenceInsightsSchema = z.object({
  organization_id: z.string().uuid(),
  target_date: z.string(),
  lookback_days: z.number(),
  summary: z.object({
    branch_count: z.number(),
    patterns_total: z.number(),
    candidate_patterns: z.number(),
    validated_patterns: z.number(),
    deployed_patterns: z.number(),
    average_freshness_score: z.number(),
  }),
  top_network_insights: z.array(ownerNetworkIntelligenceInsightSchema),
  location_performance: z.array(
    z.object({
      branch_id: z.string().uuid(),
      branch_name: z.string(),
      forecast_accuracy: z.number(),
      waste_cost: z.number(),
      stockout_count: z.number(),
      net_impact: z.number(),
    }),
  ),
  shared_patterns: z.array(
    z.object({
      item_id: z.string().uuid(),
      item_name: z.string(),
      trigger_factor: z.string(),
      observed_in_kitchens: z.number(),
      effect_pct: z.number(),
      confidence: z.number(),
      quality_score: z.number(),
      freshness_score: z.number(),
      lifecycle_state: z.enum(["CANDIDATE", "VALIDATED", "DEPLOYED"]),
    }),
  ),
});
export type OwnerNetworkIntelligenceInsights = z.infer<
  typeof ownerNetworkIntelligenceInsightsSchema
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
  sales_source_connected: z.boolean().optional(),
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
  recommended_setup_route: z.string().optional(),
  margin_protection: z.record(z.string(), z.unknown()),
});
export type SalesDataValidation = z.infer<typeof salesDataValidationSchema>;

export const setupForecastWOWSchema = z.object({
  branch_name: z.string(),
  lookback_days: z.number(),
  first_real_insight: z.object({
    item_title: z.string(),
    forecast_quantity: z.number(),
    prepared_quantity: z.number(),
    sold_quantity: z.number(),
    waste_cost: z.number(),
  }),
  performance: z.object({
    top_items: z.array(
      z.object({
        item_id: z.string(),
        item_title: z.string(),
        unit: z.string(),
        trend_percentage: z.number(),
        projected_quantity_next_weeks: z.array(z.number()),
        last_28d_revenue: z.number(),
      }),
    ),
  }),
  next_3_weeks_forecast: z.array(
    z.object({
      week_index: z.number(),
      start_date: z.string(),
      end_date: z.string(),
      projected_quantity: z.number(),
      projected_revenue: z.number(),
    }),
  ),
  money_leakage: z.object({
    waste_cost_30d: z.number(),
    refund_leakage_30d: z.number(),
    potential_savings_21d: z.number(),
    projected_revenue_21d: z.number(),
  }),
  playbook: z.array(z.string()),
});
export type SetupForecastWOW = z.infer<typeof setupForecastWOWSchema>;

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

// ─────────────────────────────────────────────────────────────────────────────
// Toast OAuth
// ─────────────────────────────────────────────────────────────────────────────
export const toastOAuthStartPayloadSchema = z.object({
  branch_id: z.string().uuid(),
  client_id: z.string(),
  client_secret: z.string(),
  restaurant_external_id: z.string().optional(),
});
export type ToastOAuthStartPayload = z.infer<
  typeof toastOAuthStartPayloadSchema
>;

export const toastOAuthStartResponseSchema = z.object({
  status: z.string(),
  connection_id: z.string(),
  branch_id: z.string(),
  organization_id: z.string(),
  restaurant_guid: z.string(),
  restaurant_name: z.string(),
  token_expires_in: z.number(),
});
export type ToastOAuthStartResponse = z.infer<
  typeof toastOAuthStartResponseSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Loyverse OAuth
// ─────────────────────────────────────────────────────────────────────────────
export const loyverseOAuthStartPayloadSchema = z.object({
  branch_id: z.string().uuid(),
  post_connect_redirect: z.string().url().optional(),
});
export type LoyverseOAuthStartPayload = z.infer<
  typeof loyverseOAuthStartPayloadSchema
>;

export const loyverseOAuthStartResponseSchema = z.object({
  authorize_url: z.string().url(),
  state_expires_in_seconds: z.number(),
});
export type LoyverseOAuthStartResponse = z.infer<
  typeof loyverseOAuthStartResponseSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Clover OAuth
// ─────────────────────────────────────────────────────────────────────────────
export const cloverOAuthStartPayloadSchema = z.object({
  branch_id: z.string().uuid(),
  post_connect_redirect: z.string().url().optional(),
});
export type CloverOAuthStartPayload = z.infer<
  typeof cloverOAuthStartPayloadSchema
>;

export const cloverOAuthStartResponseSchema = z.object({
  authorize_url: z.string().url(),
  state_expires_in_seconds: z.number(),
});
export type CloverOAuthStartResponse = z.infer<
  typeof cloverOAuthStartResponseSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// CSV Import
// ─────────────────────────────────────────────────────────────────────────────
export const posCSVPreviewRowSchema = z
  .object({
    line_number: z.number(),
    action: z.string(),
    sale_date: z.string(),
    item_id: z.string().nullable().optional(),
    item_title: z.string().optional(),
    quantity: z.number().optional(),
    quantity_sold: z.number().optional(),
    unit: z.string().optional(),
    external_sale_ref: z.string().optional(),
  })
  .passthrough();
export type POSCSVPreviewRow = z.infer<typeof posCSVPreviewRowSchema>;

export const posCSVDetectedItemSchema = z
  .object({
    item_id: z.string(),
    item_title: z.string(),
    unit: z.string(),
    action: z.string(),
    line_count: z.number(),
    line_numbers: z.array(z.number()),
    total_quantity: z.number(),
    total_revenue: z.string(),
    suggested_selling_price: z.string().nullable().optional(),
    suggested_cost_per_unit: z.string().nullable().optional(),
    category: z.string().optional(),
  })
  .passthrough();
export type POSCSVDetectedItem = z.infer<typeof posCSVDetectedItemSchema>;

export const posCSVPreviewResponseSchema = z
  .object({
    dry_run: z.literal(true),
    branch_id: z.string().uuid(),
    source: z.string(),
    auto_create_items: z.boolean(),
    total_rows: z.number(),
    valid_rows: z.number(),
    failed_rows: z.number(),
    would_create: z.number(),
    would_update: z.number(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    detected_items: z.array(posCSVDetectedItemSchema),
    preview_rows: z.array(posCSVPreviewRowSchema),
    preview_limit: z.number(),
    column_mapping: z.record(z.string(), z.string()).optional(),
    mapping_source: z.string().optional(),
    mapping_profile_applied: z.boolean().optional(),
  })
  .passthrough();
export type POSCSVPreviewResponse = z.infer<typeof posCSVPreviewResponseSchema>;

export const posCSVImportResponseSchema = z
  .object({
    branch_id: z.string().uuid(),
    source: z.string(),
    auto_create_items: z.boolean(),
    created: z.number(),
    updated: z.number(),
    failed: z.number(),
    errors: z.array(z.string()),
    auto_created_items: z.number().optional(),
    detected_items: z.array(posCSVDetectedItemSchema).optional(),
    column_mapping: z.record(z.string(), z.string()).optional(),
    mapping_source: z.string().optional(),
    mapping_profile_applied: z.boolean().optional(),
    mapping_profile_saved: z.boolean().optional(),
    mapping_profile_id: z.string().optional(),
    csv_tracking: z
      .object({
        last_upload_attempt_at: z.string().optional(),
        total_upload_attempts: z.number().optional(),
        total_successful_uploads: z.number().optional(),
        successful_upload_days: z.number().optional(),
        days_without_upload: z.number().optional(),
      })
      .optional(),
  })
  .passthrough();
export type POSCSVImportResponse = z.infer<typeof posCSVImportResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Integrations Overview
// ─────────────────────────────────────────────────────────────────────────────
export const integrationsOverviewBranchSchema = z.object({
  branch_id: z.string().uuid(),
  branch_name: z.string(),
  status: z.string(),
  last_sync: z.string().nullable(),
});

export const integrationsOverviewSchema = z.object({
  organization_id: z.string().uuid(),
  summary: z.object({
    total_branches: z.number(),
    active_connections: z.number(),
    health_pct: z.number(),
  }),
  branches: z.array(integrationsOverviewBranchSchema),
});
export type IntegrationsOverview = z.infer<typeof integrationsOverviewSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Staff Accountability Overview
// ─────────────────────────────────────────────────────────────────────────────
export const staffAccountabilityMemberSchema = z.object({
  user_id: z.string().uuid(),
  user_name: z.string(),
  chef_profit_score: z.number(),
  adherence_score: z.number(),
  batches_prepared: z.number(),
});

export const staffAccountabilityOverviewSchema = z.object({
  branch_id: z.string().uuid(),
  target_date: z.string(),
  staff_metrics: z.array(staffAccountabilityMemberSchema),
  avg_branch_score: z.number(),
});
export type StaffAccountabilityOverview = z.infer<
  typeof staffAccountabilityOverviewSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// Advanced Forecast Intelligence
// ─────────────────────────────────────────────────────────────────────────────
export const forecastScenarioSchema = z.object({
  name: z.string().optional(),
  scenario: z.string().optional(),
  forecast: z.number().optional(),
  change_pct: z.number().optional(),
  description: z.string().optional(),
});

export const advancedForecastResponseSchema = z.object({
  branch_id: z.string().optional(),
  item_id: z.string().optional(),
  target_date: z.string().optional(),
  ensemble_forecast: z.number().optional(),
  confidence: z.number().optional(),
  confidence_label: z.string().optional(),
  scenarios: z.array(forecastScenarioSchema).optional(),
  chef_weight: z.number().optional(),
  chef_recommendation: z.string().optional(),
  loss_optimized_qty: z.number().optional(),
  base_predictions: z.record(z.string(), z.number().nullable()).optional(),
  model_agreement: z.number().optional(),
  quality_issues: z.array(z.string()).optional(),
  confidence_components: z.record(z.string(), z.unknown()).optional(),
});
export type AdvancedForecastResponse = z.infer<
  typeof advancedForecastResponseSchema
>;

export const forecastScenariosResponseSchema = z.object({
  base_forecast: z.number().nullable().optional(),
  scenarios: z.array(forecastScenarioSchema),
});
export type ForecastScenariosResponse = z.infer<
  typeof forecastScenariosResponseSchema
>;

export const forecastConfidenceResponseSchema = z.object({
  overall_confidence: z.number().nullable().optional(),
  confidence_label: z.string().optional(),
  components: z.record(z.string(), z.unknown()).optional(),
});
export type ForecastConfidenceResponse = z.infer<
  typeof forecastConfidenceResponseSchema
>;

export const forecastMetricsResponseSchema = z.object({
  mape: z.number().nullable().optional(),
  rmse: z.number().nullable().optional(),
  forecast_accuracy: z.number().nullable().optional(),
  stockout_rate: z.number().nullable().optional(),
  waste_rate: z.number().nullable().optional(),
  confidence_calibration: z.record(z.string(), z.unknown()).optional(),
  summary: z.string().optional(),
  trend: z
    .object({
      weekly_mapes: z.array(z.number()).optional(),
      trend: z.string().optional(),
      latest_mape: z.number().nullable().optional(),
    })
    .optional(),
  data_points: z.number().optional(),
});
export type ForecastMetricsResponse = z.infer<
  typeof forecastMetricsResponseSchema
>;

export const chefSkillScoreResponseSchema = z.object({
  overall_skill_score: z.number().nullable().optional(),
  accuracy_component: z.number().nullable().optional(),
  profit_component: z.number().nullable().optional(),
  waste_component: z.number().nullable().optional(),
  recommendation: z.string().optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
});
export type ChefSkillScoreResponse = z.infer<
  typeof chefSkillScoreResponseSchema
>;

export const dataQualityReportSchema = z.object({
  overall_quality_score: z.number().nullable().optional(),
  quality_label: z.string().optional(),
  checks: z.array(z.record(z.string(), z.unknown())).optional(),
  recommendation: z.string().optional(),
  passed_checks: z.number().optional(),
  total_checks: z.number().optional(),
  is_training_safe: z.boolean().optional(),
});
export type DataQualityReport = z.infer<typeof dataQualityReportSchema>;

export const velocitySnapshotSchema = z.object({
  velocity_units_per_hour: z.number().optional(),
  velocity_units_per_minute: z.number().optional(),
  total_units: z.number().optional(),
  time_span_minutes: z.number().optional(),
  sample_count: z.number().optional(),
});

export const velocityComparisonSchema = z.object({
  velocity_ratio: z.number().optional(),
  status: z.string().optional(),
  deviation_pct: z.number().optional(),
  alert_level: z.string().optional(),
  recommendation: z.string().optional(),
  actual_velocity_per_hour: z.number().optional(),
  forecast_velocity_per_hour: z.number().optional(),
});

// Cumulative intraday position: actuals vs the historical hour-of-day CDF
// ("at 1:30pm we're normally at 62% of the day; today we're at 78%").
export const cumulativePositionSchema = z.object({
  expected_fraction: z.number(),
  expected_qty_by_now: z.number(),
  sold_so_far: z.number(),
  cumulative_ratio: z.number(),
  projected_total_at_close: z.number(),
  projected_gap_units: z.number(),
  status: z.enum(["SURGE", "SLOWDOWN", "ON_PACE"]),
  alert_level: z.enum(["NONE", "WARNING", "CRITICAL"]),
});
export type CumulativePosition = z.infer<typeof cumulativePositionSchema>;

export const velocityUpdateResponseSchema = z.object({
  sales_velocity: velocitySnapshotSchema.nullable().optional(),
  forecast_velocity: z
    .object({
      forecast_velocity_per_hour: z.number().optional(),
      forecast_velocity_per_minute: z.number().optional(),
      daily_forecast: z.number().optional(),
      business_hours: z.number().optional(),
    })
    .nullable()
    .optional(),
  comparison: velocityComparisonSchema.optional(),
  cumulative_position: cumulativePositionSchema.nullable().optional(),
  should_alert: z.boolean().optional(),
  alert_reason: z.string().optional(),
  forecast_qty: z.number().optional(),
  window_minutes: z.number().optional(),
});
export type VelocityUpdateResponse = z.infer<
  typeof velocityUpdateResponseSchema
>;

export const branchPaceSummarySchema = z.object({
  as_of: z.string(),
  date: z.string(),
  branch: cumulativePositionSchema
    .omit({ projected_gap_units: true })
    .extend({
      forecast_total: z.number(),
      projected_gap_units: z.number(),
    })
    .nullable(),
  items: z.array(
    z.object({
      item_id: z.string(),
      item_title: z.string(),
      unit: z.string(),
      forecast_qty: z.number(),
      sold_so_far: z.number(),
      cumulative_position: cumulativePositionSchema.nullable(),
      should_alert: z.boolean(),
      alert_reason: z.string(),
    }),
  ),
});
export type BranchPaceSummary = z.infer<typeof branchPaceSummarySchema>;

export const branchDayVersionSchema = z.object({
  version: z.number(),
});
export type BranchDayVersion = z.infer<typeof branchDayVersionSchema>;

// Per-dish intraday series for the live timeline: cumulative sold vs the
// expected pace curve, with production batches as steps. Read-only —
// situational awareness, never commands.
export const intradayTimelineItemSchema = z.object({
  item_id: z.string(),
  item_title: z.string(),
  unit: z.string(),
  forecast_qty: z.number(),
  planned_qty: z.number().nullable(),
  prepared_qty: z.number(),
  sold_so_far: z.number(),
  pace_status: z.string().nullable().optional(),
  projected_total_at_close: z.number().nullable().optional(),
  sold_series: z.array(z.object({ hour: z.number(), cumulative: z.number() })),
  expected_series: z.array(
    z.object({ hour: z.number(), cumulative: z.number() }),
  ),
  production_steps: z.array(
    z.object({
      hour: z.number(),
      quantity: z.number(),
      event_type: z.string(),
    }),
  ),
});
export type IntradayTimelineItem = z.infer<typeof intradayTimelineItemSchema>;

export const intradayTimelineSchema = z.object({
  as_of: z.string(),
  date: z.string(),
  current_hour: z.number(),
  items: z.array(intradayTimelineItemSchema),
});
export type IntradayTimeline = z.infer<typeof intradayTimelineSchema>;

export const morningBriefSchema = z.object({
  branch_id: z.string(),
  target_date: z.string(),
  headline: z.string(),
  narrative: z.string(),
  watchouts: z.array(z.string()).catch([]),
  generated_by: z.enum(["llm", "template"]).catch("template"),
  drivers: z
    .object({
      target_date: z.string().optional(),
      total_recommended_quantity: z.number().optional(),
      item_count: z.number().optional(),
      top_movers: z
        .array(
          z.object({
            item_id: z.string(),
            item_title: z.string(),
            recommended_quantity: z.number(),
            unit: z.string(),
            delta_vs_forecast_pct: z.number().nullable(),
            confidence: z.number(),
          }),
        )
        .optional(),
      signals: z
        .object({
          is_rain: z.boolean().optional(),
          weather_condition: z.string().optional(),
          temperature_bucket: z.string().optional(),
          special_event: z.boolean().optional(),
          public_holiday: z.boolean().optional(),
          expected_traffic_multiplier: z.number().optional(),
          is_religious_observance: z.boolean().optional(),
          religious_observance_name: z.string().optional(),
          sports_event: z.boolean().optional(),
          sports_event_name: z.string().optional(),
          sports_match_importance: z.number().optional(),
          is_payday: z.boolean().optional(),
        })
        .optional(),
      // Signals that actually fired today + the branch's learned profile.
      active_signals: z.array(activeSignalSchema).optional(),
      learned_patterns: z.array(learnedPatternSchema).optional(),
    })
    .nullable(),
  prep_sheet: z
    .array(
      z.object({
        ingredient_id: z.string(),
        ingredient_name: z.string(),
        category: z.string(),
        unit: z.string(),
        total_quantity: z.number(),
        is_perishable: z.boolean(),
        items: z.array(
          z.object({ menu_item: z.string(), quantity: z.number() }),
        ),
      }),
    )
    .catch([]),
  updated_at: z.string(),
});
export type MorningBrief = z.infer<typeof morningBriefSchema>;

export const advancedForecastPayloadSchema = z.object({
  branch_id: z.string().uuid(),
  item_id: z.string().uuid(),
  target_date: z.string().optional(),
});
export type AdvancedForecastPayload = z.infer<
  typeof advancedForecastPayloadSchema
>;

export const forecastScenariosQuerySchema = z.object({
  branch_id: z.string().uuid(),
  item_id: z.string().uuid(),
  target_date: z.string().optional(),
});
export type ForecastScenariosQuery = z.infer<
  typeof forecastScenariosQuerySchema
>;

export const forecastConfidenceQuerySchema = z.object({
  branch_id: z.string().uuid(),
  item_id: z.string().uuid(),
  target_date: z.string().optional(),
});
export type ForecastConfidenceQuery = z.infer<
  typeof forecastConfidenceQuerySchema
>;

export const forecastMetricsQuerySchema = z.object({
  branch_id: z.string().uuid(),
  item_id: z.string().uuid().optional(),
  lookback_days: z.number().optional(),
});
export type ForecastMetricsQuery = z.infer<typeof forecastMetricsQuerySchema>;

export const chefSkillScoreQuerySchema = z.object({
  user_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  days_window: z.number().optional(),
});
export type ChefSkillScoreQuery = z.infer<typeof chefSkillScoreQuerySchema>;

export const dataQualityReportQuerySchema = z.object({
  branch_id: z.string().uuid(),
  days_window: z.number().optional(),
});
export type DataQualityReportQuery = z.infer<
  typeof dataQualityReportQuerySchema
>;

export const velocityUpdatePayloadSchema = z.object({
  branch_id: z.string().uuid(),
  item_id: z.string().uuid(),
  sales_qty: z.number().optional(),
  timestamp: z.string().optional(),
  window_minutes: z.number().optional(),
});
export type VelocityUpdatePayload = z.infer<typeof velocityUpdatePayloadSchema>;

export const salesWasteTopItemSchema = z.object({
  item_id: z.string(),
  item_title: z.string().nullable(),
  revenue: z.number().optional(),
  units_sold: z.number().optional(),
});

export const salesWasteTopWasteItemSchema = z.object({
  item_id: z.string(),
  item_title: z.string().nullable(),
  units_wasted: z.number(),
  waste_value: z.number(),
});

export const salesWastePeriodSummarySchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  total_orders: z.number(),
  revenue: z.number(),
  avg_order_value: z.number(),
  top_item: salesWasteTopItemSchema.nullable(),
  waste_summary: z.object({
    total_waste_value: z.number(),
    waste_rate_pct: z.number(),
    top_waste_item: salesWasteTopWasteItemSchema.nullable(),
    total_unaccounted_units: z.number().optional(),
    total_stored_units: z.number().optional(),
  }),
});

export const salesWasteItemRowSchema = z.object({
  item_id: z.string(),
  item_title: z.string().nullable(),
  unit: z.string(),
  forecasted: z.number(),
  produced: z.number(),
  sold: z.number(),
  // waste = attributed discards; remaining is split into unaccounted/stored.
  waste: z.number(),
  remaining: z.number().optional(),
  unaccounted: z.number().optional(),
  stored: z.number().optional(),
  revenue: z.number(),
  food_cost: z.number(),
  waste_cost: z.number(),
  over_prep: z.number(),
  under_prep: z.number(),
  lost_revenue: z.number(),
  margin_impact: z.number(),
  margin_pct: z.number(),
});

export const salesWasteTrendSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  food_cost: z.number(),
  waste_cost: z.number(),
  margin: z.number(),
});

export const salesWasteItemTrendSchema = z.object({
  date: z.string(),
  sold: z.number(),
  revenue: z.number(),
  waste: z.number(),
  waste_cost: z.number(),
  waste_rate_pct: z.number(),
});

export const salesWasteForecastImpactSchema = z.object({
  forecast_accuracy: z.number(),
  waste_avoided: z.number(),
  stockout_events: z.number(),
  stockouts_prevented: z.number().nullable(),
});

export const salesWasteDriverSchema = z.object({
  label: z.string(),
  cost: z.number(),
  pct: z.number(),
});

export const salesWasteDriversSummarySchema = z.object({
  total_waste_cost: z.number(),
  drivers: z.array(salesWasteDriverSchema),
  data_note: z.string().optional(),
});

export const salesWasteOpportunityInsightSchema = z.object({
  item_id: z.string().nullable().optional(),
  item_title: z.string().nullable().optional(),
  waste_rate_pct: z.number(),
  suggested_action: z.string(),
  potential_savings: z.number(),
});

export const salesWasteNetworkInsightSchema = z.object({
  available: z.boolean(),
  message: z.string().optional(),
  avg_waste_rate_pct: z.number().optional(),
  top_waste_items: z
    .array(
      z.object({
        item_id: z.string().nullable(),
        item_title: z.string().nullable(),
        waste_cost: z.number(),
      }),
    )
    .optional(),
});

export const salesWasteReportSchema = z.object({
  branch_id: z.string(),
  branch_name: z.string(),
  period: z.string(),
  period_start_date: z.string(),
  period_end_date: z.string(),
  item_id: z.string().nullable().optional(),
  summaries: z.object({
    today: salesWastePeriodSummarySchema,
    week: salesWastePeriodSummarySchema,
    month: salesWastePeriodSummarySchema,
  }),
  totals: z.object({
    total_orders: z.number(),
    revenue: z.number(),
    avg_order_value: z.number(),
    food_cost: z.number(),
    food_cost_ratio: z.number(),
    waste_cost: z.number(),
    waste_rate_pct: z.number(),
    efficiency_ratio: z.number(),
    over_prep_qty: z.number(),
    under_prep_qty: z.number(),
    lost_revenue: z.number(),
  }),
  items: z.array(salesWasteItemRowSchema),
  trends: z.array(salesWasteTrendSchema),
  item_trends: z.array(salesWasteItemTrendSchema),
  forecast_impact: salesWasteForecastImpactSchema,
  waste_drivers: salesWasteDriversSummarySchema,
  opportunity_insights: z.array(salesWasteOpportunityInsightSchema),
  network_insights: salesWasteNetworkInsightSchema.nullable(),
});

export type SalesWasteReport = z.infer<typeof salesWasteReportSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Risk Snapshot
// ─────────────────────────────────────────────────────────────────────────────
export const riskScoreBreakdownSchema = z.object({
  demand_volatility: z.number(),
  stock_risk: z.number(),
  waste_risk: z.number(),
  supply_risk: z.number(),
});

export const riskScoreSchema = z.object({
  level: z.enum(["LOW", "MODERATE", "HIGH"]),
  score: z.number(),
  breakdown: riskScoreBreakdownSchema,
});

export const stockoutForecastItemSchema = z.object({
  item_id: z.string(),
  item_title: z.string(),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
  probability_pct: z.number(),
  reasons: z.array(z.string()),
  suggested_action: z.string(),
});

export const wasteRiskForecastItemSchema = z.object({
  item_id: z.string(),
  item_title: z.string(),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
  projected_excess: z.number(),
  drivers: z.array(z.string()),
  suggested_action: z.string(),
});

export const supplyRiskItemSchema = z.object({
  item_id: z.string(),
  item_title: z.string(),
  unit: z.string(),
  current_stock: z.number(),
  expected_depletion_days: z.number(),
  supplier_lead_time_days: z.number(),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
  suggested_action: z.string(),
});

export const supplyRiskSchema = z.object({
  items: z.array(supplyRiskItemSchema),
  data_note: z.string().optional(),
});

export const demandVolatilityItemSchema = z.object({
  item_id: z.string(),
  item_title: z.string(),
  volatility_pct: z.number(),
  forecast_confidence: z.string(),
  recent_pattern: z.string(),
});

export const networkRiskAlertSchema = z.object({
  item_id: z.string(),
  item_title: z.string().nullable().optional(),
  locations_affected: z.number(),
  avg_waste_rate_change_pct: z.number(),
  suggested_action: z.string(),
});

export const networkRiskSchema = z.object({
  available: z.boolean(),
  message: z.string().optional(),
  alerts: z.array(networkRiskAlertSchema).optional(),
});

export const operationalAlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  detail: z.string(),
  suggested_action: z.string(),
});

export const riskTrendPointSchema = z.object({
  date: z.string(),
  score: z.number(),
});

export const riskSnapshotSchema = z.object({
  branch_id: z.string(),
  branch_name: z.string(),
  target_date: z.string(),
  risk_score: riskScoreSchema,
  stockout_forecast: z.array(stockoutForecastItemSchema),
  waste_risk_forecast: z.array(wasteRiskForecastItemSchema),
  supply_risk: supplyRiskSchema,
  demand_volatility: z.array(demandVolatilityItemSchema),
  network_risk: networkRiskSchema.nullable(),
  operational_alerts: z.array(operationalAlertSchema),
  risk_trend: z.array(riskTrendPointSchema),
});

export type RiskSnapshot = z.infer<typeof riskSnapshotSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// History Snapshot
// ─────────────────────────────────────────────────────────────────────────────
export const historyTimelineEntrySchema = z.object({
  date: z.string(),
  status: z.enum(["MORNING", "LIVE", "CLOSED"]),
  forecast_accuracy: z.number(),
  waste_cost: z.number(),
  stockout_count: z.number(),
  revenue: z.number(),
  has_snapshot: z.boolean(),
  day_reaction: z.string().optional(),
  session_notes: z.string().optional(),
});

export const historySummarySchema = z.object({
  date: z.string(),
  status: z.enum(["MORNING", "LIVE", "CLOSED"]),
  forecast_accuracy: z.number(),
  waste_cost: z.number(),
  stockout_count: z.number(),
  revenue: z.number(),
  prep_items_planned: z.number(),
  lost_revenue_estimate: z.number(),
  decision_support_rate: z.number().optional(),
  estimated_net_impact: z.number().optional(),
  day_reaction: z.string().optional(),
  session_notes: z.string().optional(),
});

export const historyItemRowSchema = z.object({
  item_id: z.string(),
  item_title: z.string().nullable(),
  unit: z.string(),
  planned_qty: z.number(),
  additional_qty: z.number(),
  actual_sales: z.number(),
  waste_qty: z.number(),
  stockout_flag: z.boolean(),
  revenue: z.number(),
  waste_cost: z.number(),
  lost_revenue_estimate: z.number(),
  forecast_qty: z.number(),
  forecast_error: z.number(),
  decision: z.string().optional(),
});

export const historyExceptionsSchema = z.object({
  top_waste_items: z.array(historyItemRowSchema),
  top_stockout_items: z.array(historyItemRowSchema),
});

export const historyPatternSchema = z.object({
  type: z.string(),
  message: z.string(),
  severity: z.enum(["positive", "warning", "critical"]),
});

export const operationsHistorySnapshotSchema = z.object({
  branch_id: z.string(),
  branch_name: z.string(),
  anchor_date: z.string(),
  window_days: z.number(),
  timeline: z.array(historyTimelineEntrySchema),
  summary: historySummarySchema.nullable(),
  items: z.array(historyItemRowSchema),
  exceptions: historyExceptionsSchema,
  patterns: z.array(historyPatternSchema).optional(),
  data_note: z.string().nullable().optional(),
});

export type OperationsHistorySnapshot = z.infer<
  typeof operationsHistorySnapshotSchema
>;

export const itemTimeSeriesRowSchema = z.object({
  date: z.string(),
  ai_forecast: z.number(),
  planned_qty: z.number(),
  actual_sales: z.number(),
  waste_qty: z.number(),
  waste_cost: z.number(),
  revenue: z.number(),
  lost_revenue_estimate: z.number(),
  stockout_flag: z.boolean(),
  decision: z.string().optional(),
});

export const itemHistorySummarySchema = z.object({
  total_revenue: z.number(),
  total_waste_cost: z.number(),
  total_lost_revenue: z.number(),
  avg_accuracy: z.number(),
  stockout_days: z.number(),
  days_tracked: z.number(),
  override_count: z.number(),
  override_win_count: z.number(),
});

export const itemAiInsightsSchema = z.object({
  accuracy_trend: z.enum(["improving", "stable", "declining"]),
  accuracy_14d: z.number(),
  accuracy_prior_14d: z.number(),
  avg_error_pct: z.number(),
  override_count: z.number(),
  override_win_count: z.number(),
});

export const itemHistorySchema = z.object({
  item_id: z.string(),
  item_title: z.string().nullable(),
  unit: z.string(),
  days: z.number(),
  summary: itemHistorySummarySchema.nullable(),
  ai_insights: itemAiInsightsSchema.nullable(),
  time_series: z.array(itemTimeSeriesRowSchema),
  data_note: z.string().nullable().optional(),
});

export type ItemHistory = z.infer<typeof itemHistorySchema>;
export type ItemTimeSeriesRow = z.infer<typeof itemTimeSeriesRowSchema>;

export type IntegrationsSyncRetryQuery = {
  branch_id: string;
  connection_id?: string;
  provider_code?: string;
};
