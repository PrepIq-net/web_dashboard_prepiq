import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Enums — mirror backend planning/constants.py
// ─────────────────────────────────────────────────────────────────────────────

export const eventTypeEnum = z.enum([
  "PROMOTION",
  "RESERVATION",
  "HOLIDAY",
  "SPECIAL_EVENT",
  "DELIVERY",
  "CLOSURE",
  "MAINTENANCE",
  "PRIVATE_BOOKING",
  "LOCAL_EVENT",
  "WEATHER_ALERT",
  "SEASONAL_EVENT",
  "MARKETING_CAMPAIGN",
  "AI_RECOMMENDATION",
  "OPERATIONAL_NOTE",
]);
export type EventType = z.infer<typeof eventTypeEnum>;

export const eventStatusEnum = z.enum(["ACTIVE", "CANCELLED", "COMPLETED", "DRAFT"]);
export type EventStatus = z.infer<typeof eventStatusEnum>;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-model schemas (read-only — returned in detail view)
// ─────────────────────────────────────────────────────────────────────────────

export const eventPromotionSchema = z.object({
  id: z.number().optional(),
  promotion_name: z.string(),
  discount_type: z.string(),
  discount_value: z.string(),
  promotion_channel: z.string(),
  expected_attendance: z.number().nullable().optional(),
  expected_uplift: z.number().nullable().optional(),
  is_recurring: z.boolean(),
  recurrence_rule: z.string().optional(),
  affected_items: z.array(z.string()).optional(),
});
export type EventPromotion = z.infer<typeof eventPromotionSchema>;

export const eventReservationSchema = z.object({
  id: z.number().optional(),
  guest_count: z.number(),
  reservation_type: z.string(),
  estimated_spend: z.string().nullable().optional(),
  service_period: z.string(),
  confirmed: z.boolean(),
  notes: z.string().optional(),
});
export type EventReservation = z.infer<typeof eventReservationSchema>;

export const eventLocalEventSchema = z.object({
  id: z.number().optional(),
  location: z.string(),
  expected_attendance: z.number().nullable().optional(),
  distance_from_branch_km: z.number().nullable().optional(),
  confidence: z.number(),
  source: z.string(),
});
export type EventLocalEvent = z.infer<typeof eventLocalEventSchema>;

export const eventClosureSchema = z.object({
  id: z.number().optional(),
  reason: z.string(),
  partial_day: z.boolean(),
  full_day: z.boolean(),
});
export type EventClosure = z.infer<typeof eventClosureSchema>;

export const eventDeliverySchema = z.object({
  id: z.number().optional(),
  supplier_name: z.string(),
  delivery_date: z.string(),
  items: z.array(z.record(z.string(), z.unknown())),
  expected_cost: z.string().nullable().optional(),
  delivery_status: z.string(),
});
export type EventDelivery = z.infer<typeof eventDeliverySchema>;

export const eventOperationalNoteSchema = z.object({
  id: z.number().optional(),
  note_type: z.string(),
  content: z.string(),
});
export type EventOperationalNote = z.infer<typeof eventOperationalNoteSchema>;

export const aiForecastSignalSchema = z.object({
  id: z.number().optional(),
  predicted_demand_delta: z.number(),
  confidence: z.number(),
  reasoning: z.string(),
  source_data: z.record(z.string(), z.unknown()),
  generated_at: z.string(),
  model_version: z.string().optional(),
});
export type AIForecastSignal = z.infer<typeof aiForecastSignalSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CalendarEvent — list shape (flat, no nested sub-models)
// ─────────────────────────────────────────────────────────────────────────────

export const calendarEventListSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  event_type: eventTypeEnum,
  start_datetime: z.string(),
  end_datetime: z.string(),
  status: eventStatusEnum,
  branch: z.string().uuid().nullable().optional(),
  branch_name: z.string().nullable().optional(),
  is_forecast_signal: z.boolean(),
  expected_demand_impact: z.number().nullable().optional(),
  created_at: z.string(),
});
export type CalendarEventList = z.infer<typeof calendarEventListSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CalendarEvent — detail shape (all nested sub-models)
// ─────────────────────────────────────────────────────────────────────────────

export const calendarEventDetailSchema = calendarEventListSchema.extend({
  organization: z.string().uuid(),
  description: z.string().optional(),
  ai_analysis: z.record(z.string(), z.unknown()).nullable().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_by_name: z.string().nullable().optional(),
  // Sub-models (absent when not applicable to event_type)
  promotion: eventPromotionSchema.nullable().optional(),
  reservation: eventReservationSchema.nullable().optional(),
  local_event: eventLocalEventSchema.nullable().optional(),
  closure: eventClosureSchema.nullable().optional(),
  delivery: eventDeliverySchema.nullable().optional(),
  operational_note: eventOperationalNoteSchema.nullable().optional(),
  ai_signal: aiForecastSignalSchema.nullable().optional(),
});
export type CalendarEventDetail = z.infer<typeof calendarEventDetailSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Calendar view response — events grouped by date
// ─────────────────────────────────────────────────────────────────────────────

