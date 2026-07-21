import { z } from "zod";

// ── Vocabulary (mirrors backend/insights/constants.py) ──────────────────────

export const INSIGHT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type InsightSeverity = (typeof INSIGHT_SEVERITIES)[number];

export const INSIGHT_STATUSES = ["ACTIVE", "DISMISSED", "IMPLEMENTED"] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

export const SCORE_TRENDS = ["IMPROVING", "STABLE", "DECLINING"] as const;
export type ScoreTrend = (typeof SCORE_TRENDS)[number];

/**
 * Insight types are NOT a closed enum here on purpose.
 *
 * The backend ships thirteen and will add more as detectors land. A `z.enum`
 * would turn "the pipeline emitted a type this build has not heard of" into a
 * parse failure that blanks the whole tab — a new detector should degrade to an
 * unstyled card, not a broken page.
 */
export type InsightType = string;

// ── Primitives ──────────────────────────────────────────────────────────────

/**
 * DRF renders `DecimalField` as a string (`"791.50"`) and `FloatField` as a
 * number. Both arrive here; both are numbers to the UI.
 *
 * Coercion is deliberately not `z.coerce.number()`, which turns null into 0 —
 * and a branch with no labor cost recorded would then render "0.00" as though
 * the shift were free.
 */
const numeric = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((value) => {
    if (value === null || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });

/**
 * Money as the API serialises it: the raw amount for arithmetic, the currency
 * for labels, and the display string the backend already rounded and separated.
 *
 * Render `display`, not `amount`. The backend decides precision once, at the
 * point the figure is computed, so a heading and the sentence under it always
 * carry the same number. Reformatting `amount` here re-introduces exactly the
 * drift that rounding layer exists to remove.
 */
export const moneySchema = z
  .object({
    amount: z.number(),
    currency: z.string(),
    display: z.string(),
  })
  .nullable();
export type Money = z.infer<typeof moneySchema>;

// ── Insight body (the JSON contract the pipeline writes) ────────────────────

export const evidenceSchema = z.object({
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional().default(""),
  source: z.string().optional().default(""),
});
export type Evidence = z.infer<typeof evidenceSchema>;

/** One costed line under an opportunity — what Tab 3 expands beneath the total. */
export const costVectorSchema = z.object({
  label: z.string(),
  amount: z.number(),
  currency: z.string().optional().default(""),
  share: z.number().optional().nullable(),
  item_id: z.string().optional().nullable(),
  item_name: z.string().optional().default(""),
  daily_surplus_units: z.number().optional().nullable(),
  days_observed: z.number().optional().nullable(),
});
export type CostVector = z.infer<typeof costVectorSchema>;

/** The deterministic instruction: what to change, by how much. */
export const quantifiedActionSchema = z.object({
  item_id: z.string().optional().nullable(),
  item_name: z.string().optional().default(""),
  delta_qty: z.number().nullable(),
  unit: z.string().optional().default(""),
});
export type QuantifiedAction = z.infer<typeof quantifiedActionSchema>;

export const insightBodySchema = z.object({
  observation: z.string().optional().default(""),
  recommendation: z.string().optional().default(""),
  quantified_action: quantifiedActionSchema.optional().nullable(),
  evidence: z.array(evidenceSchema).optional().default([]),
  vectors: z.array(costVectorSchema).optional().default([]),
  window: z
    .object({
      start: z.string().optional().default(""),
      end: z.string().optional().default(""),
      samples: z.number().optional().nullable(),
      days_observed: z.number().optional().nullable(),
    })
    .optional()
    .nullable(),
});
export type InsightBody = z.infer<typeof insightBodySchema>;

// ── Root cause (Tab 4) ──────────────────────────────────────────────────────

export const rootCauseSchema = z.object({
  id: z.string(),
  outcome: z.string(),
  driver_type: z.string(),
  driver_label: z.string(),
  correlation: z.number().nullable(),
  weight: z.number().nullable(),
  p_value: z.number().nullable(),
  sample_count: z.number(),
  window_days: z.number(),
  effect_size: z.number().nullable(),
  effect_direction: z.string(),
  plain_language: z.string(),
  computed_on: z.string(),
});
export type RootCause = z.infer<typeof rootCauseSchema>;

// ── The insight itself ──────────────────────────────────────────────────────

export const insightSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: insightBodySchema,
  confidence: z.number(),
  severity: z.enum(INSIGHT_SEVERITIES),
  // Ranking travels from the server because `severity` is a string: sorting on
  // it client-side puts MEDIUM above HIGH.
  severity_rank: z.number(),
  status: z.enum(INSIGHT_STATUSES),
  source: z.enum(["RULE", "LLM"]),
  is_open: z.boolean(),
  savings: moneySchema,
  savings_period: z.string(),
  first_detected_on: z.string(),
  last_detected_on: z.string(),
  occurrence_count: z.number(),
  resurfaced_count: z.number(),
  suppressed_until: z.string().nullable(),
  root_cause: rootCauseSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Insight = z.infer<typeof insightSchema>;

// ── Freshness ───────────────────────────────────────────────────────────────

export const insightRunSchema = z.object({
  run_date: z.string(),
  status: z.string(),
  completed_at: z.string().nullable(),
  duration_ms: z.number().nullable(),
  insights_written: z.number(),
  insights_closed: z.number(),
  llm_used: z.boolean(),
  llm_provider: z.string(),
  stage_status: z.record(z.string(), z.unknown()).optional().default({}),
});
export type InsightRun = z.infer<typeof insightRunSchema>;

/**
 * Attached to every response that can legitimately be empty.
 *
 * Without it an empty tab means two opposite things — "your kitchen is clean"
 * and "the nightly job died on Friday" — and renders identically for both.
 */
const freshnessShape = {
  last_run: insightRunSchema.nullable(),
  is_stale: z.boolean(),
  never_run: z.boolean(),
};

export type Freshness = {
  last_run: InsightRun | null;
  is_stale: boolean;
  never_run: boolean;
};

// ── Tab 1: Executive summary ────────────────────────────────────────────────

export const scoreComponentSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().nullable(),
  detail: z.string().optional().default(""),
  status: z.string(),
  weight: z.number().optional().nullable(),
});
export type ScoreComponent = z.infer<typeof scoreComponentSchema>;