export const calendarViewResponseSchema = z.object({
  start: z.string(),
  end: z.string(),
  branch_id: z.string().nullable().optional(),
  calendar: z.record(z.string(), z.array(calendarEventListSchema)),
});
export type CalendarViewResponse = z.infer<typeof calendarViewResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Forecast context — /events/forecast-context/
// ─────────────────────────────────────────────────────────────────────────────

export const promotionItemUpliftSchema = z.object({
  item_id: z.string().uuid(),
  item_name: z.string(),
  uplift: z.number(),
});
export type PromotionItemUplift = z.infer<typeof promotionItemUpliftSchema>;

export const forecastContextSchema = z.object({
  has_closure: z.boolean(),
  closure_is_full_day: z.boolean(),
  has_promotion: z.boolean(),
  promotion_expected_uplift: z.number(),
  // Per-item promotion data: item_id → {item_id, item_name, uplift}
  // e.g. Rolex and Pizza are on Happy Hour → those items get +20% forecast boost
  promotion_item_uplifts: z.record(z.string(), promotionItemUpliftSchema).optional(),
  promotion_affected_item_ids: z.array(z.string()).optional(),
  reservation_count: z.number(),
  reservation_total_guests: z.number(),
  reservation_types: z.array(z.string()),
  local_event_count: z.number(),
  local_event_max_attendance: z.number(),
  has_delivery: z.boolean(),
  delivery_supplier: z.string().nullable().optional(),
  composite_demand_impact: z.number(),
  total_events: z.number(),
  events: z.array(calendarEventListSchema),
});
export type ForecastContext = z.infer<typeof forecastContextSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Write payloads
// ─────────────────────────────────────────────────────────────────────────────

export const createCalendarEventPayloadSchema = z.object({
  branch: z.string().uuid().nullable().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  event_type: eventTypeEnum,
  start_datetime: z.string(),
  end_datetime: z.string(),
  status: eventStatusEnum.optional(),
  is_forecast_signal: z.boolean().optional(),
  expected_demand_impact: z.number().nullable().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type CreateCalendarEventPayload = z.infer<typeof createCalendarEventPayloadSchema>;

export type UpdateCalendarEventPayload = Partial<CreateCalendarEventPayload>;

// ─────────────────────────────────────────────────────────────────────────────
// List query params
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanningEventsParams {
  branch_id?: string;
  event_type?: EventType;
  status?: EventStatus;
  start_date?: string;
  end_date?: string;
}

export interface CalendarViewParams {
  start: string;
  end: string;
  branch_id?: string;
}

export interface ForecastContextParams {
  branch_id: string;
  date: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  PROMOTION: "Promotion",
  RESERVATION: "Reservation",
  HOLIDAY: "Holiday",
  SPECIAL_EVENT: "Special Event",
  DELIVERY: "Delivery",
  CLOSURE: "Closure",
  MAINTENANCE: "Maintenance",
  PRIVATE_BOOKING: "Private Booking",
  LOCAL_EVENT: "Local Event",
  WEATHER_ALERT: "Weather Alert",
  SEASONAL_EVENT: "Seasonal Event",
  MARKETING_CAMPAIGN: "Marketing Campaign",
  AI_RECOMMENDATION: "AI Recommendation",
  OPERATIONAL_NOTE: "Operational Note",
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  PROMOTION: "bg-status-success/20 text-status-success border-status-success/30",
  RESERVATION: "bg-brand-gold/20 text-brand-gold border-brand-gold/30",
  HOLIDAY: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  SPECIAL_EVENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DELIVERY: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  CLOSURE: "bg-status-critical/20 text-status-critical border-status-critical/30",
  MAINTENANCE: "bg-status-warning/20 text-status-warning border-status-warning/30",
  PRIVATE_BOOKING: "bg-brand-gold/20 text-brand-gold border-brand-gold/30",
  LOCAL_EVENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  WEATHER_ALERT: "bg-status-warning/20 text-status-warning border-status-warning/30",
  SEASONAL_EVENT: "bg-green-500/20 text-green-400 border-green-500/30",
  MARKETING_CAMPAIGN: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  AI_RECOMMENDATION: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  OPERATIONAL_NOTE: "bg-surface-4 text-text-muted border-surface-4",
};

export const EVENT_TYPE_DOT: Record<EventType, string> = {
  PROMOTION: "bg-status-success",
  RESERVATION: "bg-brand-gold",
  HOLIDAY: "bg-purple-400",
  SPECIAL_EVENT: "bg-blue-400",
  DELIVERY: "bg-cyan-400",
  CLOSURE: "bg-status-critical",
  MAINTENANCE: "bg-status-warning",
  PRIVATE_BOOKING: "bg-brand-gold",
  LOCAL_EVENT: "bg-blue-400",
  WEATHER_ALERT: "bg-status-warning",
  SEASONAL_EVENT: "bg-green-400",
  MARKETING_CAMPAIGN: "bg-pink-400",
  AI_RECOMMENDATION: "bg-purple-400",
  OPERATIONAL_NOTE: "bg-text-muted",
};