export const intelligenceScoreSchema = z.object({
  calculated_date: z.string(),
  overall_health: z.number(),
  forecast_score: z.number().nullable(),
  waste_score: z.number().nullable(),
  planning_score: z.number().nullable(),
  inventory_score: z.number().nullable(),
  execution_score: z.number().nullable(),
  components: z.array(scoreComponentSchema).default([]),
  trend: z.enum(SCORE_TRENDS),
  delta_vs_prior: z.number().nullable(),
  // A 92 built on four days of data must not render like a 92 built on ninety.
  sample_completeness: z.number().nullable(),
});
export type IntelligenceScore = z.infer<typeof intelligenceScoreSchema>;

export const dailyMetricSchema = z.object({
  metric_date: z.string(),
  currency: z.string(),
  revenue: numeric,
  revenue_display: z.string(),
  revenue_prior_period: numeric,
  revenue_change_pct: z.number().nullable(),
  transaction_count: z.number().nullable(),
  forecast_accuracy: z.number().nullable(),
  forecast_accuracy_7d_avg: z.number().nullable(),
  waste_qty: z.number().nullable(),
  waste_cost: numeric,
  waste_cost_display: z.string(),
  waste_change_pct: z.number().nullable(),
  unaccounted_qty: z.number().nullable(),
  stockout_events: z.number().nullable(),
  compliance_rate: z.number().nullable(),
  override_rate: z.number().nullable(),
  scheduled_labor_hours: z.number().nullable(),
  actual_labor_hours: z.number().nullable(),
  labor_hours_variance_pct: z.number().nullable(),
  // Null until the product carries wage data. Kept in the payload so the card
  // can name the gap instead of silently omitting a row.
  labor_cost: numeric,
  labor_cost_variance_pct: z.number().nullable(),
  best_item: z
    .object({
      id: z.string().nullable(),
      title: z.string(),
      metric: z.record(z.string(), z.unknown()).optional().default({}),
    })
    .nullable(),
  volatility_item: z
    .object({
      id: z.string().nullable(),
      title: z.string(),
      score: z.number().nullable(),
    })
    .nullable(),
  signal_digest: z.record(z.string(), z.unknown()).optional().default({}),
  computed_at: z.string(),
});
export type DailyMetric = z.infer<typeof dailyMetricSchema>;

export const summarySchema = z.object({
  branch: z.object({
    id: z.string(),
    name: z.string(),
    currency: z.string(),
  }),
  score: intelligenceScoreSchema.nullable(),
  yesterday: dailyMetricSchema.nullable(),
  // One, not five. A card with five recommendations gets none of them done.
  recommended_action: insightSchema.nullable(),
  open_insight_count: z.number(),
  ...freshnessShape,
});
export type InsightSummary = z.infer<typeof summarySchema>;

// ── Tab 2: Feed ─────────────────────────────────────────────────────────────

export const feedSchema = z.object({
  results: z.array(insightSchema),
  ...freshnessShape,
});
export type InsightFeed = z.infer<typeof feedSchema>;

// ── Tab 3: Opportunities ────────────────────────────────────────────────────

export const opportunitiesSchema = z.object({
  currency: z.string(),
  total_savings: z.number(),
  // The header equals the sum of the rows beneath it, because the backend sums
  // the same filtered set it serialises. Do not recompute it here.
  total_savings_display: z.string(),
  period: z.string(),
  results: z.array(insightSchema),
  ...freshnessShape,
});
export type Opportunities = z.infer<typeof opportunitiesSchema>;

// ── Tab 4: Root causes ──────────────────────────────────────────────────────

export const rootCausesSchema = z.object({
  outcomes: z.record(z.string(), z.array(rootCauseSchema)),
  window_days: z.number(),
  available: z.boolean(),
  // Populated when `available` is false: says why the tab is empty rather than
  // implying a kitchen with no explainable variance.
  reason: z.string(),
  ...freshnessShape,
});
export type RootCauses = z.infer<typeof rootCausesSchema>;

// ── Runs ────────────────────────────────────────────────────────────────────

export const runsSchema = z.object({
  runs: z.array(insightRunSchema),
  healthy: z.boolean(),
  ...freshnessShape,
});
export type Runs = z.infer<typeof runsSchema>;
